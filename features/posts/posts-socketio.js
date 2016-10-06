'use strict';

module.exports = function(PostModel, $io) {

  $io.on('connection', function() {
    PostModel.callPostsOpened();
  });

};
