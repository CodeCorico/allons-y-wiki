module.exports = function() {
  'use strict';

  var path = require('path'),
      extend = require('extend'),
      rootPath = path.resolve(__dirname, '../../..');

  DependencyInjection.factory('postsContentThumbsFactory', function($allonsy, thumbnailsFactory) {

    var SIZES = [{
      name: 'thumb',
      maxWidth: 800,
      maxHeight: 800
    }];

    return function postsContentThumbsFactory(post, callback) {
      if (!post || !post.image) {
        if (post) {
          for (var i = 0; i < SIZES.length; i++) {
            post[SIZES[i].name] = null;
          }
        }

        return callback();
      }

      thumbnailsFactory([{
        path: rootPath,
        file: post.image,
        sizes: extend(true, [], SIZES)
      }], {
        overwrite: false,
        resizeGif: false
      }, function(err, files) {
        if (err || !files || !files.length || files[0].sizes.length < SIZES.length) {
          $allonsy.logWarning('allons-y-wiki', 'posts:content-thumbs-error', {
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
            $allonsy.logWarning('allons-y-wiki', 'posts:content-thumbs-error', {
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
