var Mailchimp = require('mailchimp-api-v3');
var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var cors = require('cors');
var morgan = require('morgan');
var RateLimit = require('express-rate-limit');
var moment = require('moment');

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

var RateLimitStore = (function() {
  function RateLimitStore(windowMs, storage) {
    this.windowMs = windowMs;
    this.storage = storage;
  }

  RateLimitStore.prototype.incr = function(key, cb) {
    var windowMs = this.windowMs;
    var storage = this.storage;
    storage.get(function(error, data) {
      if (error) {
        return cb(error);
      }

      data['rateLimit'] = data['rateLimit'] || {};
      var entry = data['rateLimit'][key] || { c: 0, d: moment() };
      // Reset the count if the entry is older than windowMs.
      if (moment().diff(entry.d) > windowMs) {
        entry.c = 0;
      }
      entry.c = count + 1;
      entry.d = moment();
      data['rateLimit'][key] = entry;
      storage.set(data, function(error) {
        if (error) {
          return cb(error);
        }
      });
      cb(null, entry.c);
    });
  };

  RateLimitStore.prototype.resetKey = function(key, cb) {
    this.storage.get(function(error, data) {
      if (error) {
        return cb(error);
      }

      data['rateLimit'] = data['rateLimit'] || {};
      delete data['rateLimit'][key];
      cb(null);
    });
  };

  return RateLimitStore;
})();

var rateLimiter = function(req, res, next) {
  let windowMs = 60 * 60 * 1000; // 1 hour,
  var limiter = new RateLimit({
    windowMs,
    max: 5,
    store: new RateLimitStore(windowMs, req.webtaskContext.storage),
  });
  return limiter(req, res, next);
};

var app = express();
app.use(morgan('combined'));
app.use(cors(corsOptions));
app.use(rateLimiter);
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.post('/', function(req, res, next) {
  if (req.body.email_address == null) {
    var error = new Error('body must have an email_address field');
    error.status = 400;
    return next(error);
  }
  if (req.body.terms !== 'false') {
    console.log('got spam submission with body ', req.body);
    res.status(200).end();
    return;
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
      interests: {
        [meta.mailchimpInterestId]: true,
      },
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
