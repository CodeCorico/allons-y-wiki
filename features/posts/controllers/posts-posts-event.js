'use strict';

module.exports = [{
  event: 'update(web/route)',
  permissions: ['wiki-access'],
  controller: function($socket, PostModel, $message) {
    if (!this.validMessage($message, {
      path: ['string']
    })) {
      return;
    }

    PostModel.postsOpened($socket, $message.path);
    PostModel.postsEdited($socket, false);
  }
}, {
  event: 'call(posts/home)',
  permissions: ['wiki-access'],
  controller: function($socket, PostModel) {
    PostModel.homeUrl(function(homeUrl) {
      $socket.emit('read(posts/home)', {
        homeUrl: homeUrl
      });
    });
  }
}, {
  event: 'update(posts/home)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function($socket, PostModel, $message, $WebService) {
    if (!this.validMessage($message, {
      id: ['string', 'filled']
    })) {
      return;
    }

    PostModel.changeHomeUrl($socket, $message.id, function(err, post) {
      if (err || !post) {
        return;
      }

      $WebService.updateUrl('/wiki');

      $socket.emit('read(posts/home)', {
        homeUrl: post.url
      });
    });
  }
}];
