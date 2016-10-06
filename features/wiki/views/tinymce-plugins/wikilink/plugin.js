(function() {
  'use strict';

  var tinymce = window.tinymce;

  tinymce.PluginManager.requireLangPack('wikilink');
  tinymce.PluginManager.add('wikilink', function(editor, pluginUrl) {

    var _this = this,
        _ = tinymce.util.I18n.translate,
        _lastValue = null,
        _win = null,
        _anchor = null,
        _onlyText = false,
        _text = '',
        _title = '',
        _href = '',
        _postId = null,
        _anchorId = null,
        _tabs = null,
        _summary = null,
        _nextSearchByPageId = false,
        $socket = DependencyInjection.injector.controller.get('$socket'),
        postsSummaryFactory = DependencyInjection.injector.controller.get('postsSummaryFactory'),
        WikiService = DependencyInjection.injector.controller.get('WikiService'),
        $search = null,
        $content = null,
        _postTemplate = [
          '<div class="wikilink-article {{cls}}" data-id="{{id}}" data-url="{{url}}"',
            'style="background-image: url(\'{{coverThumb}}\');"',
          '>',
            '<h3>{{title}}</h3>',
            '<div class="wikilink-article-summary-container">',
              '<div class="wikilink-article-summary">',
                '<ul>{{summary}}</ul>',
              '</div>',
            '</div>',
          '</div>'
        ].join(''),
        _postSummaryItemTemplate = [
          '<li class="type-{{type}}" data-id="{{id}}">{{title}}</li>'
        ].join('');

    function _search() {
      var searchArgs = {};

      if (_nextSearchByPageId) {
        searchArgs.id = _postId;
      }
      else {
        var value = $search.val().trim();

        if (!value || value.length < 2) {
          _lastValue = value;

          return _updateContent([]);
        }

        if (_lastValue === value) {
          return;
        }

        _lastValue = value;

        searchArgs.search = value;
      }

      $socket.once('read(posts/search)', function(args) {
        if (args.err) {
          return;
        }

        var searchOnlyOneArticle = !!(_nextSearchByPageId && args.posts && args.posts.length);

        _updateContent(args.posts, searchOnlyOneArticle);

        if (searchOnlyOneArticle) {
          var child = $content.children()[0];

          _selectPost.apply(child);

          if (_anchorId) {
            var $anchor = $(child).find('li[data-id="' + _anchorId + '"]');

            if ($anchor.length) {
              _selectAnchor.apply($anchor);
            }
          }
        }

        _nextSearchByPageId = false;
      });

      $socket.emit('call(posts/search)', searchArgs);
    }

    function _toggleSelectPost() {
      // jshint validthis:true

      if ($(this).hasClass('selected')) {
        _unselectPosts.apply(this);
      }
      else {
        _selectPost.apply(this);
      }
    }

    function _selectPost() {
      // jshint validthis:true

      _unselectPosts();

      var $this = $(this);

      $this.addClass('selected');

      _selectAnchor.apply($this.find('.wikilink-article-summary li')[0]);

      $this.find('.wikilink-article-summary-container').css(
        'height',
        $this.find('.wikilink-article-summary').outerHeight()
      );
    }

    function _unselectPosts() {
      $content.children()
        .removeClass('selected')
        .find('.wikilink-article-summary-container')
          .css('height', '');
    }

    function _selectAnchor(event) {
      // jshint validthis:true

      if (event) {
        event.stopPropagation();
      }

      var $this = $(this);

      if ($this.hasClass('selected')) {
        return;
      }

      _unselectAnchors.apply(this);

      $this.addClass('selected');
    }

    function _unselectAnchors() {
      // jshint validthis:true

      $(this).parent().children().removeClass('selected');
    }

    function _updateContent(posts, searchOnlyOneArticle) {
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id == _this.postId) {
          posts.splice(i, 1);

          break;
        }
      }

      posts.unshift({
        id: _this.postId,
        coverThumb: _this.postCoverThumb,
        url: null,
        title: null
      });

      if (searchOnlyOneArticle && posts.length > 1) {
        posts.splice(0, 1);
      }
      else {
        searchOnlyOneArticle = false;
      }

      var existsId = [];

      $content.children().each(function() {
        existsId.push($(this).data('id'));
      });

      $content.html(posts.map(function(post, i) {
        var isActiveArticle = i === 0 && !searchOnlyOneArticle,
            summaryItems = $.extend([], isActiveArticle ? _summary || [] : post.summary || []);

        summaryItems.unshift({
          id: '',
          type: 'h0',
          title: _('Top of the page')
        });

        return _postTemplate
          .replace(/{{id}}/g, post.id)
          .replace(/{{url}}/g, post.url)
          .replace(/{{title}}/g, (isActiveArticle ? '(' + _('This article') + ')' : post.titleFound)
            .replace(/{{before}}/g, '<strong>')
            .replace(/{{after}}/g, '</strong>')
          )
          .replace(/{{coverThumb}}/g, post.coverThumb || '/public/wiki/default-article.jpg')
          .replace(/{{cls}}/g, [
            existsId.indexOf(post.id) > -1 ? 'no-animation' : '',
            isActiveArticle ? 'actual' : ''
          ].join(' '))
          .replace(/{{summary}}/g, summaryItems.map(function(item) {
            return _postSummaryItemTemplate
              .replace(/{{id}}/g, item.id)
              .replace(/{{type}}/g, item.type)
              .replace(/{{title}}/g, item.title);
          }).join(''));
      }).join(''));

      $content.children()
        .click(_toggleSelectPost)
        .find('.wikilink-article-summary')
          .click(function(event) {
            event.stopPropagation();
          })
        .find('li')
          .click(_selectAnchor);
    }

    function _isOnlyTextSelected(anchor) {
      var html = editor.selection.getContent();

      // Partial html and not a fully selected anchor element
      if (/</.test(html) && (!/^<a [^>]+>[^<]+<\/a>$/.test(html) || html.indexOf('href=') == -1)) {
        return false;
      }

      if (anchor) {
        var nodes = anchor.childNodes;

        if (nodes.length === 0) {
          return false;
        }

        for (var i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].nodeType != 3) {
            return false;
          }
        }
      }

      return true;
    }

    function _openWindow() {
      _lastValue = null;

      _anchor = editor.dom.getParent(editor.selection.getNode(), 'a[href]');

      var $anchor = $(_anchor);

      _onlyText = _isOnlyTextSelected(_anchor);
      _postId = _anchor && $anchor.data('post-id') || null;
      _anchorId = _anchor && $anchor.data('anchor-id') || null;
      _summary = postsSummaryFactory(editor.getContent({
        format: 'raw'
      }));

      _text = _anchor ? (_anchor.innerText || _anchor.textContent) : editor.selection.getContent({
        format: 'text'
      });
      _title = _anchor ? $(_anchor).attr('title') : '',
      _href = _anchor ? editor.dom.getAttrib(_anchor, 'href') : '';

      var hrefSpecial = $anchor.length && $anchor.attr('href') || null;
      _href = hrefSpecial && (hrefSpecial.match(/^:\w+$/) || hrefSpecial.match(/^\/media\//)) ? hrefSpecial : _href;

      var winWidth = Math.min(editor.dom.getViewPort().w, 471) - 20;

      _win = editor.windowManager.open({
        title: _('Insert/Edit link'),
        bodyType: 'tabpanel',
        width: winWidth,
        height: Math.min(editor.dom.getViewPort().h, 650) - 150,
        classes: 'wikilink',
        body: [{
          title: _('Wiki page'),
          type: 'form',
          padding: 0,
          items: [{
            type: 'container',
            html: [
              '<div class="wikilink-container" style="width: ' + (winWidth - 2) + 'px;">',
                '<input class="wikilink-search" type="text" placeholder="' + _('search page name') + '" />',
                '<i class="wikilink-search-icon fa fa-search"></i>',
                '<div class="wikilink-content"></div>',
              '</div>'
            ].join('')
          }]
        }, {
          title: _('External'),
          type: 'form',
          items: [{
            name: 'href',
            type: 'filepicker',
            filetype: 'file',
            size: 40,
            label: _('Url'),
            value: !_postId ? _href : ''
          },  {
            name: 'title',
            type: 'textbox',
            label: _('Tooltip'),
            value: !_postId ? _title : ''
          }]
        }],
        onsubmit: function() {
          var unlink = false,
              attrs = null,
              isSpecialLink = false;

          if (_tabs.items()[0].visible()) {
            var $page = $content.find('.wikilink-article.selected'),
                $selection = $page.find('.selected');

            if (!$page.length) {
              unlink = true;
            }
            else {
              attrs = {
                href: '#',
                'data-post-id': $page.data('id'),
                'data-anchor-id': $selection.data('id') || null,
                target: ''
              };
            }
          }
          else {
            var data = _win.toJSON();

            if (!data.href) {
              unlink = true;
            }
            else {
              isSpecialLink = !!data.href.match(/^:\w+$/);
              isSpecialLink = isSpecialLink || !!data.href.match(/^\/media\//);

              if (!isSpecialLink) {
                if (!data.href.match(/^(https?:\/\/)|(ftps?:\/\/)/)) {
                  data.href = 'http://' + data.href.replace(/^\/+/, '');
                }
              }

              attrs = {
                href: data.href,
                title: data.title || '',
                target: '_blank'
              };
            }
          }

          if (unlink) {
            editor.execCommand('unlink');
          }
          else if (attrs) {
            if (_anchor) {
              editor.focus();

              editor.dom.setAttribs(_anchor, attrs);
            }
            else {
              attrs.id = '__mcenew';

              var content = _onlyText ? editor.dom.encode(_text) : editor.selection.getContent();

              editor.insertContent(editor.dom.createHTML('a', attrs, content));

              _anchor = editor.dom.get('__mcenew');
              $anchor = $(_anchor);
              editor.dom.setAttrib(_anchor, 'id', null);
            }

            if (_anchor) {
              if (attrs.href.match(/^:\w+$/)) {
                $anchor
                  .attr('data-mce-href', attrs.href)
                  .attr('href', attrs.href)
                  .removeAttr('target');
              }

              editor.selection.select(_anchor);
              editor.undoManager.add();
            }
          }

          _win.close();
        }
      });

      $search = $(_win.$el.find('.wikilink-search')[0]);
      $content = $(_win.$el.find('.wikilink-content')[0]);

      $search.keyup(_search);

      _tabs = _win.items()[0];

      if (_href && !_postId) {
        _tabs.activateTab(1);

        setTimeout(function() {
          $(_tabs.items()[1].items()[0].$el).find('input').focus();
        });
      }
      else {
        var searchText = _text ? _text.trim() : '';

        _nextSearchByPageId = !!_postId;

        $search.val(searchText);
        _search();

        setTimeout(function() {
          $search.focus();
          $search[0].setSelectionRange(0, $search.val().length);
        });
      }
    }

    editor.on('init', function() {
      document.getElementsByTagName('head')[0].appendChild(editor.dom.create('link', {
        rel: 'stylesheet',
        href: pluginUrl + '/css/wikilink.css'
      }));
    });

    editor.addButton('wikilink', {
      icon: 'link',
      tooltip: _('Insert/Edit link'),
      stateSelector: 'a[href]',
      onclick: _openWindow
    });

  });

})();
