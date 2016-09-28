(function() {
  'use strict';

  window.bootstrap([
    '$Page', '$BodyDataService', '$i18nService', '$done',
  function($Page, $BodyDataService, $i18nService, $done) {

    var _user = $BodyDataService.data('user') || null;

    if (_user && _user.permissionsPublic && _user.permissionsPublic.indexOf('wiki-access') > -1) {
      $Page.push('apps', {
        name: $i18nService._('Wiki'),
        select: function() {
          window.page('/wiki');
        }
      });
    }

    // NotificationsService.onSafe('page.actionNotification', function(args) {
    //   _updateWinChart('clickOnNotification');

    //   if (args.eventName == 'url' || args.eventName == 'url.internal') {
    //     if (args.eventArgs.url.match(/\/wiki/)) {
    //       _updateWinChart('openArticleFromNotification');
    //     }

    //     window.page(args.eventArgs.url);

    //     var $Layout = DependencyInjection.injector.view.get('$Layout');
    //     if ($Layout.get('screen') != 'screen-desktop') {
    //       $Layout.rightContext().closeIfGroupOpened('group-users-profile');
    //     }
    //   }
    //   else if (args.eventName == 'url.external') {
    //     window.open(args.eventArgs.url, '_blank');
    //   }
    // });

    $done();
  }]);

})();
