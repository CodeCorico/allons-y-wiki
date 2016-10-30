(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-home', [
    '$component', '$data', '$done',
  function wikiHomeController($component, $data, $done) {
    var WikiHome = $component({
      data: $data
    });

    WikiHome.require().then($done);
  }]);

})();
