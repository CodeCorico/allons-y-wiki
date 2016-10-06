'use strict';

module.exports = [{
  urls: [
    '/wiki',
    '/wiki/create',
    '/wiki/:param/edit',
    '/wiki/:param'
  ],

  enter: [
    '$Page', '$i18nService', '$BodyDataService', '$FaviconService', '$Layout', '$context', '$next',
  function($Page, $i18nService, $BodyDataService, $FaviconService, $Layout, $context, $next) {
    var isWikiHomeUrl = /^\/wiki\/?$/.test($context.path),
        user = $BodyDataService.data('user'),
        hasWikiAccess = user.permissionsPublic.indexOf('wiki-access') > -1,
        hasWikiWrite = user.permissionsPublic.indexOf('wiki-write') > -1;

    if (!hasWikiAccess) {
      return $next();
    }

    document.title = $i18nService._('Wiki') + ' - ' + $Page.get('web').brand;

    $FaviconService.update('/public/wiki/favicon.png');

    $Layout.selectApp('Wiki', false);

    setTimeout(function() {
      require('/public/wiki/wiki-service.js').then(function() {

        var WikiService = DependencyInjection.injector.view.get('WikiService');

        require('/public/web/web-url-factory.js')
          .then(function() {
            return require('/public/posts/posts-summary-factory.js');
          })
          .then(function() {
            return new window.Ractive.Promise(function(fulfil) {
              if (WikiService.printRequired() || isWikiHomeUrl) {
                return fulfil();
              }

              WikiService.printRequired(true);

              var link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = '/public/wiki/wiki-post-print.css';
              link.media = 'print';
              link.onload = fulfil;
              document.getElementsByTagName('head')[0].appendChild(link);
            });
          })
          .then(function() {
            return $Layout.require('wiki-layout');
          })
          .then(function() {
            return WikiService.init();
          })
          .then(function() {
            return WikiService.inWikiHome(isWikiHomeUrl);
          })
          .then(function() {
            return $Layout.findChild('name', 'wiki-layout').require(
              isWikiHomeUrl ? 'wiki-home' : 'wiki-post'
            );
          })
          .then(function() {
            var pathArray = $context.path.split('/'),
                hash = $context.pathname.split('#'),
                lastDir = pathArray.pop(),
                originPath = window.location.protocol + '//' + window.location.host,
                prevUrl = WikiService.currentUrl();

            hash = hash.length > 1 ? hash[1] : null;

            WikiService.currentUrl($context.path);

            if (isWikiHomeUrl) {
              $Page.rightButtonRemove('wiki-details');
              $Layout.rightContext().closeIfGroupOpened('group-wiki-details');

              WikiService.home();
            }
            else {
              $Page.rightButtonAdd('wiki-details', {
                icon: 'fa fa-file-text',
                group: 'group-wiki-details',
                autoOpen: /^\/wiki\//,
                beforeGroup: function(context, $group, userBehavior, callback) {
                  context.require('wiki-details').then(callback);
                }
              });

              if ($context.path == '/wiki/create') {
                if (!hasWikiWrite) {
                  return window.page.redirect('/wiki');
                }

                WikiService.currentPath(originPath + pathArray.splice(0, 3).join('/') + '/');
                WikiService.createMode();
              }
              else if (lastDir == 'edit') {
                if (!hasWikiWrite) {
                  return window.page.redirect('/wiki/' + $context.params.param);
                }

                WikiService.currentPath(originPath + pathArray.splice(0, pathArray.indexOf($context.params.param)).join('/') + '/');
                WikiService.enterMode(WikiService.MODES.EDIT, $context.params.param);
              }
              else {
                if (prevUrl == WikiService.currentUrl()) {
                  WikiService.enterHash(hash);
                }
                else {
                  WikiService.enterMode(WikiService.MODES.SELECT, $context.params.param || null);
                }
              }
            }
          });
      });
    });
  }],

  exit: ['$Page', '$Layout', '$context', '$next', function($Page, $Layout, $context, $next) {
    if (window.page.doNothing) {
      window.page.doNothing = false;

      return;
    }

    require('/public/wiki/wiki-service.js').then(function() {
      var WikiService = DependencyInjection.injector.view.get('WikiService'),
          pathname = window.location.pathname,
          pathnameSplitted = pathname.split('/');

      if (!window.page.forceRedirection && WikiService.inEditUnsaved()) {

        if (pathnameSplitted && pathnameSplitted.length && pathnameSplitted[1] == 'wiki') {
          window.page.doNothing = true;
        }

        window.page.redirect($context.path);

        WikiService.exitConfirmation(function() {
          window.page.doNothing = false;
          window.page.forceRedirection = true;
          window.page(pathname);
        }, function() {
          window.page.doNothing = false;
        });

        return;
      }

      window.page.forceRedirection = false;

      if (!pathnameSplitted || pathnameSplitted.length < 2 || pathnameSplitted[1] != 'wiki') {
        $Layout.set('titleShowed', true);
        $Layout.rightContext().closeIfGroupOpened('group-wiki-details');
        $Page.rightButtonRemove('wiki-details');

        return WikiService.teardown(null, $next);
      }

      $next();
    });
  }]
}, {
  url: '*',
  priority: 0.5,

  enter: ['$Page', '$Layout', '$next', function($Page, $Layout, $next) {
    require('/public/wiki/wiki-service.js').then(function() {
      var WikiService = DependencyInjection.injector.view.get('WikiService');

      $Layout.set('titleShowed', true);
      $Layout.rightContext().closeIfGroupOpened('group-wiki-details');
      $Page.rightButtonRemove('wiki-details');

      WikiService.teardown(null, $next);
    });
  }]
}];
