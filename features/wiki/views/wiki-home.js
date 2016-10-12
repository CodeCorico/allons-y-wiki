(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-home', [
    '$Page', '$Layout', 'WikiService', '$RealTimeService',
    '$component', '$data', '$done',
  function wikiHomeController(
    $Page, $Layout, WikiService, $RealTimeService,
    $component, $data, $done
  ) {
    var WikiHome = $component({
          data: $.extend({
            displayAvatar: $Page.get('avatar'),
            coverScrollingTop: 0,
            show: null
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

      setTimeout(function() {
        WikiService.offNamespace('wikiHomeController');
      });
    });

    WikiHome.on('postsMostReadLoaded postsLastCreatedLoaded', function() {
      if (_scrolls) {
        _scrolls.update();
      }
    });

    WikiHome.require().then(function() {
      _scrolls = WikiHome.findChild('name', 'pl-scrolls');

      setTimeout(_show);

      $done();
    });
  }]);

})();
