'use strict';

module.exports = [{
  event: 'update(web/route)',
  controller: function($socket, PostModel, $message) {
    if (!this.validMessage($message, {
      path: ['string']
    })) {
      return;
    }

    PostModel.postsOpened($socket, $message.path);
    PostModel.postsEdited($socket, false);
  }
}];
