(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-post', [
    '$Page', '$Layout', '$i18nService', '$ShortcutsService', '$BodyDataService', '$WebHelpService',
    'WikiService', 'webUrlFactory', 'postsSummaryFactory',
    '$component', '$data', '$done',
  function wikiPostController(
    $Page, $Layout, $i18nService, $ShortcutsService, $BodyDataService, $WebHelpService,
    WikiService, webUrlFactory, postsSummaryFactory,
    $component, $data, $done
  ) {
    var HEADERS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        HEADERS_SELECTORS = 'h1[data-id], h2[data-id], h3[data-id], h4[data-id], h5[data-id], h6[data-id]',
        LINKS_SELECTORS = 'a[data-post-id]',
        LINKS_SPECIALS = {
          ':help': _linkHelp,
          ':shortcuts': _linkShortcuts,
          ':feedback': _linkFeedback,
          ':changelog': _linkChangelog,
          ':profile': _linkProfile
        },
        REACTIONS_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, pre, img.can-zoom',
        EMOJIS = [{
          icon: 'up',
          label: 'like'
        }, {
          icon: 'heart',
          label: 'love'
        }, {
          icon: 'down',
          label: 'dislike'
        }, {
          icon: 'check',
          label: 'checked'
        }, {
          icon: 'question',
          label: 'what?'
        }, {
          icon: 'clap',
          label: 'bravo!'
        }, {
          icon: 'smile',
          label: 'smile'
        }, {
          icon: 'tongue',
          label: 'wink'
        }, {
          icon: 'wouah',
          label: 'wouah!'
        }, {
          icon: 'joy',
          label: 'haha'
        }],

        Texteditor = null,
        _user = $BodyDataService.data('user'),
        _newTitle = '',
        _editPostTitle = '',
        _editPostContent = '',
        _editPostUrl = '',
        _editPostStatus = '',
        _editPostCover = '',
        _editPostCoverLarge = '',
        _editPostTags = '',
        _$el = {
          window: $(window),
          body: $('body')
        },
        _contentEvent = null,
        _fromEdit = false,
        _imgFlyoutSize = null,
        _titlesPositions = [],
        _scrolls = null,
        _texteditorRequiring = false,
        _texteditorRequired = false,
        _mousewheelBinds = ('onwheel' in document || document.documentMode >= 9) ?
          ['wheel'] :
          ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll'];

    window.onbeforeunload = function() {
      if (WikiService.inEditUnsaved()) {
        return $i18nService._('You will lose your unsaved work!');
      }
    };

    function _saveShortcutFilter(e) {
      // ctrl + s
      return e.keyCode == 83 && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && WikiPost.get('editMode');
    }

    function _saveShortcut(e) {
      e = e.originalEvent ? e.originalEvent : e;

      e.preventDefault();
      e.stopPropagation();

      WikiPost.savePost();
    }

    function _bodyClick() {
      _clearEmojiMenu();
    }

    function _clearEmojiMenu() {
      if (WikiPost && (WikiPost.get('emojiMenuOpened') || WikiPost.get('emojiMenuTarget'))) {
        if (WikiPost.get('emojiMenuButton')) {
          $(WikiPost.get('emojiMenuButton')).removeClass('used');
        }

        WikiPost.set('emojiMenuTarget', null);
        WikiPost.set('emojiMenuOpened', null);
        WikiPost.set('emojiMenuLeft', 0);
        WikiPost.set('emojiMenuBottom', 0);
      }
    }

    function _linkHelp() {
      $WebHelpService.openHelp();
    }

    function _linkShortcuts() {
      $WebHelpService.openShortcuts();
    }

    function _linkFeedback() {
      $WebHelpService.openFeedback();
    }

    function _linkChangelog() {
      $WebHelpService.openChangelog();
    }

    function _linkProfile() {
      $Page.fire('openProfile');
    }

    function _toggleEmoji(button, event, target) {
      if (WikiPost.get('editMode') || WikiPost.get('post.locked')) {
        return;
      }

      WikiPost.set('emojiMenuTarget', target);

      WikiPost.fire('toggleEmoji', {
        node: button
      });
    }

    function _addReactionMenu(button, event, target) {
      if (WikiPost.get('emojiMenuTarget') == target) {
        event.preventDefault();
        event.stopPropagation();

        return;
      }

      if (WikiPost.get('emojiMenuOpened')) {
        setTimeout(function() {
          _addReactionMenu(button, event, target);
        });

        return;
      }

      event.preventDefault();
      event.stopPropagation();

      var $button = $(button),
          buttonWidth = $button.outerWidth(),
          buttonOffset = $button.offset(),
          $container = _$el.post.find('.wiki-post-switch-container'),
          containerHeight = $container.outerHeight(),
          containerOffset = $container.offset(),
          contentOffset = _$el.content.offset(),
          left = Math.min(contentOffset.left - containerOffset.left + _$el.content.outerWidth() - 230,
            Math.max(contentOffset.left - containerOffset.left,
              (buttonOffset.left - containerOffset.left) + (buttonWidth / 2) - (230 / 2)
            )
          ),
          bottom = containerHeight - (buttonOffset.top - containerOffset.top) + 10;

      $button.addClass('used');

      WikiPost.set('emojiMenuButton', button);
      WikiPost.set('emojiMenuTarget', target);
      WikiPost.set('emojiMenuLeft', left);
      WikiPost.set('emojiMenuBottom', bottom);
      WikiPost.set('emojiMenuOpened', 'show');
      setTimeout(function() {
        WikiPost.set('emojiMenuOpened', 'displayed');
      }, 350);
    }

    function _fillNodeEmojis(node, emojis, $this, after, specialCls) {
      var emojisToAdd = [];

      specialCls = specialCls.join(' ');

      EMOJIS.forEach(function(emoji) {
        if (node[emoji.icon] && node[emoji.icon].length) {
          var names = [];

          for (var i = 0; i < node[emoji.icon].length; i++) {
            names.push(emojis.members[node[emoji.icon][i]].name);
          }

          emojisToAdd.push({
            count: node[emoji.icon].length,
            emoji: emoji,
            contributing: _user.id && node[emoji.icon].indexOf(_user.id) > -1 || false,
            names: names
          });
        }
      });

      emojisToAdd.sort(function(a, b) {
        return b.count - a.count;
      });

      var i = -1;

      $this[after ? 'after' : 'append'](emojisToAdd.map(function(emoji) {
        i++;

        return [
          '<div ',
            'class="',
              'emoji emoji-', emoji.emoji.icon,
              ' ', (emoji.contributing ? 'contributing' : ''),
              ' ', (after && i === 0 ? 'after-first' : ''),
              ' ', specialCls,
              ' newEmoji',
            '"',
          '>',
            emoji.count,
            '<span>',
              '<strong>', emoji.emoji.label, '</strong>',
              emoji.names.join('<br />'),
            '</span>',
          '</div>'
        ].join('');
      }).join(''));

      var lastEmojiButton = _$el.content.find('.newEmoji:last')[0];

      _$el.content.find('.newEmoji')
        .removeClass('newEmoji')
        .click(function(event) {
          _toggleEmoji(this, event, $this[0]);
        });

      return lastEmojiButton;
    }

    function _applyReactions() {
      _$el.content.find('.add-reaction').remove();

      var emojis = WikiPost.get('post.emojis');

      _$el.content.find('.emoji').remove();

      _$el.content
        .find(REACTIONS_SELECTOR)
        .each(function() {
          var $this = $(this),
              tagName = $this.prop('tagName'),
              lastIsBr = $this.find(':last').prop('tagName') == 'BR',
              isEmpty = !!(tagName == 'P' && !after && !$this.text().trim()),
              liHasChildren = !!(tagName == 'LI' && $this.find(REACTIONS_SELECTOR).length),
              imgInTable = false,
              after = tagName == 'PRE' || tagName == 'IMG' || $this.hasClass('mceCover'),
              specialCls = [],
              $addReactionButton = $('<div class="add-reaction"></div>'),
              nodeId = $this.attr('data-emoji'),
              lastEmojiButton = null;

          if ($this.hasClass('mceCover')) {
            specialCls.push('after-mceCover');
          }

          if (lastIsBr && !isEmpty) {
            $this.find(':last').remove();
          }

          if (tagName == 'IMG') {
            var $tdParents = $this.parents('td');
            if ($tdParents.length) {
              imgInTable = true;
            }
            else {
              var $pParents = $this.parents('p');
              if ($pParents.length) {
                $($pParents[0]).css('text-align', 'center');
              }
            }
          }

          if (nodeId && emojis && emojis.total && emojis.nodes) {
            for (var nodeIndex = 0; nodeIndex < emojis.nodes.length; nodeIndex++) {
              var node = emojis.nodes[nodeIndex];

              if (node.id == nodeId) {
                lastEmojiButton = _fillNodeEmojis(node, emojis, $this, after, specialCls);

                break;
              }
            }
          }

          if (isEmpty || liHasChildren || imgInTable) {
            return;
          }

          if (after && !lastEmojiButton) {
            specialCls.push('after-first');
          }

          if (specialCls.length) {
            $addReactionButton.addClass(specialCls.join(' '));
          }

          if (after && lastEmojiButton) {
            $(lastEmojiButton).after($addReactionButton);
          }
          else if (after) {
            $this.after($addReactionButton);
          }
          else {
            $this.append($addReactionButton);
          }

          $addReactionButton.click(function(event) {
            _addReactionMenu(this, event, $this[0]);
          });

          $this
            .off('mouseenter')
            .on('mouseenter', function() {
              $addReactionButton.addClass('hover');
            })
            .off('mouseleave')
            .on('mouseleave', function() {
              $addReactionButton.removeClass('hover');
            });
        });
    }

    function _applyLinks() {
      var actualId = WikiPost.get('post.id');

      _$el.content.find('a').each(function() {
        var $this = $(this);

        if ($this.attr('data-post-id')) {
          return;
        }

        if (LINKS_SPECIALS[$this.attr('href')]) {
          $this
            .off('click')
            .click(function(event) {
              event.stopPropagation();
              event.preventDefault();

              LINKS_SPECIALS[$this.attr('href')]($this, event);
            });
        }
      });

      _$el.content.find(LINKS_SELECTORS).each(function() {
        var dataPostId = $(this).attr('data-post-id'),
            dataAnchorId = $(this).attr('data-anchor-id'),
            isActualPost = actualId == dataPostId,
            hrefAttribute = dataPostId + '#' + (dataAnchorId ? dataAnchorId : ''),
            wikiPostLinks = WikiPost.get('post.links');

        if (wikiPostLinks && wikiPostLinks[hrefAttribute]) {
          var $this = $(this),
              href = wikiPostLinks[hrefAttribute];

          if (isActualPost) {
            href = '#' + href.split('#')[1];
          }
          else if (href.indexOf('#') == href.length - 1) {
            href = href.substr(0, href.length - 1);
          }

          $this
            .attr('href', !isActualPost ? '/wiki/' + href : href)
            .removeAttr('data-post-id')
            .removeAttr('data-anchor-id');

          if (isActualPost) {
            $this.click(function(event) {
              _scrollToAnchor(href);

              event.preventDefault();
            });
          }
        }
      });
    }

    function _applyHeaderAnchorName() {
      var postSummaryObject = {};

      (WikiPost.get('post.summary') || []).forEach(function(summary) {
        if (summary && summary.id) {
          postSummaryObject[summary.id] = summary.name;
        }
      });

      _$el.content.find(HEADERS_SELECTORS).each(function() {
        var dataId = $(this).attr('data-id');
        $(this)
          .attr('id', postSummaryObject[dataId])
          .removeAttr('data-id');
      });
    }

    function _clickZoomImage() {
      // jshint validthis:true
      var $this = $(this);

      _$el.imgFlyout = $this.clone();

      _imgFlyoutSize = {
        width: $this.width(),
        height: $this.height()
      };

      var $flyoutBackground = $('<div />').addClass('wiki-post-flyout-background'),
          offset = $this.offset(),
          src = $this.attr('src')
            .replace('url(\'', '')
            .replace('\')', '')
            .trim(),
          thumb = src.match(/((-[0-9]+x[0-9]+)\.(jpg|png))/i);

      if (thumb && thumb.length > 3) {
        src = src.replace(thumb[0], '.' + thumb[3]);
      }

      _$el.imgFlyout
        .addClass('wiki-post-img-flyout')
        .css({
          top: offset.top,
          left: offset.left,
          width: _imgFlyoutSize.width,
          height: _imgFlyoutSize.height
        })
        .click(function() {
          _closeFlyout($flyoutBackground, $this, offset);
        });

      $flyoutBackground.click(function() {
        _closeFlyout($flyoutBackground, $this, offset);
      });

      _$el.body
        .append($flyoutBackground)
        .append(_$el.imgFlyout);

      $this.css('visibility', 'hidden');

      setTimeout(function() {
        if (!WikiPost) {
          return;
        }

        $Page.set('modal', true);

        $flyoutBackground.addClass('show');
        _resizeImgFlyout();

        setTimeout(function() {
          _$el.imageFlyoutHighDef = _$el.imgFlyout
            .clone()
            .attr('src', src)
            .click(function() {
              _closeFlyout($flyoutBackground, $this, offset);
            });

          _$el.body.append(_$el.imageFlyoutHighDef);
        }, 550);
      });
    }

    function _applyZoomImages() {
      if (!_$el.content) {
        return;
      }

      _$el.content.find('img').each(function() {
        var $img = $(this);

        if ($img.hasClass('mce-pagebreak')) {
          return;
        }

        $img
          .removeClass('can-zoom')
          .off('click', _clickZoomImage);

        if ($img.parents('a').length) {
          return;
        }

        $img
          .addClass('can-zoom')
          .click(_clickZoomImage);
      });
    }

    function _updateScrollbars() {
      if (!_scrolls) {
        return;
      }

      _scrolls.update();
    }

    function _updateActionsEvents() {
      if (!WikiPost.get('haspost')) {
        return;
      }

      var $actionsSpace = _$el.post.find('.wiki-post-actions-space');

      if (!$actionsSpace.length || $actionsSpace.data('mousewheelBinded')) {
        return;
      }

      $actionsSpace.data('mousewheelBinded', true);

      _mousewheelBinds.forEach(function(bind) {
        $actionsSpace.on(bind, function(event) {
          var cloneEvent = new window.WheelEvent(bind, event.originalEvent);

          if (document.createEvent) {
            _$el.scrolls[0].dispatchEvent(cloneEvent);
          }
          else {
            _$el.scrolls[0].fireEvent('on' + cloneEvent.eventType, cloneEvent);
          }
        });
      });
    }

    $ShortcutsService.register(
      WikiService.shortcutsGroup(),
      'wiki-s',
      'Ctrl + S',
      $i18nService._('Save article'),
      _saveShortcutFilter,
      _saveShortcut
    );

    function _changeCover(cover, coverLarge) {
      WikiPost.set('editPost.cover', cover);
      WikiPost.set('editPost.coverLarge', coverLarge);

      _hasModifications();

      _updateEditTitleSize();

      _resize();
    }

    function _scrollToAnchor(href) {
      var top = 0;

      if (href && href != '#') {
        var $target = _$el.content.find(href),
            $actions = _$el.post.find('.wiki-post-actions-space'),
            offsetTop = 0;

        if (!$target.length || !$actions.length) {
          return;
        }

        if ($Layout.get('contentMedia') != 'media-desktop') {
          offsetTop = 50;
        }

        top = $target.offset().top - _$el.article.offset().top - $actions.outerHeight() - offsetTop;
      }

      _$el.scrolls.animate({
        scrollTop: top
      }, 350, function() {
        window.location.hash = href;
        _$el.scrolls.scrollTop(top);

        _updateToolbarsPosition();
        _updateScrollbars();
      });
    }

    function _requireTexteditor(callback) {
      if (!WikiPost) {
        return;
      }

      if (_texteditorRequired) {
        if (callback) {
          callback();
        }

        return;
      }

      if (_texteditorRequiring) {
        setTimeout(function() {
          _requireTexteditor(callback);
        });

        return;
      }

      _texteditorRequiring = true;

      WikiPost.require('texteditor').then(function() {
        if (!WikiPost) {
          return;
        }

        Texteditor = WikiPost.findChild('name', 'texteditor');
        _$el.texteditor = _$el.post.find('.texteditor');
        _$el.editorToolbar = _$el.post.find('.texteditor .mce-toolbar-grp');
        _contentEvent = Texteditor.on('content', _contentChanged);

        Texteditor.editor.on('keydown', function(e) {
          if (_saveShortcutFilter(e)) {
            _saveShortcut(e);
          }
        });

        _texteditorRequired = true;

        if (callback) {
          callback();
        }

        WikiService.fire('texteditorRequired');
      });
    }

    var WikiPost = $component({
      data: $.extend(true, $data, {
        EMOJIS: EMOJIS,
        network: true,
        accessWrite: false,
        post: null,
        editMode: false,
        editPost: {
          title: '',
          content: ''
        },
        hasPost: false,
        hasModifications: false,
        saving: false,
        editConfirm: '',
        coverScrollingTop: 0,
        leftContextOpened: false,
        rightContextOpened: false,
        emojiMenuButton: null,
        emojiMenuTarget: null,
        emojiMenuOpened: false,
        emojiMenuBottom: 0,
        emojiMenuLeft: 0,

        displayAvatar: $Page.get('avatar'),

        activeStatus: function() {
          return this.get('editMode') || this.get('createMode') ? this.get('editPost.status') : this.get('post.status');
        }
      }),

      forceUnlockPost: function() {
        var id = WikiPost.get('post.id');
        if (!id) {
          return;
        }

        WikiService.forceUnlockPost(id);
      },

      askDeletePost: function() {
        var id = WikiPost.get('editPost.id');
        WikiService.tryDelete(id);
      },

      cancelAskDeletePost: function() {
        WikiPost.set('editConfirm', '');
      },

      editPost: function() {
        if (!WikiPost.get('network')) {
          return;
        }

        var url = WikiPost.get('post').url;
        if (!url) {
          return;
        }

        WikiService.editPost(url);

        _enableEdition();
      },

      savePost: function() {
        if (!WikiPost.get('hasModifications') || WikiPost.get('alreadyLocked')) {
          return;
        }

        WikiService.hasModifications(false);

        WikiPost.set('saving', true);
        WikiPost.set('hasModifications', false);
        WikiPost.set('editPost.urlChanged', false);

        WikiService.savePost({
          id: WikiPost.get('editPost.id'),
          title: WikiPost.get('editPost.title'),
          url: WikiPost.get('editPost.url'),
          content: Texteditor && !Texteditor.get('isPlaceholder') ? Texteditor.content() : '',
          status: WikiPost.get('editPost.status'),
          cover: WikiPost.get('editPost.cover'),
          tags: WikiPost.get('editPost.tags'),
        }, WikiPost.get('post.url'), function(err) {
          if (!err) {
            return;
          }

          WikiService.hasModifications(true);

          WikiPost.set('saving', false);
          WikiPost.set('hasModifications', true);
          WikiPost.set('editPost.urlChanged', true);

          setTimeout(function() {
            if (!WikiPost) {
              return;
            }

            _$el.titleInput.focus();
          });

          _saveError(err);
        });
      },

      cancelEditPost: function(confirm) {
        if (WikiPost.get('saving')) {
          return;
        }

        var id = WikiPost.get('editPost.id');

        if (WikiPost.get('hasModifications') && !confirm) {
          return WikiPost.set('editConfirm', 'ask-close');
        }

        WikiPost.set('editConfirm', '');

        var editConfirmCallback = WikiPost.get('editConfirmCallback');
        WikiPost.set('editConfirmCallback', null);
        WikiPost.set('editCancelCallback', null);

        WikiService.hasModifications(false);
        WikiPost.set('hasModifications', false);

        if (editConfirmCallback) {
          _disableSelection();
          _disableEdition();

          return editConfirmCallback();
        }

        if (!id) {
          _disableSelection();
          _disableEdition();

          return WikiService.clearMode(true);
        }

        _fromEdit = true;

        if (!WikiPost.get('network')) {
          _disableEdition();
        }

        WikiService.selectPost(WikiPost.get('post.url'));
      },

      cancelAskClosePost: function() {
        WikiPost.set('editConfirm', '');

        var editCancelCallback = WikiPost.get('editCancelCallback');
        WikiPost.set('editConfirmCallback', null);
        WikiPost.set('editCancelCallback', null);

        if (editCancelCallback) {
          return editCancelCallback();
        }
      },

      deletePost: function() {
        _deletePost();
      },

      changeCover: function() {
        if (!Texteditor || !Texteditor.editor || !WikiPost.get('editMode')) {
          return;
        }

        Texteditor.editor.filePickerParams = {
          isPostCover: true
        };

        var src = WikiPost.get('editPost.cover') || '',
            win = Texteditor.editor.windowManager.open({
              title: $i18nService._('Cover'),
              data: {
                src: src
              },
              body: [{
                type: 'label',
                text: $i18nService._('Add a cover image or set empty to remove it.'),
                classes: 'wiki-cover-help'
              }, {
                name: 'coverLarge',
                type: 'textbox',
                hidden: true
              }, {
                name: 'src',
                type: 'filepicker',
                filetype: 'image',
                label: 'Source',
                autofocus: true
              }],
              onClose: function() {
                Texteditor.editor.filePickerParams = null;
              },
              onSubmit: function() {
                Texteditor.editor.filePickerParams = null;

                var data = win.toJSON();

                if (data && typeof data.src != 'undefined' && data.src != src) {
                  if (!data.src) {
                    _changeCover(null, null);

                    return;
                  }

                  var results = Texteditor.editor.filePickerResults,
                      src = results && results.coverLarge || data.src;

                  $('<img />')
                    .load(function() {
                      _changeCover(data.src, src);
                    })
                    .attr('src', src);
                }

                win.close();
              }
            });
      }
    });

    _$el.body = $('body');
    _$el.post = $(WikiPost.el);
    _$el.postContainer = _$el.post.find('.wiki-post-container');
    _$el.article = _$el.post.find('.wiki-post');
    _$el.scrolls = $(_$el.post.find('.pl-scrolls')[0]);
    _$el.content = _$el.post.find('.wiki-post-content');
    _$el.titleInput = _$el.post.find('.wiki-post-title-input');
    _$el.permalinkInput = _$el.post.find('.wiki-post-permalink-input');
    _$el.textSelector = _$el.post.find('.text-selector');

    _$el.body.click(_bodyClick);

    _$el.titleInput.keydown(function(e) {
      if (_saveShortcutFilter(e)) {
        _saveShortcut(e);
      }
    });

    _$el.textSelector.click(function() {
      if (Texteditor) {
        Texteditor.focusEnd();
      }
    });

    _$el.permalinkInput.keydown(function(e) {
      if (_saveShortcutFilter(e)) {
        _saveShortcut(e);
      }
    });

    function _saveError(err, callback) {
      WikiPost.set('saveError', err);
      WikiPost.set('editConfirm', 'error-save');
      setTimeout(function() {
        if (!WikiPost) {
          return;
        }

        WikiPost.set('editConfirm', '');

        if (callback) {
          callback();
        }
      }, 3000);
    }

    function _updateCovers() {
      if (_$el.content) {
        var $switchContainer = _$el.post.find('.wiki-post-switch-container'),
            margin = ($switchContainer.outerWidth() - _$el.content.width()) / 2;

        _$el.content.find('.mceCover').css({
          'margin-left': -margin,
          'margin-right': -margin
        });
      }
    }

    function _cacheTitlesPositions() {
      var top = _$el.article.offset().top,
          actionHeight = _$el.post.find('.wiki-post-actions-space').outerHeight();

      _titlesPositions = [];

      _$el.content.find('h1, h2, h3, h4').each(function() {
        var $this = $(this);

        _titlesPositions.push({
          name: $this.attr('id'),
          top: $this.offset().top - top - actionHeight
        });
      });

      if (_titlesPositions.length && !WikiService.titleSelected()) {
        WikiService.titleSelected('#');
      }
    }

    function _updateTitleSelected() {
      if (!_titlesPositions.length) {
        return;
      }

      var scrollTop = _$el.scrolls.scrollTop(),
          title = null,
          contentMedia = $Layout.get('contentMedia'),
          maxTop = contentMedia != 'media-desktop' ? 50 : 0;

      for (var i = 0; i < _titlesPositions.length; i++) {
        if (_titlesPositions[i].top - 10 - maxTop <= scrollTop) {
          title = _titlesPositions[i];
        }
        else {
          break;
        }
      }

      if (!title) {
        title = {
          name: '#'
        };
      }

      WikiService.titleSelected(title.name);
    }

    function _resize() {
      _updateToolbarsPosition();

      if (_$el.imgFlyout) {
        _resizeImgFlyout();
      }

      _$el.post.find('.wiki-post-headband').css(
        'margin-top',
        _$el.editorToolbar && WikiPost.get('editorShow') ? _$el.editorToolbar.outerHeight() : ''
      );

      _updateCovers();

      _updateScrollbars();

      _cacheTitlesPositions();
    }

    function _updateToolbarsPosition() {
      var $actionsSpace = _$el.post.find('.wiki-post-actions-space'),
          $actionsSpaceBack = _$el.post.find('.wiki-post-actions-space-back'),
          $switchContainer = _$el.post.find('.wiki-post-switch-container');

      if (!$actionsSpace.length) {
        return;
      }

      var top = $switchContainer.offset().top,
          contentMedia = $Layout.get('contentMedia'),
          maxTop = contentMedia != 'media-desktop' ? 50 : 0;

      $actionsSpace.css('top', top > maxTop ? top : '');
      $actionsSpaceBack.css('top', top > 0 ? top : '');

      if (_$el.editorToolbar) {
        _$el.editorToolbar.css('top', top > maxTop ? top + $actionsSpace.outerHeight() : '');
      }
    }

    function _generateSummary(content, title) {
      WikiService.editSummary(postsSummaryFactory(content), title);
    }

    _$el.scrolls.scroll(function() {
      _updateToolbarsPosition();

      WikiPost.set('coverScrollingTop', _$el.scrolls.scrollTop() * 0.5);

      _updateTitleSelected();

      _$el.content.find('.mceCover').each(function() {
        var $this = $(this),
            viewHeight = _$el.postContainer.outerHeight(),
            top = $this.offset().top,
            height = $this.height(),
            positionTop = 0,
            moveMax = -200;

        if (top + height >= 0 && top <= viewHeight) {
          positionTop = Math.round(top * moveMax / viewHeight);
        }
        $this.css('background-position', 'center ' + positionTop + 'px');
      });

      if (WikiPost.get('editMode') && Texteditor && Texteditor.editor) {
        Texteditor.editor.fire('ResizeWindow');
      }
    });

    _$el.window.resize(_resize);

    function _editContent(content) {
      WikiPost.set('editPost.content', content);

      if (Texteditor) {
        Texteditor.editor.setContent(content);
        Texteditor.editor.undoManager.clear();
      }
    }

    function _contentChanged(args) {
      _updateToolbarsPosition();

      var content = Texteditor.get('isPlaceholder') ? '' : args.content;

      if (WikiPost.get('editMode') && content != _editPostContent) {
        _hasModifications();

        _updateScrollbars();

        if (args.element && args.element.tagName && HEADERS.indexOf(args.element.tagName.toLowerCase()) > -1) {
          _generateSummary(content, WikiPost.get('editPost.title'));
        }
      }
    }

    function _disableSelection() {
      WikiPost.set('haspost', false);
      WikiPost.set('post.id', null);
      WikiPost.set('post.title', '');
      WikiPost.set('post.cover', '');
      WikiPost.set('post.coverLarge', '');
      WikiPost.set('post.content', '');
      WikiPost.set('post.url', '');
      WikiPost.set('post.status', 'draft');

      _updateScrollbars();
    }

    function _enableEdition() {
      _requireTexteditor(function() {
        var scrollTop = _$el.scrolls.scrollTop();

        WikiService.hasModifications(false);

        WikiPost.set('hasModifications', false);
        WikiPost.set('saving', false);
        WikiPost.set('editPost.id', WikiPost.get('post.id'));

        var editPostTitle = _stripTitleHTML(WikiPost.get('post.title')),
            editPostUrl = webUrlFactory(WikiPost.get('post.url')),
            editPostStatus = WikiPost.get('post.status'),
            editPostCover = WikiPost.get('post.cover'),
            editPostCoverLarge = WikiPost.get('post.coverLarge'),
            editPostCoverThumb = WikiPost.get('post.coverThumb'),
            editPostTags = WikiPost.get('post.tags');

        _editPostContent = WikiPost.get('post.content');

        _editContent(_editPostContent);

        Texteditor.editor.plugins.wikilink.postId = WikiPost.get('post.id');
        Texteditor.editor.plugins.wikilink.postCoverThumb = editPostCoverThumb;

        _editPostTitle = editPostTitle;
        _editPostUrl = editPostUrl;
        _editPostStatus = editPostStatus;
        _editPostCover = editPostCover;
        _editPostCoverLarge = editPostCoverLarge;
        _editPostTags = editPostTags;

        WikiPost.set('editPost.title', _editPostTitle);
        WikiPost.set('editPost.url', _editPostUrl);
        WikiPost.set('editPost.urlChanged', false);
        WikiPost.set('editPost.status', _editPostStatus);
        WikiPost.set('editPost.cover', _editPostCover);
        WikiPost.set('editPost.coverLarge', _editPostCoverLarge);
        WikiPost.set('editPost.tags', _editPostTags);

        WikiPost.set('editMode', true);
        $Layout.set('titleShowed', false);

        WikiPost.set('editorShow', true);
        WikiPost.set('editorShowLoading', true);

        _updateEditTitleSize();

        _resize();

        _generateSummary(Texteditor.content(), _editPostTitle);

        setTimeout(function() {
          if (!WikiPost || !WikiPost.get('editMode')) {
            return;
          }

          _updatePermalinkInputSize();
        });

        setTimeout(function() {
          if (!WikiPost || !WikiPost.get('editMode')) {
            return;
          }

          WikiPost.set('contentHide', true);
          WikiPost.set('editorShowLoading', false);
          _resize();

          _updateToolbarsPosition();

          Texteditor.editor.nodeChanged();

          if (WikiPost.get('createMode')) {
            WikiService.hasModifications(false);
            WikiPost.set('hasModifications', false);
          }

          setTimeout(function() {
            if (!WikiPost || !WikiPost.get('editMode')) {
              return;
            }

            if (WikiPost.get('createMode')) {
              _$el.titleInput.focus();
            }
            else {
              _$el.scrolls.scrollTop(scrollTop);
            }

            _updateScrollbars();
          });
        }, 550);
      });
    }

    function _disableEdition() {
      WikiPost.set('editorShow', false);
      WikiPost.set('contentHide', false);
      WikiPost.set('editMode', false);
      WikiPost.set('alreadyLocked', false);

      _resize();

      setTimeout(function() {
        if (!WikiPost) {
          return;
        }

        $Layout.set('titleShowed', true);
        WikiPost.set('createMode', false);
        WikiPost.set('editPost.id', null);
        WikiPost.set('editPost.title', '');
        WikiPost.set('editPost.url', '');
        WikiPost.set('editPost.urlChanged', false);
        WikiPost.set('editPost.status', '');
        _editContent('');

        setTimeout(function() {
          if (!WikiPost) {
            return;
          }

          _updateToolbarsPosition();

          _cacheTitlesPositions();
        }, 550);
      });
    }

    function _hasModifications() {
      WikiService.hasModifications(true);

      WikiPost.set('hasModifications', true);
      WikiPost.set('saving', false);
      _editPostTitle = _stripTitleHTML(WikiPost.get('post.title'));
      _editPostUrl = WikiPost.get('post.url') ? webUrlFactory(WikiPost.get('post.url')) : webUrlFactory(_editPostTitle);
      _editPostContent = Texteditor.content();
      _editPostStatus = WikiPost.get('editPost.status');
      _editPostCover = WikiPost.get('editPost.cover');
      _editPostCoverLarge = WikiPost.get('editPost.coverLarge');
      _editPostTags = WikiPost.get('editPost.tags');

      Texteditor.editor.plugins.wikilink.postCover = _editPostCover;
    }

    function _stripTitleHTML(content) {
      return content
        .replace(/<br\s+\/>/g, '\n')
        .replace(/(<\/?[a-zA-Z]+.*?>)/g, '');
    }

    function _closeFlyout($flyoutBackground, $img, offset) {
      $flyoutBackground.removeClass('show');
      if (_$el.imageFlyoutHighDef) {
        _$el.imageFlyoutHighDef.remove();
        _$el.imageFlyoutHighDef = null;
      }

      _$el.imgFlyout.css({
        top: offset.top,
        left: offset.left,
        width: _imgFlyoutSize.width,
        height: _imgFlyoutSize.height
      });

      $Page.set('modal', false);

      setTimeout(function() {
        if (!WikiPost) {
          return;
        }

        $img.css('visibility', '');
        _$el.imgFlyout.remove();
        $flyoutBackground.remove();
        _$el.imgFlyout = null;
        _imgFlyoutSize = null;
      }, 550);
    }

    function _resizeImgFlyout() {
      var windowSize = {
            width: _$el.window.width(),
            height: _$el.window.height()
          },
          ratio = Math.min(windowSize.width / _imgFlyoutSize.width, windowSize.height / _imgFlyoutSize.height),
          width = _imgFlyoutSize.width * ratio,
          height = _imgFlyoutSize.height * ratio,
          top = (windowSize.height - height) / 2,
          left = (windowSize.width - width) / 2;

      _$el.imgFlyout
        .addClass('show')
        .css({
          top: top,
          left: left,
          width: width,
          height: height
        });

      if (_$el.imageFlyoutHighDef) {
        _$el.imageFlyoutHighDef.css({
          top: top,
          left: left,
          width: width,
          height: height
        });
      }
    }

    WikiService.onSafe('wikiPostController.wantSave', function() {
      WikiPost.savePost();
    });

    WikiService.onSafe('wikiPostController.hasModifications', function() {
      _hasModifications();
    });

    WikiService.onSafe('wikiPostController.scrollToAnchor', function(args) {
      _scrollToAnchor(args.anchor);
    });

    WikiService.onSafe('wikiPostController.networkChanged', function(args) {
      if (!args.network) {
        WikiPost.set('post.locked', false);
      }

      WikiPost.set('network', args.network);
    });

    WikiService.onSafe('wikiPostController.alreadyLocked', function(args) {
      WikiPost.set('alreadyLocked', {
        id: args.id,
        avatarMini: args.locked.avatarMini,
        user: args.locked.firstname + ' ' + args.locked.lastname
      });
    });

    WikiService.onSafe('wikiPostController.postsInEdition', function(args) {
      if (!WikiPost) {
        return;
      }

      var alreadyLocked = WikiPost.get('alreadyLocked');

      if (alreadyLocked && alreadyLocked.id && !args.postsInEdition[alreadyLocked.id]) {
        WikiPost.set('alreadyLocked', false);

        WikiService.lockPost(alreadyLocked.id);
      }
    });

    WikiService.onSafe('wikiPostController.postSelectedTitleChanged', function(args) {
      _newTitle = args.title;
    });

    WikiService.onSafe('wikiPostController.exitConfirmation', function(args) {
      WikiPost.set('editConfirmCallback', args.confirmCallback);
      WikiPost.set('editCancelCallback', args.cancelCallback);
      WikiPost.set('editConfirm', 'ask-close');
    });

    function _readPost(args) {
      if (!WikiPost) {
        return;
      }

      args = $.extend(true, {}, args || {});

      WikiPost.set('disableEdition', false);

      var editMode = WikiPost.get('editMode'),
          editId = WikiPost.get('editPost.id');

      WikiPost.set('searchPosts', null);

      if (args.error || !args.post) {
        if (editMode || (args._message && args._message.post && !args._message.post.id)) {
          return;
        }

        WikiPost.set('saving', false);
        WikiPost.set('disableEdition', true);

        if (editMode) {
          WikiPost.set('editConfirm', '');

          var id = WikiPost.get('editPost.id');
          if (!id) {
            return WikiService.clearMode();
          }

          WikiService.selectPost(id);

          return;
        }

        if (args.error && args.error == 'not exists') {
          var title = args.url
            .replace(/-+/g, ' ')
            .toLowerCase()
            .trim();

          title = title.charAt(0).toUpperCase() + title.slice(1);

          args.post = {
            in404: true,
            id: null,
            title: '« ' + title + ' »',
            content: '',
            url: args.url,
            cover: '',
            coverLarge: '',
            status: 'published'
          };

          args.searchPosts = args.searchPosts || [];
          args.searchPosts.forEach(function(post) {
            post.cover = post.cover || '/public/wiki/default-article.jpg';
          });

          WikiPost.set('searchPosts', args.searchPosts);
        }
        else {
          args.post = {
            inError: true,
            error: args.error,
            id: args._message && args._message.id ? args._message.id : null,
            title: WikiPost.get('post.title'),
            content: '',
            status: 'published'
          };
        }

        args.selected = args.isOwner;

        delete args.error;
      }

      var wasInError = !args.post.inError && WikiPost.get('post.inError');

      if (editMode && !editId && args.isOwner) {
        editId = args.post.id;
        WikiPost.set('editPost.id', args.post.id);
        WikiPost.set('post.id', null);
        WikiPost.set('editPost.url', args.post.url);
        WikiPost.set('editPost.status', args.post.status);
        _updatePermalinkInputSize();
        args.selected = true;
        WikiService.editMode(editId, false);
        WikiPost.set('createMode', false);
        WikiPost.set('contentHide', true);
        WikiPost.set('displayContent', true);
      }

      if (editMode && args.post.id === editId && args.post.url != WikiPost.get('editPost.url')) {
        var hasModifications = WikiPost.get('hasModifications');
        WikiPost.set('editPost.url', args.post.url);
        _updatePermalinkInputSize();

        WikiService.hasModifications(hasModifications);
        WikiPost.set('hasModifications', hasModifications);
      }

      if (args.deleted && !args.isOwner) {
        if (WikiPost.get('post.id') == args.post.id || WikiPost.get('editPost.id') == args.post.id) {
          _deletePost(false);
        }

        return;
      }

      if (!args.selected) {
        return;
      }

      _clearEmojiMenu();

      if (wasInError) {
        var contentWaiting = args.post.content,
            statusWaiting = args.post.status;

        WikiPost.set('disableEdition', true);
        args.post.wasInError = true;
        args.post.content = '';
        args.post.status = 'published';

        WikiPost.set('post', args.post);
        WikiPost.set('currentPath', WikiService.currentPath());

        setTimeout(function() {
          if (!WikiPost) {
            return;
          }

          WikiPost.set('displayContent', false);

          setTimeout(function() {
            args.post.content = contentWaiting;
            args.post.status = statusWaiting;
            args.post.wasInError = false;

            _readPost(args);

            WikiPost.set('displayContent', true);
          }, 550);
        }, 4000);

        return;
      }

      var oldPostId = WikiPost.get('post');
      oldPostId = oldPostId && oldPostId.id ? oldPostId.id : null;

      if (args.isOwner && args.locked && args.post.locked) {
        delete args.post.locked;
      }

      args.post.lastUpdatedDate = null;

      if (args.post.contributors && args.post.contributors.length) {
        args.post.contributors.sort(function(a, b) {
          return window.moment(b.modifiedAt) - window.moment(a.modifiedAt);
        });

        args.post.lastUpdatedDate = window.moment(args.post.contributors[0].modifiedAt).format('DD/MM/YYYY hh:mm a');
      }

      args.post.status = args.post.status || 'draft';
      WikiPost.set('post', args.post);
      WikiPost.set('currentPath', WikiService.currentPath());

      if (editMode && editId && editId == args.post.id) {
        WikiPost.set('saving', false);

        _applyLinks();

        _applyHeaderAnchorName();

        _applyZoomImages();

        _applyReactions();

        _resize();

        return;
      }

      if (args.emojiAdded) {
        args.emojiAdded.opened = true;
        WikiPost.set('emojiAdded', args.emojiAdded);

        setTimeout(function() {
          if (!WikiPost) {
            return;
          }

          WikiPost.set('emojiAdded.opened', false);

          setTimeout(function() {
            if (!WikiPost) {
              return;
            }

            WikiPost.set('emojiAdded', null);
          }, 550);
        }, 4550);
      }

      if (WikiService.mode() == WikiService.MODES.SELECT && oldPostId && oldPostId == args.post.id) {
        _applyLinks();

        _applyHeaderAnchorName();

        _applyZoomImages();

        _applyReactions();

        _updateEditTitleSize();

        _resize();

        if (!args.isOwner && WikiPost.get('post.locked')) {
          WikiPost.set('lockedEdited', true);

          setTimeout(function() {
            if (!WikiPost) {
              return;
            }

            WikiPost.set('lockedEdited', false);
          }, 2350);
        }

        return;
      }

      if (
        !_fromEdit &&
        (!args.post || !args.post.inError) &&
        (!args.isOwner || !args.enterMode || args.enterMode != 'edit')
      ) {
        WikiPost.set('displayContent', false);
        _$el.scrolls.scrollTop(0);

        setTimeout(function() {
          if (window.location.hash) {
            _scrollToAnchor(window.location.hash);
          }
        }, 1200);
      }

      _fromEdit = false;

      setTimeout(function() {
        if (!WikiPost) {
          return;
        }

        WikiPost.set('oldTitle', '');
        WikiPost.set('storyboard', '');

        _applyLinks();

        _applyHeaderAnchorName();

        _applyZoomImages();

        _applyReactions();

        _updateCovers();

        WikiPost.set('displayContent', true);

        setTimeout(function() {
          if (!WikiPost) {
            return;
          }

          _updateScrollbars();

          _cacheTitlesPositions();
        }, 550);

        WikiPost.fire('postLoaded', {
          post: args.post
        });
      }, 550);
    }

    WikiService.onSafe('wikiPostController.readPost', _readPost);

    function _readPostLock(args) {
      var post = WikiPost.get('post');

      if (post && post.id == args.post.id) {
        WikiPost.set('post.locked', args.post.locked);
      }
    }

    WikiService.onSafe('wikiPostController.readPostLock', _readPostLock);

    function _readPostUnlock(args) {
      if (!WikiPost) {
        return;
      }

      var post = WikiPost.get('post');

      if (post && post.id == args.id && WikiService.mode() == WikiService.MODES.EDIT && args.force) {
        WikiPost.cancelEditPost(true);
      }

      if (post && post.id == args.id && WikiService.mode() != WikiService.MODES.EDIT) {
        WikiPost.set('post.locked', false);

        if (!args.isOwner) {
          WikiPost.set('editBack', true);

          setTimeout(function() {
            if (!WikiPost) {
              return;
            }

            WikiPost.set('editBack', false);
          }, 450);
        }
      }
    }

    WikiService.onSafe('wikiPostController.readPostUnlock', _readPostUnlock);

    function _selectMode(args, callback, noAnimation) {
      WikiPost.set('editConfirm', '');

      _disableEdition();

      WikiPost.set('haspost', !!args.id);
      _updateActionsEvents();

      var oldPost = WikiPost.get('post');
      if (oldPost) {
        if (args.id == oldPost.id || args.id == oldPost.url) {
          if (callback) {
            callback();
          }

          return;
        }

        WikiPost.set('post.status', 'loading');
        WikiPost.set('oldTitle', oldPost.title);
      }

      WikiPost.set('post.id', null);
      WikiPost.set('post.title', _newTitle);
      WikiPost.set('post.locked', false);
      WikiPost.set('post.content', '');
      _newTitle = '';

      WikiPost.set('storyboard', 'sb-open-1');

      _updateToolbarsPosition();

      if (args.id && noAnimation) {
        if (callback) {
          callback();
        }

        return;
      }

      setTimeout(function() {
        if (!WikiPost) {
          return;
        }

        WikiPost.set('storyboard', 'sb-open-2');

        setTimeout(function() {
          if (!WikiPost) {
            return;
          }

          WikiPost.set('oldTitle', '');
          WikiPost.set('storyboard', '');

          _updateScrollbars();

          if (callback) {
            callback();
          }
        }, 550);
      });
    }

    WikiService.onSafe('wikiPostController.selectMode', _selectMode);

    function _editMode(args) {
      if (WikiPost.get('editMode')) {
        return;
      }

      _selectMode(args, function() {
        var event = WikiPost.on('postLoaded', function() {
          event.cancel();
          event = null;

          if (WikiService.mode() != WikiService.MODES.EDIT) {
            return;
          }

          _enableEdition();
        });
      }, true);
    }

    WikiService.onSafe('wikiPostController.editMode', _editMode);

    function _createMode() {
      WikiPost.set('createMode', true);
      WikiPost.set('editConfirm', '');
      WikiPost.set('post.inError', false);
      WikiPost.set('post.error', null);
      WikiPost.set('post.in404', false);

      _disableSelection();

      WikiPost.set('haspost', true);
      _updateActionsEvents();
      WikiPost.set('currentPath', WikiService.currentPath());

      _enableEdition();

      setTimeout(function() {
        _$el.titleInput.focus();
      });
    }

    WikiService.onSafe('wikiPostController.createMode', _createMode);

    function _readPostTryDelete(args) {
      if (!args) {
        return;
      }

      WikiPost.set('tryDeletedArticleLinkedCount', args.count);
      WikiPost.set('editConfirm', 'ask-delete');
    }

    WikiService.onSafe('wikiPostController.readPostTryDelete', _readPostTryDelete);

    function _deletePost(isOwner) {
      isOwner = typeof isOwner == 'undefined' ? true : isOwner;

      WikiPost.set('editConfirm', '');

      var id = WikiPost.get('editPost.id');
      if (isOwner && !id) {
        return;
      }

      WikiPost.set('containerStoryboard', 'sb-delete-1');
      setTimeout(function() {
        if (!WikiPost) {
          return;
        }

        WikiPost.set('containerStoryboard', 'sb-delete-2');
        setTimeout(function() {
          if (!WikiPost) {
            return;
          }

          _disableSelection();
          _disableEdition();

          setTimeout(function() {
            if (!WikiPost) {
              return;
            }

            WikiPost.set('containerStoryboard', false);

            WikiService.clearMode(true);

            if (isOwner) {
              WikiService.deletePost(id);
            }
          }, 350);
        }, 300);
      }, 250);
    }

    WikiPost.observe('editPost.title', function(value) {
      if (WikiPost.get('editMode')) {
        if (_editPostTitle != _stripTitleHTML(value)) {
          _hasModifications();

          _generateSummary(Texteditor.content(), WikiPost.get('editPost.title'));
        }
      }

      _updateEditTitleSize();
    }, {
      defer: true
    });

    function _updateEditTitleSize() {

      var display = _$el.titleInput.css('display');

      _$el.titleInput
        .css({
          display: display == 'none' ? 'block' : '',
          visibility: display == 'none' ? 'hidden' : '',
          'min-height': 0,
          height: 0
        })
        .css({
          display: '',
          visibility: '',
          'min-height': '',
          height: _$el.titleInput.get(0).scrollHeight
        });

      _updateScrollbars();
    }

    function _getScrollLeftAndScrollWidth(inputElement) {
      var range = inputElement.createTextRange(),
          inputStyle = window.getComputedStyle(inputElement),
          paddingLeft = parseFloat(inputStyle.paddingLeft),
          paddingRight = parseFloat(inputStyle.paddingRight),
          rangeRect = range.getBoundingClientRect();

      return Math.max(inputElement.clientWidth, paddingLeft + (rangeRect.right - rangeRect.left) + paddingRight);
    }

    function _updatePermalinkInputSize() {
      _$el.permalinkInput.css('width', 0);

      var width = _$el.permalinkInput.get(0).scrollWidth;

      if (navigator.browser.name == 'IE') {
        width = _getScrollLeftAndScrollWidth(_$el.permalinkInput.get(0));
      }

      _$el.permalinkInput.css('width', Math.max(100, width));
    }

    function _leftContextOpened(args) {
      WikiPost.set('leftContextOpened', args.opened);
    }

    function _rightContextOpened(args) {
      WikiPost.set('rightContextOpened', args.opened);
    }

    WikiPost.observe('editPost.url', function(value) {
      if (WikiPost.get('editMode')) {
        var valueCleaned = webUrlFactory(value);
        if (!WikiPost.get('createMode') && _editPostUrl != valueCleaned) {
          WikiPost.set('editPost.urlChanged', true);
          WikiPost.set('editPost.url', valueCleaned);
          _hasModifications();
        }
      }

      _updatePermalinkInputSize();
    });

    _$el.titleInput.keydown(function(e) {
      if (e.keyCode == 13) {
        e.preventDefault();

        return false;
      }
    });

    _$el.permalinkInput.keydown(function(e) {
      if (e.keyCode == 13) {
        e.preventDefault();

        return false;
      }
    });

    WikiPost.observe('editPost.status', function(status) {
      if (WikiPost.get('editMode')) {
        if (_editPostStatus !== status) {
          _hasModifications();

          setTimeout(function() {
            _updateScrollbars();
            _cacheTitlesPositions();
          }, 550);
        }
      }
    });

    WikiPost.on('toggleEmoji', function(event) {
      if (WikiPost.get('editMode') || WikiPost.get('post.locked')) {
        return;
      }

      var emojiMenuTarget = WikiPost.get('emojiMenuTarget'),
          emoji = event.node.className.match(/emoji-((?!button)\w+)/g);

      if (emojiMenuTarget && emoji && emoji.length) {
        emoji = emoji[0].replace('emoji-', '');

        var tagName = emojiMenuTarget.tagName.toLowerCase(),
            tagIndex = -1;

        _$el.content.find(tagName).each(function(i) {
          if (this == emojiMenuTarget) {
            tagIndex = i;

            return false;
          }
        });

        if (tagIndex < 0) {
          return;
        }

        WikiService.toggleEmoji(emoji, tagName, tagIndex);
      }
    });

    function _beforeTeadown(callback) {
      window.onbeforeunload = null;
      _$el.window.off('resize', _resize);
      $ShortcutsService.unregister('wiki-s');

      callback();
    }

    WikiService.onAsyncSafe('wikiPostController.beforeTeardown', function(args, callback) {
      _beforeTeadown(callback);
    }, 'low');

    WikiService.onAsyncSafe('wikiPostController.teardownWikiPost', function(args, callback) {
      _beforeTeadown(function() {
        WikiPost.teardown().then(callback);
      });
    });

    WikiPost.on('teardown', function() {
      if (_contentEvent) {
        _contentEvent.cancel();
        _contentEvent = null;
      }
      _$el.body.unbind('click', _bodyClick);
      _$el = null;
      WikiPost = null;
      $Layout.off('leftContextOpened', _leftContextOpened);
      $Layout.off('rightContextOpened', _rightContextOpened);
      $Layout.off('afterResize', _resize);

      setTimeout(function() {
        WikiService.offNamespace('wikiPostController');
      });
    });

    if (_user.permissionsPublic.indexOf('wiki-write') > -1) {
      WikiPost.set('accessWrite', true);
    }

    $Layout.on('afterResize', _resize);
    $Layout.on('leftContextOpened', _leftContextOpened);
    $Layout.on('rightContextOpened', _rightContextOpened);

    _leftContextOpened({
      opened: $Layout.get('leftContextOpened')
    });

    _rightContextOpened({
      opened: $Layout.get('rightContextOpened')
    });

    WikiPost.require().then(function() {
      _scrolls = WikiPost.findChild('name', 'pl-scrolls');

      $done();

      if (_user.permissionsPublic.indexOf('wiki-write') > -1) {
        setTimeout(_requireTexteditor, 1000);
      }
    });
  }]);

})();
