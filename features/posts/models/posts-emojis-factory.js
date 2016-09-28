module.exports = function() {
  'use strict';

  DependencyInjection.factory('postsEmojiFactory', [function() {

    return function postsEmojiFactory(post) {

      var emojis = post.emojis || {};
      emojis.nodes = emojis.nodes || [];
      emojis.members = emojis.members || {};
      emojis.total = emojis.total || 0;

      if (!post.content) {
        return null;
      }

      var match = post.content.match(/data-emoji=".*?"/gi);
      if (!match || !match.length) {
        return null;
      }

      var ids = match.map(function(id) {
        return id
          .replace('data-emoji="', '')
          .replace('"', '');
      });

      for (var i = emojis.nodes.length - 1; i >= 0; i--) {
        var node = emojis.nodes[i];

        if (ids.indexOf(node.id) < 0) {
          for (var emoji in node) {
            if (emoji != 'id' && node.hasOwnProperty(emoji)) {
              emojis[emoji]--;
              if (emojis[emoji] < 1) {
                delete emojis[emoji];
              }

              for (var j = 0; j < node[emoji].length; j++) {
                var memberId = node[emoji][j];

                emojis.members[memberId].count--;
                if (emojis.members[memberId].count < 1) {
                  delete emojis.members[memberId];
                }

                emojis.total--;
              }
            }
          }

          emojis.nodes.splice(i, 1);
        }
      }

      return emojis;
    };
  }]);
};
