'use strict';

module.exports = [{
  event: 'update(web/route)',
  controller: function(PostModel) {
    PostModel.callPostsOpened();
  }
}];
