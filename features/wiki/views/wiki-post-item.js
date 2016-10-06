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
        _updateActivityDateTimeout = null,
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

    function _updateActivityDate(post, update) {
      if (post.activityDate) {
        post.activityDateString = window
          .moment(post.activityDate)
          .fromNow(true)
          .replace('an hour', '1 h')
          .replace('a minute', '1 min')
          .replace(/hours?/, 'h')
          .replace(/minutes?/, 'min');

        if (update) {
          WikiPostItem.set('post.activityDateString', post.activityDateString);
        }

        clearTimeout(_updateActivityDateTimeout);

        _updateActivityDateTimeout = setTimeout(function() {
          if (!WikiPostItem) {
            return;
          }

          _updateActivityDate(WikiPostItem.get('post'), true);
        }, 60000);
      }
    }

    function _formatPost(args) {
      args.post.locked = args.post.locked || null;

      _updateActivityDate(args.post);

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
      if (!post || (!post.id && !post.postId)) {
        _lastId = null;
        $RealTimeService.unregisterComponent(_realtimeComponent);

        return;
      }

      var id = post.postId || post.id,
          isNow = WikiPostItem.get('template') == 'now';

      if (post.forceShow) {
        delete post.forceShow;

        WikiPostItem.set('forceHide', true);
        WikiPostItem.set('show', false);
      }

      _formatPost({
        post: post
      });

      if (_lastId == id) {
        return;
      }
      _lastId = id;

      _realtimeListEvent = (isNow ? 'wiki-post-locked:' : 'wiki-post:') + id;

      $RealTimeService.realtimeComponent(_realtimeComponent, {
        name: _realtimeListEvent,
        update: function(event, args) {
          if (!WikiPostItem || !args || !args.post) {
            return;
          }

          _formatPost(args);

          var post = WikiPostItem.get('post') || {};
          post.displayEmojis = null;

          if (isNow) {
            WikiPostItem.set('post.locked', args.post.locked);
          }
          else {
            WikiPostItem.set('post', args.post);
          }
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
      }, isNow ? _realtimeListEvent : null);

      if (WikiPostItem.get('notransition') && WikiPostItem.get('notransition') == 'true') {
        WikiPostItem.set('forceHide', false);
        WikiPostItem.set('show', true);
      }

      WikiPostItem.update('post');

      if (!WikiPostItem.get('show')) {
        setTimeout(function() {
          if (!WikiPostItem) {
            return;
          }

          WikiPostItem.set('forceHide', false);
          WikiPostItem.set('show', true);
        }, isNow ? 150 : WikiPostItem.get('index') * 150);
      }
    });

    WikiPostItem.on('teardown', function() {
      clearTimeout(_updateActivityDateTimeout);
      $RealTimeService.unregisterComponent(_realtimeComponent);

      WikiPostItem = null;
    });

    $done();
  }]);

})();
