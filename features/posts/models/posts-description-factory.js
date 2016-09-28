module.exports = function() {
  'use strict';

  DependencyInjection.factory('postsDescriptionFactory', [function() {

    return function postsDescriptionFactory(content) {

      if (!content) {
        return null;
      }

      var match = content.match(/<p.*?>(.*?)<\/p>/i);

      if (!match || match.length < 2) {
        return null;
      }

      return match[1]
        .replace(/(<.*?>)/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ');
    };
  }]);
};
