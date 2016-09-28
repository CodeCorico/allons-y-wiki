'use strict';

module.exports = [{

  event: 'call(posts/search)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function($socket, PostModel, $message) {
    if (!this.validMessage($message)) {
      return;
    }

    if (!$message.search && !$message.id) {
      return;
    }

    var method = 'searchByTitle',
        search = $message.search;

    if ($message.id) {
      method = 'searchById';
      search = $message.id;
    }

    PostModel[method](search, 10, function(err, posts, regex) {
      if (err) {
        return $socket.emit('read(posts/search)', {
          err: err
        });
      }

      $socket.emit('read(posts/search)', {
        posts: posts.map(function(post) {
          return {
            id: post.id,
            title: post.title,
            titleFound: regex ? post.title.replace(regex, function(value) {
              var result = '';

              for (var i = 1; i < arguments.length - 2; i++) {
                value = value.replace(arguments[i], '{{before}}' + arguments[i] + '{{after}}');

                var indexToCut = value.indexOf('{{after}}') + 9;

                result += value.substr(0, indexToCut);
                value = value.substr(indexToCut, value.length - indexToCut);
              }
              result += value;

              return result;
            }) : '{{before}}' + post.title + '{{after}}',
            url: post.url,
            summary: post.summary || [],
            coverThumb: post.coverThumb
          };
        })
      });
    });
  }
}];
