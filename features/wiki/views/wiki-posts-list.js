(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-posts-list', [
    '$RealTimeService', '$component', '$data', '$done',
  function wikiPostsListController($RealTimeService, $component, $data, $done) {

    var WikiPostsList = $component({
          data: $.extend(true, {
            type: $data.type,
            total: 0
          }, $data)
        }),
        _total = null,
        _realtimeComponent = 'wikiPostsListController' + WikiPostsList.get('componentId'),
        _realtimeListEvent = null,
        _todayTitleUsed = false,
        _weekTitleUsed = false,
        _monthTitleUsed = false,
        _beforeMonthTitleUsed = false;

    function _updateRealtimeEvents() {
      _realtimeListEvent = [
        'wiki-',
        WikiPostsList.get('type'),
        (WikiPostsList.get('userid') ? ':' + WikiPostsList.get('userid') : ''),
        (WikiPostsList.get('count') ? ':' + WikiPostsList.get('count') : '')
      ].join('');

      if (WikiPostsList.get('type') == 'contributions' && (!WikiPostsList.get('userid') || !WikiPostsList.get('count'))) {
        return;
      }

      $RealTimeService.realtimeComponent(_realtimeComponent, {
        name: _realtimeListEvent,
        update: function(event, args) {
          if (!args || !args.posts) {
            return;
          }

          if (WikiPostsList.get('type') == 'lastupdated') {
            var date = window.moment(new Date());

            args.posts.forEach(function(post, i) {
              post.sectionTitle = null;

              if (i === 0) {
                _todayTitleUsed = false;
                _weekTitleUsed = false;
                _monthTitleUsed = false;
                _beforeMonthTitleUsed = false;
              }

              var itemDate = window.moment(new Date(post.updatedAt)),
                  diffHours = date.diff(itemDate, 'hours', true);

              if (!_todayTitleUsed && diffHours <= 24) {
                _todayTitleUsed = true;
                post.sectionTitle = 'Updated today';
              }
              else if (!_weekTitleUsed && diffHours > 24 && diffHours <= 24 * 7) {
                _weekTitleUsed = true;
                post.sectionTitle = 'Updated this week';
              }
              else if (!_monthTitleUsed && diffHours > 24 * 7 && diffHours <= 24 * 30) {
                _monthTitleUsed = true;
                post.sectionTitle = 'Updated this month';
              }
              else if (!_beforeMonthTitleUsed && diffHours > 24 * 30) {
                _beforeMonthTitleUsed = true;
                post.sectionTitle = 'Updated before this month';
              }
            });
          }

          WikiPostsList.set('posts', args.posts);
        }
      }, _realtimeListEvent);
    }

    WikiPostsList.observe('count', _updateRealtimeEvents, {
      init: false
    });

    WikiPostsList.observe('userid', _updateRealtimeEvents, {
      init: false
    });

    WikiPostsList.on('teardown', function() {
      $RealTimeService.unregisterComponent(_realtimeComponent);
    });

    WikiPostsList.observe('posts', function(posts) {
      var total = posts && posts.length || 0;
      if (total === _total) {
        return;
      }
      _total = total;

      WikiPostsList.set('total', posts && posts.length || 0);

      WikiPostsList.require().then(function() {
        WikiPostsList.fire('postsloaded');
      });
    }, {
      defer: true,
      init: false
    });

    _updateRealtimeEvents();

    $done();
  }]);

})();
