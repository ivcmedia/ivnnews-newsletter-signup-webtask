var Mailchimp = require('mailchimp-api-v3');
var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var cors = require('cors');
var morgan = require('morgan');

var corsOptions = function(req, cb) {
  var allowedOrigin = req.webtaskContext.meta.corsAllowedOrigins || '*';
  console.log('found allowed origin: ', allowedOrigin);
  cb(null, {
    origin: function(origin, originCb) {
      if (allowedOrigin === '*' || allowedOrigin === origin) {
        return originCb(null, true);
      }
      originCb(new Error('origin not allowed'), false);
    },
    methods: ['OPTIONS', 'POST'],
    allowedHeaders: ['Content-Type'],
    optionsSuccessStatus: 200,
  });
};

var app = express();
app.use(morgan('combined'));
app.use(cors(corsOptions));
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.post('/', function(req, res, next) {
  if (req.body.email_address === null) {
    var error = new Error('body must have an email_address field');
    error.status = 400;
    return next(error);
  }
  if (req.body.terms !== 'false') {
    console.log('got spam submission with body ', req.body);
    res.status(200).end();
    return;
  }
  var groupIds = [];
  if (req.body.mailchimp_group_ids !== null) {
    if (typeof req.body.mailchimp_group_ids !== 'string') {
      console.error('got malformed mailchimp_group_ids field: ', req.body.mailchimp_group_ids);
    } else {
      groupIds = req.body.mailchimp_group_ids.split(',')
        .map(function(gid) { return parseInt(gid, 10); });
    }
  }
  var emailAddress = req.body.email_address;
  var secrets = req.webtaskContext.secrets;
  var meta = req.webtaskContext.meta;
  var mailchimp = new Mailchimp(secrets.mailchimpApiKey);
  var path = `/lists/${meta.mailchimpListId}/members`;
  console.info(`making POST request to ${path}`);
  return mailchimp
    .post(`/lists/${meta.mailchimpListId}/members`, {
      email_address: emailAddress,
      status: 'subscribed',
      interests: Object.assign({},
        {
          [meta.mailchimpInterestId]: true,
        },
        groupIds.reduce(function(acc, gid) {
          acc[gid] = true;
          return acc;
        }, {})
      )
    })
    .catch(function(err) {
      console.error('mailchimp api call error: %o', err);
      if (err.status === 400) {
        return Promise.resolve();
      }
      return Promise.reject(err);
    })
    .then(function() {
      console.log('success!');
      res.status(200).end();
    })
    .catch(function(err) {
      next(err);
    });
});
app.use(function(err, req, res, next) {
  console.error(err.stack);
  var status = err.status || 500;
  res.status(status);
  var message = status === 500 ? 'Interal error' : err.message;
  res.send({ status: status, error: message });
});

module.exports = Webtask.fromExpress(app);
