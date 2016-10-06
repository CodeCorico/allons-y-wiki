(function() {
  'use strict';

  window.bootstrap([
    '$Page', '$BodyDataService', '$i18nService', '$done',
  function($Page, $BodyDataService, $i18nService, $done) {

    var _user = $BodyDataService.data('user') || null;

    if (_user && _user.permissionsPublic && _user.permissionsPublic.indexOf('wiki-access') > -1) {
      $Page.remember([
        /^\/wiki\/?$/,
        /^\/wiki\//
      ]);

      $Page.push('apps', {
        name: $i18nService._('Wiki'),
        select: function() {
          window.page('/wiki');
        }
      });
    }

    $done();
  }]);

})();
