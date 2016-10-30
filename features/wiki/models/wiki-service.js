module.exports = function() {
  'use strict';

  DependencyInjection.service('WikiService', [
    '$AbstractService', '$BodyDataService', '$FaviconService', '$ShortcutsService', '$i18nService', '$socket',
  function($AbstractService, $BodyDataService, $FaviconService, $ShortcutsService, $i18nService, $socket) {

    return new (function WikiService() {

      $AbstractService.call(this);

      this.MODES = {
        NONE: null,
        SELECT: 'select',
        EDIT: 'edit',
        CREATE: 'create'
      };

      var _this = this,
          _web = $BodyDataService.data('web'),
          _printRequired = false,
          _mode = this.MODES.NONE,
          _isHome = false,
          _wantPostSelectedUrl = null,
          _postSelected = null,
          _lastReadPost = null,
          _lastReadPostSelected = null,
          _currentPath = null,
          _currentUrl = null,
          _postLocked = false,
          _hasModifications = false,
          _createPostForceUrl = null,
          _shortcutsGroup = $i18nService._('In the Wiki app'),
          _titleSelected = null,
          _editSummary = null,
          _editSummaryTitle = null,
          _autocompleteTagsActive = false,
          _inWikiHome = false;

      this.onSafe('WikiService.init', function() {
        _mode = _this.MODES.NONE;
        _postSelected = null;
        _lastReadPost = null;
        _lastReadPostSelected = null;

        _this.closeHome();
      });

      this.onSafe('WikiService.teardown', function() {
        if (_postLocked) {
          _this.unlockPost();
        }

        _mode = _this.MODES.NONE,
        _isHome = false;
        _postSelected = null;
        _lastReadPost = null;
        _lastReadPostSelected = null;
        _currentPath = null;
        _currentUrl = null;
        _wantPostSelectedUrl = null;
        _titleSelected = null;
        _editSummary = null;
        _editSummaryTitle = null;
        _hasModifications = null;
        _createPostForceUrl = null;
        $ShortcutsService.unregisterGroup(_this.shortcutsGroup());
      });

      this.printRequired = function(value) {
        if (typeof value == 'boolean') {
          _printRequired = value;

          return _this;
        }

        return _printRequired;
      };

      this.mode = function() {
        return _mode;
      };

      this.isHome = function() {
        return _isHome;
      };

      this.postSelected = function() {
        return _postSelected;
      };

      this.lastReadPost = function() {
        return _lastReadPost;
      };

      this.lastReadPostSelected = function() {
        return _lastReadPostSelected;
      };

      this.hasModifications = function(value) {
        if (typeof value == 'boolean') {
          _hasModifications = value;

          return _this;
        }

        return _hasModifications;
      };

      this.shortcutsGroup = function() {
        return _shortcutsGroup;
      };

      $socket.on('disconnect', function() {
        _this.fire('networkChanged', {
          network: false
        });
      });

      $socket.on('reconnectSigned', function() {
        _this.fire('networkChanged', {
          network: true
        });

        _this.fire('reconnectSigned');

        if (!_isHome && _mode == _this.MODES.EDIT && _lastReadPostSelected && _lastReadPostSelected.id) {
          _this.lockPost(_lastReadPostSelected.id);
        }
        else if (!_isHome && _mode == _this.MODES.SELECT && !_wantPostSelectedUrl) {
          _currentUrl = null;

          window.page.redirect(location.pathname);
        }
      });

      $socket.on('read(wiki/posts.edition)', function(args) {
        _this.fire('postsInEdition', args);
      });

      $socket.on('read(posts/post)', function(args) {
        if (!_this.isInit()) {
          return;
        }

        if (args && args.post && !args.error) {
          _wantPostSelectedUrl = null;
        }

        if (args.isOwner && args.alreadyLocked) {
          _postLocked = false;
          window.page.redirect('/wiki/' + args.post.url);

          return;
        }
        else if (args.isOwner && args.locked) {
          _postLocked = true;
        }

        if (args && args.post) {
          if (args.created && args.isOwner) {
            _this.editPost(args.post.url);

            return;
          }

          if (
            args.post.url && args.post.url != args.enterUrl &&
            (args.isOwner || (_postSelected && args.post.id == _postSelected))
          ) {
            window.page.redirect('/wiki/' + args.post.url + (args.isOwner && args.enterMode == _this.MODES.EDIT ? '/edit' : ''));

            return;
          }

          if (args.isOwner && args.enterMode == _this.MODES.EDIT) {
            _this.editMode(args.post.id, false);
          }
          else if (args.enterMode == _this.MODES.SELECT) {
            _this.selectMode(args.post.id);
          }
        }

        if (args && args.post && args.post.id && _postSelected && args.post.id == _postSelected) {
          args.selected = true;
        }
        else if (args && args.error && args._message && args._message.id && args._message.id == _postSelected) {
          args.selected = true;
        }

        if (args && args.error && args.error == 'not exists' && args.enterMode == _this.MODES.EDIT) {
          _this.createMode(args.enterUrl);

          return;
        }

        if (args.selected && args.post && args.post.title) {
          var letters = /([a-z])/gi.exec(args.post.title);

          document.title = args.post.title + $i18nService._(' - ' + _web.brand);

          var favicon = '/public/wiki/favicon.png';

          if (letters && letters.length) {
            favicon = '/public/wiki/favicon-' + letters[0].toLowerCase() + '.png';
          }

          $FaviconService.update(favicon);
        }

        if (!_lastReadPostSelected || !args.post || _lastReadPostSelected.id != args.post.id) {
          _titleSelected = null;
          _editSummary = null;
          _editSummaryTitle = null;
        }

        _lastReadPost = args.post || null;
        if (args.selected) {
          _lastReadPostSelected = args.post || null;
        }

        _this.fire('readPost', $.extend(true, {}, args));
      });

      $socket.on('read(posts/post.views)', function(args) {
        _this.fire('readPostViews', args);
      });

      $socket.on('read(posts/post.lock)', function(args) {
        if (args.isOwner) {
          if (args.error && args.error == 'alreadyLocked') {
            _this.fire('alreadyLocked', args);
          }

          return;
        }

        _this.fire('readPostLock', args);
      });

      $socket.on('read(posts/post.unlock)', function(args) {
        _this.fire('readPostUnlock', args);
      });

      $socket.on('read(posts/post.tryDelete)', function(args) {
        _this.fire('readPostTryDelete', args);
      });

      this.clearMode = function(redirect) {
        _mode = _this.MODES.NONE;
        _postSelected = null;

        _this.closeHome();

        if (redirect) {
          window.page.redirect('/wiki');
        }
      };

      this.selectTitle = function(title) {
        _this.fire('postSelectedTitleChanged', {
          title: title
        });
      };

      this.lockPost = function(id) {
        $socket.emit('update(posts/post.lock)', {
          id: id
        });
      };

      this.unlockPost = function() {
        _postLocked = false;

        $socket.emit('update(posts/post.unlock)');
      };

      this.selectPost = function(id, redirect) {
        if (id == _postSelected && _mode == _this.MODES.SELECT) {
          return;
        }

        var func = redirect ? window.page.redirect : window.page;

        func('/wiki/' + id);
      };

      function _callPost(url, mode, lock) {
        _wantPostSelectedUrl = url;

        _this.retryEmitOnError($socket, 'call(posts/post)', {
          url: url,
          enterMode: mode,
          enterUrl: url,
          lock: lock || false
        }, function(args) {
          if (!args.isOwner) {
            return false;
          }

          return args._message && args._message.url && args._message.url == _wantPostSelectedUrl;
        });
      }

      this.home = function() {
        _mode = _this.MODES.NONE;
        _isHome = true;

        if (_postLocked) {
          _this.unlockPost();
        }

        _this.fire('home');
      };

      this.closeHome = function() {
        _isHome = false;
      };

      this.enterMode = function(mode, id) {
        _this.closeHome();

        if (_postLocked) {
          _this.unlockPost();
        }

        if (mode == _this.MODES.EDIT) {
          _callPost(id, mode, true);
        }
        else if (mode == _this.MODES.SELECT) {
          _callPost(id, mode);
        }
      };

      this.enterHash = function(hash) {
        hash = hash || '';

        _this.fire('scrollToAnchor', {
          anchor: '#' + hash.replace('#', '')
        });
      };

      this.editPost = function(id, redirect) {
        var func = redirect ? window.page.redirect : window.page;

        func('/wiki/' + id + '/edit');
      };

      this.selectMode = function(id) {
        _mode = _this.MODES.SELECT;
        _postSelected = id;
        _createPostForceUrl = null;

        _this.closeHome();

        _this.fire('selectMode', {
          id: id
        });
      };

      this.editMode = function(id, fireEvent) {
        _mode = _this.MODES.EDIT;
        _postSelected = id;
        _createPostForceUrl = null;

        _this.closeHome();

        _this.fire('editMode', {
          id: id
        });

        if (fireEvent) {
          _callPost(id, _this.MODES.EDIT, true);
        }
      };

      this.createPost = function() {
        window.page('/wiki/create');
      };

      this.createMode = function(url) {
        _mode = _this.MODES.CREATE;
        _postSelected = null;
        _createPostForceUrl = url || null;

        _this.closeHome();

        if (_postLocked) {
          _this.unlockPost();
        }

        _this.fire('createMode');
      };

      this.savePost = function(post, enterUrl, callback) {
        _this.fire('beforeSave', {
          post: post,
          enterUrl: enterUrl
        }, function(results) {
          if (results && results.length) {
            results.forEach(function(result) {
              if (typeof result != 'object') {
                return;
              }

              $.extend(post, result);
            });
          }

          if (!post || !post.title) {
            if (callback) {
              callback($i18nService._('Please enter a title to save your article'));
            }

            return;
          }

          if (_createPostForceUrl) {
            post.url = _createPostForceUrl;
          }
          _createPostForceUrl = null;

          _this.retryEmitOnError($socket, (post.id ? 'update' : 'create') + '(posts/post)', {
            post: post,
            enterMode: _this.MODES.EDIT,
            enterUrl: enterUrl
          });
        });
      };

      this.deletePost = function(id) {
        _this.fire('beforeDeletePost', {
          id: id
        });

        _this.retryEmitOnError($socket, 'delete(posts/post)', {
          id: id
        });
      };

      this.tryDelete = function(id) {
        $socket.emit('create(wiki/try-delete)', {
          id: id
        });
      };

      this.currentPath = function(newValue) {
        if (typeof newValue != 'undefined') {
          _currentPath = newValue;

          this.fire('currentPathChanged', {
            value: newValue
          });

          return _this;
        }

        return _currentPath;
      };

      this.currentUrl = function(newValue) {
        if (typeof newValue != 'undefined') {
          _currentUrl = newValue;

          this.fire('currentUrlChanged', {
            value: newValue
          });

          return _this;
        }

        return _currentUrl;
      };

      this.exitConfirmation = function(confirmCallback, cancelCallback) {
        _this.fire('exitConfirmation', {
          confirmCallback: confirmCallback,
          cancelCallback: cancelCallback
        });
      };

      this.inEditUnsaved = function() {
        return (_mode == _this.MODES.EDIT || _mode == _this.MODES.CREATE) && _this.hasModifications();
      };

      this.scrollToAnchor = function(anchor) {
        _this.fire('scrollToAnchor', {
          anchor: anchor
        });
      };

      this.titleSelected = function(newValue) {
        if (typeof newValue != 'undefined') {
          _titleSelected = newValue;

          _this.fire('titleSelected', {
            title: newValue
          });

          return _this;
        }

        return _titleSelected;
      };

      this.editSummary = function(newValue, title) {
        if (typeof newValue != 'undefined') {
          _editSummary = newValue;
          _editSummaryTitle = title;

          _this.fire('editSummary', {
            summary: newValue,
            title: title
          });

          return _this;
        }

        return _editSummary;
      };

      this.editSummaryTitle = function() {
        return _editSummaryTitle;
      };

      this.stopAutocompleteTags = function() {
        _autocompleteTagsActive = false;
      };

      this.autocompleteTags = function(isMaster, name, excludes, callback) {
        _autocompleteTagsActive = true;

        $socket.once('read(tags/tags.autocomplete)', function(args) {
          if (!_autocompleteTagsActive) {
            return;
          }

          callback(args.tags);
        });

        $socket.emit('call(tags/tags.autocomplete)', {
          master: isMaster,
          name: name,
          excludes: excludes
        });
      };

      this.toggleEmoji = function(emoji, tagName, tagIndex) {
        $socket.emit('update(posts/emoji)', {
          id: _postSelected,
          emoji: emoji,
          tagName: tagName,
          tagIndex: tagIndex
        });
      };

      this.inWikiHome = function(inWikiHome) {
        return new window.Ractive.Promise(function(fulfil) {
          _inWikiHome = !!inWikiHome;

          _this.fire(_inWikiHome ? 'teardownWikiPost' : 'teardownWikiHome', null, function() {
            if (_inWikiHome) {
              $socket.once('read(posts/home)', function(args) {
                return fulfil(args && args.homeUrl || null);
              });

              $socket.emit('call(posts/home)');

              return;
            }

            fulfil();
          });
        });
      };
    })();

  }]);

};
