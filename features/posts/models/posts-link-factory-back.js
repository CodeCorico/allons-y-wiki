module.exports = function() {
  'use strict';

  DependencyInjection.factory('postsLinkFactory', function(PostModel) {

    return function postsLinkFactory(currentPost, callback) {
      var postsLinksAll = {
        postsLinks: {},
        availablePosts: []
      };

      if (!currentPost || !currentPost.content) {
        return callback(null, postsLinksAll);
      }

      var async = require('async'),
          matchedPostLinks = currentPost.content.match(/<a[^>]+data-post-id="([a-z0-9]+)"([^>]*data-anchor-id="([a-z0-9]+)"){0,1}[^>]*>/gi),
          allPostIds = {};

      if (!matchedPostLinks) {
        return callback(null, postsLinksAll);
      }

      matchedPostLinks
        .map(function(link) {
          var matchedPostId = link.match(/data-post-id\=\"(.*?)\"/),
              postId = matchedPostId ? matchedPostId[1] : '',
              matchedAnchorId = link.match(/data-anchor-id\=\"(.*?)\"/),
              anchorId = matchedAnchorId ? matchedAnchorId[1] : '';

          allPostIds[postId] = allPostIds[postId] || [];

          if (allPostIds[postId].indexOf(anchorId) == -1) {
            allPostIds[postId].push(anchorId);
          }
        });

      async.mapSeries(Object.keys(allPostIds), function(id, nextID) {
        postsLinksAll.availablePosts.push(id);

        if (currentPost.id === id) {
          (currentPost.summary || []).forEach(function(summary) {
            if (allPostIds[id].indexOf('') != -1) {
              postsLinksAll.postsLinks[id + '#'] = currentPost.url + '#';
            }

            if (summary && summary.id && allPostIds[id].indexOf(summary.id) != -1) {
              postsLinksAll.postsLinks[id + '#' + summary.id] = currentPost.url + '#' + summary.name;
            }
          });

          nextID();
        }
        else {
          PostModel
            .findOne({
              id: id
            })
            .exec(function(err, post) {
              if (err || !post) {
                return nextID();
              }

              if (allPostIds[id].indexOf('') != -1) {
                postsLinksAll.postsLinks[id + '#'] = post.url + '#';
              }

              (post.summary || []).forEach(function(summary) {
                if (summary && summary.id && allPostIds[id].indexOf(summary.id) != -1) {
                  postsLinksAll.postsLinks[id + '#' + summary.id] = post.url + '#' + summary.name;
                }
              });

              nextID();
            });
        }
      }, function() {
        callback(null, postsLinksAll);
      });
    };
  });
};
