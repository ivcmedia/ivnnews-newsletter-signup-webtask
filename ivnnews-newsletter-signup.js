var Mailchimp = require('mailchimp-api-v3');
var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var cors = require('cors');
var morgan = require('morgan');
var md5 = require('md5');

var corsOptions = function(req, cb) {
  var allowedOrigins = req.webtaskContext.meta.corsAllowedOrigins.split(',') || '*';
  console.log('found allowed origins: ', allowedOrigins);
  cb(null, {
    origin: function(origin, originCb) {
      console.log('request has origin: ', origin);
      if (allowedOrigins === '*' || allowedOrigins.indexOf(origin) > -1) {
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
  var meta = req.webtaskContext.meta;
  // Set some sane defaults.
  var listId = meta.mailchimpListId;
  var interestIds = [meta.mailchimpInterestId];
  // Let requests override the default mailchimp list ID.
  if (req.body.mailchimp_list_id === null) {
    listId = req.body.mailchimp_list_id;
    // The default interest IDs won't work if the request
    // overrode the list ID, so unset it.
    interestIds = [];
  }
  // Let requests specify their interest IDs
  if (req.body.mailchimp_interest_ids !== null) {
    interestIds = req.body.mailchimp_interest_ids.split(',');
  }
  var emailAddress = req.body.email_address;
  var subscriberHash = md5(emailAddress);
  var secrets = req.webtaskContext.secrets;
  var mailchimp = new Mailchimp(secrets.mailchimpApiKey);
  var endpoint = `/lists/${listId}/members`;
  console.info(`making PUT request to ${endpoint}`);
  return mailchimp
    .put(`endpoint/${subscriberHash}`, {
      email_address: emailAddress,
      status: 'subscribed',
      interests: interestIds.reduce(function(acc, iid) {
        acc[iid] = true;
        return acc;
      }, {})
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
