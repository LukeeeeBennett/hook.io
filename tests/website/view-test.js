// hook-api-test.js
var tap = require("tape");
var r = require('../lib/helpers/_request');
var config = require('../config');
var baseURL = config.baseUrl;
var startDevCluster = require('../lib/helpers/startDevCluster');
var async = require('async');
var sdk = require('hook.io-sdk');

var testUser = config.testUsers.david;

var client = sdk.createClient(testUser.hookSdk);

var webServer;
var allPageKeys;

function enumerateView (v) {
  var arr = [];
  if (typeof v.views !== 'object') {
    return arr;
  }
  var keys = Object.keys(v.views);
  keys.forEach(function(k){
    if (k === 'index') {
      return;
    }
    if (typeof v[k].views === 'object') {
      arr.push(v[k].key);
      Object.keys(v[k].views).forEach(function(sk){
        if (sk === 'index') {
          return;
        }
        if (typeof v[k].views[sk].views === 'object') {
          var subs = enumerateView(v[k].views[sk]);
          subs.forEach(function(s){
            arr.push(s)
          });
        } else{
          if (v[k].views[sk].key !== '/') {
            arr.push(v[k].views[sk].key)
          }
        }
      });
    } else {
      if (v[k].key !== '/') {
        arr.push(v[k].key);
      }
    }
  });
  return arr;
};

tap.test('start the dev cluster', function (t) {
  startDevCluster({}, function (err, servers) {
    t.error(err)
    webServer = servers['web'];
    // get flat representation of all files
    allPageKeys = enumerateView(webServer.view)
    t.ok('cluster started');
    // should not require a timeout, probably issue with one of the services starting
    // this isn't a problem in production since these services are intended to start independant of each other
    setTimeout(function(){
      t.end('dev cluster started');
    }, 1500);
  });
});

// attempt to get all pages as JSON
// TODO: smoke test with valid auth
// TODO: check text/html response in additional to json response, make sure formats / headers are set
tap.test('attempt to get /docs', function (t) {
  var callbacks = 0;
  // t.plan(allPageKeys.length * 2);
  allPageKeys = allPageKeys.filter(function(a){
    if (['/helpers/i18n', '/hook/_rev', '/hook/_src'].indexOf(a) === -1) {
      return a;
    }
  });
  async.eachSeries(allPageKeys, function iter (item, next) {
    r({ uri: baseURL + item, method: "GET", json: true }, function (err, body, res) {
      t.error(err);
      // var shouldReturn404 = ['/hook/_rev', '/hook/_src']; // TODO: remove helpers/i18n from view folder
      t.equal(res.statusCode, 200, 'got 200 response')
      t.ok('did not error back', item)
      next();
    });
  }, function end (){
    t.end();
  })
});

tap.test('perform hard shutdown of cluster', function (t) {
  t.end('shut down');
  setTimeout(function(){
    process.exit(0);
  }, 1500)
});