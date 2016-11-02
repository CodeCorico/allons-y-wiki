(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-home', [
    'WikiService', '$component', '$data', '$done',
  function wikiHomeController(WikiService, $component, $data, $done) {
    var WikiHome = $component({
      data: $data
    });

    WikiService.onAsyncSafe('wikiHomeController.teardownWikiHome', function(args, callback) {
      WikiHome.teardown().then(callback);
    });

    WikiHome.on('teardown', function() {
      WikiHome = null;

      setTimeout(function() {
        WikiService.offNamespace('wikiHomeController');
      });
    });

    WikiHome.require().then($done);
  }]);

})();
