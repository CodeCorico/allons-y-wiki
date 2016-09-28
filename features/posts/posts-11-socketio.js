'use strict';

module.exports = function($allonsy, $io, $SocketsService) {

  $io.on('connection', function(socket) {
    socket.on('disconnect', function() {
      if (!socket || !socket.user || !socket.user.postLocked) {
        return;
      }

      var postId = socket.user.postLocked;
      socket.user.postLocked = null;

      $SocketsService.emit(socket, {
        'route.url': /^\/wiki/
      }, null, 'read(posts/post.unlock)', {
        id: postId
      });

      var PostModel = DependencyInjection.injector.model.get('PostModel');

      PostModel
        .findOne({
          id: postId
        })
        .exec(function(err, post) {
          if (err || !post) {
            return;
          }

          $allonsy.log('allons-y-wiki', 'posts:post-unlock', {
            label: 'Unlock the <strong>' + post.title + '</strong> article',
            socket: socket,
            post: PostModel.mongo.objectId(post.id),
            postTitle: post.title,
            fromDisconnection: true
          });
        });
    });

  });

};
