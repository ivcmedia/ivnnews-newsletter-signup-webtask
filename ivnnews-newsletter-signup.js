var Mailchimp  = require('mailchimp-api-v3');
var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.post('/', function (req, res, next) {
  if (req.body.email_address == null) {
    var error = new Error('body must have an email_address field');
    error.status = 400;
    return next(error);
  }
  var emailAddress = req.body.email_address;
  var secrets = req.webtaskContext.secrets;
  var meta = req.webtaskContext.meta;
  var mailchimp = new Mailchimp(secrets.mailchimpApiKey);
  var path = `/lists/${meta.mailchimpListId}/members`;
  console.info(`making POST request to ${path}`);
  return mailchimp.post(`/lists/${meta.mailchimpListId}/members`, {
    email_address: email_address,
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
