(function() {
  'use strict';

  var tinymce = window.tinymce;

  tinymce.PluginManager.requireLangPack('emojis');
  tinymce.PluginManager.add('emojis', function(editor, pluginUrl) {

    var WikiService = DependencyInjection.injector.controller.get('WikiService'),
        _lastEmojiId = null,
        _toolbar = null,
        _node = null;

    function _fillEmojis(fromSetTimeout) {
      fromSetTimeout = fromSetTimeout === false ? false : true;

      if (!_toolbar || !_toolbar.panel || !_node) {
        return;
      }

      var emojis = [];

      for (var key in _node) {
        if (_node.hasOwnProperty(key) && key != 'id') {
          emojis.push({
            icon: key,
            count: _node[key].length
          });
        }
      }

      var $content = $(_toolbar.panel.$el.find('.mce-flow-layout-item.mce-first')[0]),
          $floatPanel = $content.parent().parent().parent().parent();

      if (!emojis.length) {
        $content.html('');

        return false;
      }

      emojis.sort(function(a, b) {
        return b.count - a.count;
      });

      $content.html(emojis.map(function(emoji) {
        return '<div class="emojis-emoji emojis-emoji-' + emoji.icon + '">' + emoji.count + '</div>';
      }).join(''));

      $floatPanel.css('display', '');

      var width = $content.outerWidth(),
          $parent = $content;

      for (var i = 0; i < 4; i++) {
        $parent = $parent.parent();
        $parent.css('width', width);
      }

      $parent.css({
        border: 'none',
        opacity: '0.9'
      });

      if (fromSetTimeout) {
        $parent.css('left', Math.floor($parent.offset().left + (38 / 2) - (width / 2)));
      }

      return true;
    }

    function _hasEmojis(element) {
      if (!element || !editor.getBody().contains(element)) {
        _lastEmojiId = null;

        return false;
      }

      var $element = $(element),
          emojiId = $element.attr('data-emoji');

      if (!emojiId) {
        _lastEmojiId = null;

        return false;
      }

      if (emojiId == _lastEmojiId) {
        return true;
      }

      _lastEmojiId = emojiId;

      var post = WikiService.lastReadPost();

      if (!post || !post.emojis || !post.emojis.nodes) {
        return false;
      }

      for (var i = 0; i < post.emojis.nodes.length; i++) {
        var node = post.emojis.nodes[i];

        if (node.id == emojiId) {
          if (editor.contextToolbars && editor.contextToolbars.length) {
            for (var j = 0; j < editor.contextToolbars.length; j++) {
              var toolbar = editor.contextToolbars[j];

              if (!toolbar || !toolbar.predicate || typeof toolbar.predicate != 'function') {
                return;
              }

              var predicateFunction = toolbar.predicate.toString().substr('function '.length);
              predicateFunction = predicateFunction.substr(0, predicateFunction.indexOf('('));

              if (predicateFunction == '_hasEmojis') {
                _toolbar = toolbar;
                _node = node;

                if (toolbar.panel) {
                  if (!_fillEmojis(false)) {
                    return false;
                  }
                }
                else {
                  _lastEmojiId = null;

                  setTimeout(_fillEmojis);
                }

                break;
              }
            }
          }

          return true;
        }
      }

      return false;
    }

    editor.addContextToolbar(_hasEmojis, 'image');

    editor.on('init', function() {
      document.getElementsByTagName('head')[0].appendChild(editor.dom.create('link', {
        rel: 'stylesheet',
        href: pluginUrl + '/css/emojis.css'
      }));
    });

  });

})();
