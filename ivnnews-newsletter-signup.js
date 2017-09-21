var Mailchimp = require('mailchimp-api-v3');
var Promise = require('bluebird');
var parseFormdata_ = require('parse-formdata');

function parseFormdata(req) {
  return new Promise(function(resolve, reject) {
    parseFormdata_(req, function(err, data) {
      if (err != null) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

module.exports = function(context, cb) {
  if (context.body == null) {
    return cb('empty body');
  }
  if (context.body.email_address == null) {
    return cb('body must have an email_address field');
  }
  var mailchimp = new Mailchimp(context.secrets.mailchimpApiKey);
  var path = `/lists/${context.meta.mailchimpListId}/members`;
  console.log(`making POST request to ${path}`);
  return mailchimp.post(`/lists/${context.meta.mailchimpListId}/members`, {
      email_address: context.body.email_address,
      status: 'subscribed',
    })
    .then(function(res) {
      console.log('success!');
      cb(null);
    })
    .catch(function(error) {
      cb({type: error.type, title: error.title, detail: error.detail, instance: error.instance});
    });
};