(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-home', [
    '$Page', '$Layout', 'WikiService', '$RealTimeService',
    '$component', '$data', '$done',
  function wikiHomeController(
    $Page, $Layout, WikiService, $RealTimeService,
    $component, $data, $done
  ) {
    var REALTIME_EVENTS = [
          'users-signed', 'wiki-postsopened', 'wiki-postscount', 'wiki-contributorscount', 'wiki-tagscount',
          'wiki-reactionscount'
        ],

        _loopUsersSignedTimeInterval = null;

    function _loopUsersSignedTime() {
      if (!WikiHome) {
        return;
      }

      if (_loopUsersSignedTimeInterval) {
        clearInterval(_loopUsersSignedTimeInterval);
      }

      var usersSigned = WikiHome.get('usersSigned') || [];

      usersSigned.forEach(function(userSigned) {
        userSigned.signedFromAgo = window.moment(userSigned.signedFrom).fromNow();
      });

      WikiHome.set('usersSigned', usersSigned);

      // 1min
      _loopUsersSignedTimeInterval = setTimeout(_loopUsersSignedTime, 60000);
    }

    var WikiHome = $component({
          data: $.extend({
            displayAvatar: $Page.get('avatar'),
            coverScrollingTop: 0,
            show: null,
            usersSigned: [],
            postsOpened: 0,
            postsEdited: 0,
            postsCount: 0,
            newPostsCount: 0,
            newPostsPercent: 0,
            contributorsCount: 0,
            newContributorsCount: 0,
            newContributorsPercent: 0,
            tagsCount: 0,
            reactionsCount: 0,
            feedbacksCount: 0,
            newFeedbacksCount: 0,
            newFeedbacksPercent: 0
          }, $data)
        }),
        _scrolls = null,
        _$el = {
          scrolls: $($(WikiHome.el).find('.pl-scrolls')[0])
        };

    _$el.scrolls.scroll(function() {
      if ($Layout.get('screen') != 'screen-mobile') {
        WikiHome.set('coverScrollingTop', _$el.scrolls.scrollTop() * 0.5);
      }
    });

    function _show(callback) {
      if (WikiHome.get('show') == 'before-show' || WikiHome.get('show') == 'show') {
        if (callback) {
          callback();
        }

        return;
      }

      WikiHome.set('show', 'before-show');
      setTimeout(function() {
        if (!WikiHome) {
          return;
        }

        WikiHome.set('show', 'show');

        if (callback) {
          setTimeout(callback, 350);
        }
      });
    }

    function _hide(callback) {
      if (!WikiHome.get('show') || WikiHome.get('show') == 'hide') {
        if (callback) {
          callback();
        }

        return;
      }

      WikiHome.set('show', 'hide');

      setTimeout(function() {
        if (!WikiHome) {
          return;
        }

        WikiHome.set('show', null);

        if (callback) {
          callback();
        }
      }, 150);
    }

    WikiService.onAsyncSafe('wikiHomeController.beforeTeardown', function(args, callback) {
      _beforeTeadown(callback);
    }, 'low');

    function _beforeTeadown(callback) {
      _hide(callback);
    }

    WikiService.onAsyncSafe('wikiHomeController.teardownWikiHome', function(args, callback) {
      _beforeTeadown(function() {
        WikiHome.teardown().then(callback);
      });
    });

    WikiHome.on('teardown', function() {
      WikiHome = null;
      $RealTimeService.unregisterComponent('wikiHomeController');

      setTimeout(function() {
        WikiService.offNamespace('wikiHomeController');
      });
    });

    WikiHome.on('postsLastViewedLoaded postsMostReadLoaded postsLastCreatedLoaded', function() {
      if (_scrolls) {
        _scrolls.update();
      }
    });

    function _updateUsersSigned(args) {
      if (!args.usersSigned) {
        return;
      }

      var oldUsersSigned = WikiHome.get('usersSigned'),
          oldIds = oldUsersSigned.map(function(userSigned) {
            return userSigned.id;
          }),
          newIds = args.usersSigned.map(function(userSigned) {
            if (oldIds.indexOf(userSigned.id) > -1) {
              userSigned.show = true;
            }

            return userSigned.id;
          }),
          hasRemovedUsersSigned = false;

      for (var i = 0; i < oldUsersSigned.length; i++) {
        if (newIds.indexOf(oldUsersSigned[i].id) < 0) {
          hasRemovedUsersSigned = true;

          WikiHome.set('usersSigned.' + i + '.show', false);
        }
      }

      setTimeout(function() {
        if (!WikiHome) {
          return;
        }

        WikiHome.set('usersSigned', args.usersSigned);

        _loopUsersSignedTime();

        setTimeout(function() {
          if (!WikiHome) {
            return;
          }

          var usersSigned = WikiHome.get('usersSigned');

          for (var i = 0; i < usersSigned.length; i++) {
            if (!usersSigned[i].show) {
              WikiHome.set('usersSigned.' + i + '.show', true);
            }
          }
        }, 350);
      }, hasRemovedUsersSigned ? 350 : 0);
    }

    function _updatePostsOpened(args) {
      WikiHome.set('postsOpened', args.postsOpened || 0);
      WikiHome.set('postsEdited', args.postsEdited || 0);
    }

    function _updatePostsCount(args) {
      WikiHome.set('postsCount', args.postsCount || 0);
      WikiHome.set('newPostsCount', args.newPostsCount || 0);
      WikiHome.set('newPostsPercent', args.newPostsPercent || 0);
    }

    function _updateContributorsCount(args) {
      WikiHome.set('contributorsCount', args.contributorsCount || 0);
      WikiHome.set('newContributorsCount', args.newContributorsCount || 0);
      WikiHome.set('newContributorsPercent', args.newContributorsPercent || 0);
    }

    function _updateTagsCount(args) {
      WikiHome.set('tagsCount', args.tagsCount || 0);
    }

    function _updateReactionsCount(args) {
      WikiHome.set('reactionsCount', args.reactionsCount || 0);
    }

    $RealTimeService.realtimeComponent('wikiHomeController', {
      names: REALTIME_EVENTS,
      update: function(event, args) {
        if (!WikiHome || !args) {
          return;
        }

        if (event == 'users-signed') {
          _updateUsersSigned(args);
        }
        else if (event == 'wiki-postsopened') {
          _updatePostsOpened(args);
        }
        else if (event == 'wiki-postscount') {
          _updatePostsCount(args);
        }
        else if (event == 'wiki-contributorscount') {
          _updateContributorsCount(args);
        }
        else if (event == 'wiki-tagscount') {
          _updateTagsCount(args);
        }
        else if (event == 'wiki-reactionscount') {
          _updateReactionsCount(args);
        }
      },
      network: function(on) {
        if (!WikiHome || on) {
          return;
        }

        var usersSigned = WikiHome.get('usersSigned');

        for (var i = 0; i < usersSigned.length; i++) {
          if (usersSigned[i].show) {
            WikiHome.set('usersSigned.' + i + '.show', false);
          }
        }

        setTimeout(function() {
          if (!WikiHome) {
            return;
          }

          WikiHome.set('usersSigned', []);
        }, 350);
      }
    }, REALTIME_EVENTS);

    WikiHome.require().then(function() {
      _scrolls = WikiHome.findChild('name', 'pl-scrolls');

      setTimeout(_show);

      $done();
    });
  }]);

})();
