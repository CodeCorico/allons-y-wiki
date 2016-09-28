(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-post-item', [
    '$Page', '$RealTimeService', '$component', '$data', '$done',
  function wikiPostItemController($Page, $RealTimeService, $component, $data, $done) {

    var EMOJIS = [{
          icon: 'up',
          label: 'like'
        }, {
          icon: 'heart',
          label: 'love'
        }, {
          icon: 'down',
          label: 'dislike'
        }, {
          icon: 'check',
          label: 'checked'
        }, {
          icon: 'question',
          label: 'what?'
        }, {
          icon: 'clap',
          label: 'bravo!'
        }, {
          icon: 'smile',
          label: 'smile'
        }, {
          icon: 'tongue',
          label: 'wink'
        }, {
          icon: 'wouah',
          label: 'wouah!'
        }, {
          icon: 'joy',
          label: 'haha'
        }],

        WikiPostItem = $component({
          data: $.extend(true, {
            displayAvatar: $Page.get('avatar')
          }, $data)
        }),
        _realtimeComponent = 'wikiPostItemController' + WikiPostItem.get('componentId'),
        _realtimeListEvent = null,
        _lastId = null;

    function _displayEmojis(post) {
      var displayEmojis = [];

      if (post.emojis) {
        EMOJIS.forEach(function(emoji) {
          if (post.emojis[emoji.icon]) {
            displayEmojis.push({
              label: emoji.label,
              icon: emoji.icon,
              count: post.emojis[emoji.icon]
            });
          }
        });

        displayEmojis.sort(function(a, b) {
          return b.count - a.count;
        });
      }

      return displayEmojis;
    }

    function _animateEmojisAdding(displayEmojis) {
      setTimeout(function() {
        if (!WikiPostItem) {
          return;
        }

        WikiPostItem.set('post.emojisAdding.status', 'show');

        setTimeout(function() {
          if (!WikiPostItem) {
            return;
          }

          WikiPostItem.set('post.emojisAdding.status', 'hide');

          setTimeout(function() {
            WikiPostItem.set('post.displayEmojis', displayEmojis);
            WikiPostItem.set('post.emojisAdding', null);
          }, 550);
        }, 1550);
      });
    }

    function _formatPost(args) {
      args.post.locked = args.post.locked || null;

      if (!WikiPostItem.get('noemojis') || WikiPostItem.get('noemojis') != 'true') {
        var displayEmojis = _displayEmojis(args.post);

        if (args.emojiAdded) {
          args.post.emojisAdding = {
            status: '',
            icon: args.emojiAdded.emoji
          };

          _animateEmojisAdding(displayEmojis);

          args.post.displayEmojis = WikiPostItem.get('post.displayEmojis') || [];
        }
        else {
          args.post.displayEmojis = displayEmojis;
        }
      }
    }

    WikiPostItem.observe('post', function(post) {
      if (!post || !post.id) {
        _lastId = null;
        $RealTimeService.unregisterComponent(_realtimeComponent);

        return;
      }

      _formatPost({
        post: post
      });

      if (_lastId == post.id) {
        return;
      }
      _lastId = post.id;

      _realtimeListEvent = 'wiki-post:' + post.id;

      $RealTimeService.realtimeComponent(_realtimeComponent, {
        name: _realtimeListEvent,
        update: function(event, args) {
          if (!WikiPostItem || !args || !args.post) {
            return;
          }

          _formatPost(args);

          var post = WikiPostItem.get('post') || {};
          post.displayEmojis = null;

          WikiPostItem.set('post', args.post);
        },
        network: function(on) {
          if (!WikiPostItem) {
            return;
          }

          if (!on) {
            WikiPostItem.set('post.locked', null);
          }
        },
        url: function(url) {
          var postUrl = WikiPostItem.get('post.url') || '';

          WikiPostItem.set('selected',
            '/wiki/' + postUrl == url ||
            '/wiki/' + postUrl + '/edit' == url
          );
        }
      });

      if (WikiPostItem.get('notransition') && WikiPostItem.get('notransition') == 'true') {
        WikiPostItem.set('show', true);
      }

      WikiPostItem.update('post');

      if (!WikiPostItem.get('show')) {
        setTimeout(function() {
          if (!WikiPostItem) {
            return;
          }

          WikiPostItem.set('show', true);
        }, WikiPostItem.get('index') * 150);
      }
    });

    WikiPostItem.on('teardown', function() {
      $RealTimeService.unregisterComponent(_realtimeComponent);

      WikiPostItem = null;
    });

    $done();
  }]);

})();
