'use strict';

module.exports = function($allonsy, $done) {
  var path = require('path');

  $allonsy.requireInFeatures('models/models/media-service.js');
  $allonsy.requireInFeatures('models/thumbnails-factory-back.js');
  $allonsy.requireInFeatures('models/web-url-factory.js.js');

  require(path.resolve(__dirname, 'models/posts-content-thumbs-factory-back.js'))();
  require(path.resolve(__dirname, 'models/posts-cover-thumbs-factory-back.js'))();
  require(path.resolve(__dirname, 'models/posts-summary-factory.js'))();
  require(path.resolve(__dirname, 'models/posts-description-factory.js'))();
  require(path.resolve(__dirname, 'models/posts-emojis-factory.js'))();
  require(path.resolve(__dirname, 'models/posts-link-factory-back.js'))();

  $done();
};
