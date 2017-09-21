var Mailchimp  = require('mailchimp-api-v3');
var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.get('/', function (req, res, next) {
  console.log(req.body);
  if (req.body.email_address == null) {
    var error = new Error('body must have an email_address field');
    error.status = 400;
    return next(error);
  }
  var mailchimp = new Mailchimp(context.secrets.mailchimpApiKey);
  var path = `/lists/${context.meta.mailchimpListId}/members`;
  console.info(`making POST request to ${path}`);
  return mailchimp.post(`/lists/${context.meta.mailchimpListId}/members`, {
    email_address: context.body.email_address,
    status: 'subscribed',
  }).catch(function(err) {
    console.error('mailchimp api call error: %o', err);
    return Promise.reject(err);
  })
  .then(function(res) {
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
  res.send({status: status, error: err});
});

module.exports = Webtask.fromExpress(app);
