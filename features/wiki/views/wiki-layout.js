(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-layout', [
    '$Layout', 'WikiService', '$component', '$data', '$done',
  function wikiLayoutController($Layout, WikiService, $component, $data, $done) {
    var WikiLayout = $component({
      data: $data
    });

    WikiService.onSafe('wikiLayoutController.teardown', function() {
      WikiLayout.teardown();
      WikiLayout = null;

      setTimeout(function() {
        WikiService.offNamespace('wikiLayoutController');
      });
    });

    WikiLayout.require().then($done);
  }]);

})();
