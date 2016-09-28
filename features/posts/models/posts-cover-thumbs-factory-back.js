module.exports = function() {
  'use strict';

  var path = require('path'),
      rootPath = path.resolve(__dirname, '../../..');

  DependencyInjection.factory('postsCoverThumbsFactory', function($allonsy, thumbnailsFactory) {

    var SIZES = [{
      name: 'coverThumb',
      width: 400,
      height: 200
    }, {
      name: 'coverLarge',
      width: 1500,
      height: 220
    }];

    return function postsCoverThumbsFactory(post, callback) {
      if (!post || !post.cover) {
        if (post) {
          for (var i = 0; i < SIZES.length; i++) {
            post[SIZES[i].name] = null;
          }
        }

        return callback();
      }

      thumbnailsFactory([{
        path: rootPath,
        file: post.cover,
        sizes: SIZES
      }], {
        overwrite: false,
        resizeGif: true
      }, function(err, files) {
        if (err || !files || !files.length || files[0].sizes.length < SIZES.length) {
          $allonsy.logWarning('allons-y-wiki', 'posts:cover-thumbs-error', {
            error: err || 'no files',
            file: post.image,
            post: post.id,
            postTitle: post.title,
            postUrl: post.url
          });

          return callback();
        }

        var sizes = files[0].sizes;

        for (var i = 0; i < SIZES.length; i++) {
          if (sizes[i].err || !sizes[i].result) {
            $allonsy.logWarning('allons-y-wiki', 'posts:cover-thumbs-error', {
              error: sizes[i].err || 'no result',
              file: post.image,
              post: post.id,
              postTitle: post.title,
              postUrl: post.url,
              size: SIZES[i].name
            });
          }

          post[SIZES[i].name] = sizes[i].err || !sizes[i].result ? null : sizes[i].result;
        }

        callback();
      });
    };
  });
};
