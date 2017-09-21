var Mailchimp = require('mailchimp-api-v3');
var parseFormdata_ = require('parse-formdata');

function parseFormdata(req) {
  return new Promise(function(resolve, reject) {
    parseFormdata_(req, function(err, data) {
      if (err != null) {
        err.status = 400;
        return reject(err);
      }
      return resolve(data);
    });
  });
}

module.exports = function(context, req, res) {
  parseFormdata(req)
    .then(function(data) {
      if (data.fields.email_address == null) {
        return cb('body must have an email_address field');
      }
      var mailchimp = new Mailchimp(context.secrets.mailchimpApiKey);
      var path = `/lists/${context.meta.mailchimpListId}/members`;
      console.log(`making POST request to ${path}`);
      return mailchimp.post(`/lists/${context.meta.mailchimpListId}/members`, {
        email_address: context.body.email_address,
        status: 'subscribed',
      });    
    }, function(err) {
      console.log('parseFormdata error: %o', err);
      return Promise.reject({status: 400, message: err.message || 'unknown error'});
    })
    .then(function(res) {
      console.log('success!');
      res.writeHead(200);
      res.end();
    }, function(err) {
      console.log('mailchimp api call error: %o', err);
      return Promise.reject({status: err.status || 500, message: err.message});
    })
    .catch(function(error) {
      res.writeHead(error.status, {
        'Content-Type': 'application/json',
      });
      var json = JSON.stringify({
        status: error.status,
        message: error.message,
      });
      res.end(json);
    });
};