'use strict';

module.exports = function($allonsy, $io, $SocketsService) {

  $io.on('connection', function(socket) {
    socket.on('disconnect', function() {
      var PostModel = DependencyInjection.injector.model.get('PostModel');

      PostModel.postsOpened(socket);
      PostModel.postsEdited(socket, false);

      if (socket.user && socket.user.postLocked) {

        var postId = socket.user.postLocked;
        socket.user.postLocked = null;

        $SocketsService.emit(socket, {
          'route.url': /^\/wiki/
        }, null, 'read(posts/post.unlock)', {
          id: postId
        });

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
      }
    });

  });

};
