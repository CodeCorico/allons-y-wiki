'use strict';

module.exports = [{

  event: 'call(tags/tags.autocomplete)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function(TrackerService, $socket, $message, TagModel) {
    if (!this.validMessage($message, {
      name: ['string', 'filled']
    })) {
      return;
    }

    TagModel.autocomplete($message.master, $message.name, $message.excludes, function(err, tags) {
      tags = err || !tags ? null : tags;

      $socket.emit('read(tags/tags.autocomplete)', {
        tags: tags
      });
    });

  }
}];
