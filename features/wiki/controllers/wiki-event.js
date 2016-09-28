'use strict';

module.exports = [{

  event: 'create(wiki/try-delete)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function($socket, $message, PostModel, $SocketsService) {
    if (!this.validMessage($message, {
      id: 'filled'
    })) {
      return;
    }

    PostModel.searchPostLinks($message.id, true, function(err, posts) {
      if (err) {
        return $SocketsService.error($socket, $message, 'read(posts/post)', err);
      }

      $socket.emit('read(posts/post.tryDelete)', {
        id: $message.id,
        count: posts.length
      });
    });
  }
}];
