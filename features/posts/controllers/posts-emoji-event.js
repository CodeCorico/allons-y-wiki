'use strict';

module.exports = [{

  event: 'update(posts/emoji)',
  permissions: ['wiki-access'],
  controller: function($allonsy, $socket, $SocketsService, PostModel, UserModel, $message) {
    if (!this.validMessage($message, {
      id: 'filled',
      emoji: 'filled',
      tagName: 'filled',
      tagIndex: 'filled'
    })) {
      return;
    }

    PostModel.toggleEmoji($socket.user, $message.id, $message.emoji, $message.tagName, $message.tagIndex, function(err, post, emojiAdded, emojiRemoved) {
      if (err || !post) {
        return;
      }

      var postPublicData = post.publicData();

      $SocketsService.emit(null, {
        'route.url': /^\/wiki/
      }, null, 'read(posts/post)', {
        post: post.publicData(),
        updated: true,
        enterMode: 'edit',
        enterUrl: post.url,
        emojiUpdated: true,
        emojiAdded: emojiAdded,
        emojiRemoved: emojiRemoved
      });

      PostModel.refreshPost(post, emojiAdded ? {
        emojiAdded: emojiAdded
      } : null);

      PostModel.reactionsCount(emojiAdded ? 1 : -1);

      if (emojiAdded) {
        var contributors = post.contributors
          .filter(function(contributor) {
            var inPostTab = false;

            $SocketsService.each(function(socket) {
              if (
                socket && socket.user && socket.user.id == contributor.id && socket.userActivity &&
                socket.route && socket.route.url && socket.route.url == '/wiki/' + post.url
              ) {
                inPostTab = true;
              }
            });

            return !inPostTab && contributor.id != $socket.user.id;
          })
          .map(function(contributor) {
            return contributor.id;
          });

        if (contributors.length) {
          UserModel.pushNotification(null, contributors, {
            message: '1 new reaction on <strong>' + post.title + '</strong>!',
            content: [
              '<strong>', $socket.user.username, '</strong>',
              ' has reacted ',
              '<span style="',
                'display: inline-block;',
                'position: relative;',
                'top: 2px;',
                'width: 1.6rem;',
                'height: 1.6rem;',
                'background: url(\'/public/wiki/emoji-', $message.emoji, '.png\') no-repeat;',
                'background-size: 100%;',
              '"></span> to your article ',
              '<strong>', post.title, '</strong>'
            ].join(''),
            picture: $socket.user.avatarMini || $socket.user.avatar || '/public/users/avatar.png',
            pushTitle: $message.emoji.toUpperCase() + '! - ' + process.env.BRAND,
            pushContent: [
              $socket.user.username, ' has reacted to your article "', post.title, '"!'
            ].join(''),
            pushPicture: $socket.user.avatarThumbSquare || $socket.user.avatar || '/public/users/avatar.png',
            eventName: 'url',
            eventArgs: {
              url: '/wiki/' + post.url
            }
          });
        }
      }

      var metrics = [{
        key: 'wikiAddPostEmoji',
        name: 'Emoji ' + (emojiAdded ? 'added' : 'removed'),
        description: 'Emoji ' + (emojiAdded ? 'added on' : 'removed from') + ' an article node.'
      }];

      PostModel.nowPostUpdate(
        postPublicData,
        $socket.user,
        'emoji-' + (emojiAdded ? 'added' : 'removed'),
        emojiAdded ? emojiAdded.emoji : emojiRemoved.emoji
      );

      if (emojiAdded) {
        metrics.push({
          key: 'addPostEmoji' + $message.emoji,
          name: 'Emoji ' + $message.emoji,
          description: 'Emoji ' + $message.emoji + ' added on an article node.'
        });
      }

      $allonsy.log('allons-y-wiki', 'posts:emoji-' + (emojiAdded ? 'added' : 'removed'), {
        label: (emojiAdded ? 'Add' : 'Remove') + ' emoji <strong>' + $message.emoji + '</strong> on the "' + post.title + '" article',
        socket: $socket,
        metrics: metrics,
        post: PostModel.mongo.objectId(post.id),
        emoji: $message.emoji
      });
    });
  }
}];
