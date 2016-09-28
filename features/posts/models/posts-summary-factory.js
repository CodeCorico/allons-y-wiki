module.exports = function() {
  'use strict';

  DependencyInjection.factory('postsSummaryFactory', ['webUrlFactory', function(webUrlFactory) {

    return function postsSummaryFactory(content) {

      if (!content) {
        return [];
      }

      var matchedPostHeaders = content.match(/<h([1-6])(.*?)<\/h([1-6])>/gi),
          postsSummary = [],
          postsSummaryNames = {};

      if (matchedPostHeaders) {
        postsSummary = matchedPostHeaders
          .filter(function(header) {
            return header
              .replace(/(<.*?>)/g, '')
              .replace(/&nbsp;/gi, ' ')
              .replace(/(\s+)/g, ' ')
              .trim();
          })
          .map(function(header) {
            var headerContent = header
                  .replace(/(<.*?>)/g, '')
                  .replace(/&nbsp;/gi, ' ')
                  .replace(/(\s+)/g, ' '),
                headerDataIds = header.match(/data-id\=\"(.*?)\"/),
                headerTypes = header.match(/<\s*(\w+).*?>/i),
                headerName = webUrlFactory(headerContent);

            var postSummary = {
              title: headerContent,
              id: headerDataIds ? headerDataIds[1] : '',
              name: headerName,
              type: headerTypes ? headerTypes[1] : ''
            };

            if (postsSummaryNames[headerName]) {
              postsSummaryNames[headerName]++;

              postSummary.name = postSummary.name + '-' + postsSummaryNames[headerName];
            }

            postsSummaryNames[headerName] = postsSummaryNames[headerName] || 1;

            return postSummary;
          });
      }

      return postsSummary;
    };
  }]);
};
