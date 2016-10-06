'use strict';

var $MediaService = DependencyInjection.injector.controller.get('$MediaService');

$MediaService.onAsyncSafe('postApi.finish', function(fields, callback) {
  fields = fields || {};

  var result  = null;

  if (fields.isPostCover) {
    var postsCoverThumbsFactory = DependencyInjection.injector.controller.get('postsCoverThumbsFactory'),
        post = {
          cover: fields.fileUrl
        };

    postsCoverThumbsFactory(post, function() {
      callback(post);
    });
  }
  else if (fields.isPostContentImage || fields.isPostContentFullWidthImage) {
    var postsContentThumbsFactory = DependencyInjection.injector.controller.get('postsContentThumbsFactory'),
        post = {
          image: fields.fileUrl
        };

    postsContentThumbsFactory(post, function() {
      post.url = post.thumb || post.image;

      callback(post);
    });
  }
  else {
    return callback(result);
  }

});

module.exports = null;
