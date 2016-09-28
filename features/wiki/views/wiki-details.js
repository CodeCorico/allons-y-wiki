(function() {
  'use strict';

  window.Ractive.controllerInjection('wiki-details', [
    '$Page', '$Layout', 'WikiService', '$component', '$data', '$done',
  function wikiDetailsController(
    $Page, $Layout, WikiService, $component, $data, $done
  ) {

    var W = ['what', 'where', 'when', 'who', 'why', 'how'],
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

        WikiDetails = $component({
          data: $.extend(true, {
            EMOJIS: EMOJIS,
            post: null,
            tabs: [{
              name: 'summary',
              title: 'Summary',
              icon: 'fa fa-align-left'
            }, {
              name: 'backposts',
              title: 'Mentioned in',
              icon: 'fa fa-link'
            }, {
              name: 'tags',
              title: 'Tags',
              icon: 'fa fa-tags'
            }, {
              name: 'details',
              title: 'Details',
              icon: 'i-info'
            }, {
              name: 'contributors',
              title: 'Contributors',
              icon: 'fa fa-users'
            }],
            tabSelected: 'summary',
            titleSelected: null,
            tagsList: [],

            displayAvatar: $Page.get('avatar'),

            tagsKeydown: function(event) {
              var charCode = event.original.charCode ? event.original.charCode : event.original.keyCode;

              // ctrl + s
              if (charCode == 83 && event.original.ctrlKey && !event.original.altKey && !event.original.shiftKey && !event.original.metaKey) {
                event.original.stopPropagation();
                event.original.preventDefault();

                WikiService.fire('wantSave');

                return false;
              }
            },

            tagsFocus: function(event, value, component) {
              WikiDetails.get('tagsChange')(event, value, component);
            },

            tagsChange: function(event, value, component) {
              if (!value) {
                WikiService.stopAutocompleteTags();
                component.clear();

                return;
              }

              var keypath = component.get('keypath'),
                  context = WikiDetails.get(keypath);

              WikiService.autocompleteTags(
                component.get('ismaster') == 'true',
                value,
                context.map(function(tag) {
                  return tag.name;
                }),
                function(tags) {
                  component.set('list', tags);
                }
              );
            },

            tagsSelect: function(event, value, component) {
              var keypath = component.get('keypath'),
                  context = WikiDetails.get(keypath),
                  isMaster = component.get('ismaster') == 'true',
                  value = value
                    .toLowerCase()
                    .replace(/[^\w\u00C0-\u017F\s_-]/gi, '')
                    .replace(/\s+/gi, ' ')
                    .trim();

              if (!value) {
                return;
              }

              var exists = false;

              for (var i = 0; i < context.length; i++) {
                if (context[i].name.toLowerCase() == value) {
                  exists = true;
                  break;
                }
              }

              if (exists) {
                return;
              }

              var tag = {
                name: value,
                delete: false
              };

              if (isMaster) {
                tag.tags = [];
              }

              context.push(tag);

              if (isMaster) {
                WikiDetails.set(keypath.substr(0, keypath.lastIndexOf('.')) + '.hasTags', true);

                WikiDetails.require().then(function() {
                  $(component.el)
                    .parent()
                    .prevAll('.wiki-details-tags-list:first')
                    .find('.wiki-details-tags-autocomplete-input')
                    .focus();
                });
              }
              else {
                WikiDetails.update(keypath);
              }

              _hasModifications();

              component.clear();

              if (!isMaster) {
                setTimeout(component.focus);
              }
            }
          }, $data),

          goToTab: function(tab, noAnimation) {
            var $tab = _$el.component.find('.s-' + tab),
                $firstTab = _$el.scrolls.find('.pl-section.s-' + WikiDetails.get('tabs')[0].name);

            if (!$tab.length || !$firstTab.length) {
              return;
            }

            var scrollTop = $tab.offset().top - $firstTab.offset().top;

            _stopScroll = true;
            WikiDetails.set('tabSelected', tab);

            if (noAnimation) {
              _$el.scrolls.scrollTop(scrollTop);
              _stopScroll = false;
            }
            else {
              _$el.scrolls.animate({
                scrollTop: scrollTop
              }, 250, function() {
                _stopScroll = false;
              });
            }

            WikiService.updateWinChartCount('detailsTab');
            WikiService.updateWinChartCount(tab + 'DetailsTab');
          }
        }),
        _stopScroll = false,
        _scrolls = null,
        _$el = {
          component: $(WikiDetails.el)
        };

    function _rightContextOpened(args) {
      if (!args.opened) {
        return;
      }

      setTimeout(function() {
        if (!_scrolls) {
          return;
        }

        _scrolls.update();
      }, 1200);
    }

    function _hasModifications() {
      WikiService.fire('hasModifications');
    }

    WikiDetails.on('goBackPost', function() {
      _closeOnNotDesktop();

      WikiService.updateWinChartCount('openArticleFromBackpost');
    });

    WikiDetails.on('selectContributor', function() {
      WikiService.updateWinChartCount('selectWikiContributor');
    });

    WikiDetails.on('removeTag', function(event) {
      WikiDetails.set(event.keypath + '.delete', true);

      setTimeout(function() {
        var lastDot = event.keypath.lastIndexOf('.'),
            parent = event.keypath.substr(0, lastDot),
            index = event.keypath.substring(lastDot + 1);

        WikiDetails.splice(parent, index, 1);

        _hasModifications();
      }, 350);
    });

    _$el.scrolls = _$el.component.find('.pl-scrolls');

    _$el.scrolls.scroll(function() {
      if (_stopScroll || !WikiDetails.get('post')) {
        return;
      }

      var tabs = WikiDetails.get('tabs'),
          tabSelected = null;

      for (var i = 0; i < tabs.length; i++) {
        var $tab = _$el.component.find('.s-' + tabs[i].name);

        if ($tab.length && $tab.offset().top - _$el.scrolls.offset().top < 50) {
          tabSelected = tabs[i].name;
        }
        else {
          break;
        }
      }

      WikiDetails.set('tabSelected', tabSelected);
    });

    function _closeOnNotDesktop() {
      if ($Layout.get('screen') != 'screen-desktop') {
        $Layout.rightContext().closeIfGroupOpened('group-wiki-details');
      }
    }

    WikiDetails.on('scrollToAnchor', function(event) {
      event.original.stopPropagation();
      event.original.preventDefault();

      if (WikiDetails.get('editMode')) {
        return;
      }

      _closeOnNotDesktop();

      WikiService.scrollToAnchor('#' + event.context.name.replace(/#/, ''));

      WikiService.updateWinChartCount('clickWikiSummary');
    });

    WikiService.onAsyncSafe('wikiDetailsController.beforeSave', function(args, callback) {
      var tags = WikiDetails.get('tags') || [],
          newTags = {};

      tags.forEach(function(sectionTags) {
        sectionTags.masterTags.forEach(function(masterTag) {
          masterTag.tags.forEach(function(tag) {
            newTags[sectionTags.name] = newTags[sectionTags.name] || [];
            newTags[sectionTags.name].push(masterTag.name + ':' + tag.name);
          });
        });
      });

      callback({
        tags: newTags
      });
    });

    WikiService.onSafe('wikiDetailsController.titleSelected', function(args) {
      WikiDetails.set('titleSelected', args.title);
    });

    function _editSummary(args) {
      WikiDetails.set('editSummary', _fetchSummary(args.summary, args.title));
    }

    WikiService.onSafe('wikiDetailsController.editSummary', _editSummary);

    WikiService.onSafe([
      'wikiDetailsController.selectMode',
      'wikiDetailsController.editMode',
      'wikiDetailsController.createMode',
      'wikiDetailsController.home'
    ].join(' '), _modeChanged);

    WikiService.onSafe('wikiDetailsController.teardown', function() {
      $Layout.off('rightContextOpened', _rightContextOpened);
      WikiDetails.teardown();
      WikiDetails = null;

      setTimeout(function() {
        WikiService.offNamespace('wikiDetailsController');
      });
    });

    function _modeChanged() {
      var mode = WikiService.mode();

      if (mode == WikiService.MODES.NONE || WikiService.isHome()) {
        _resetView();
      }
      else if (mode == WikiService.MODES.CREATE) {
        _readPost({
          post: {
            id: null
          },
          selected: true
        });
      }

      WikiDetails.set('editMode', mode == WikiService.MODES.EDIT || mode == WikiService.MODES.CREATE);

      WikiDetails.require();
    }

    function _fetchSummary(summary, postTitle) {
      summary = summary || [];

      if (summary.length) {
        for (var i = 0; i < summary.length; i++) {
          summary[i].lastChild =
            !summary[i + 1] || summary[i].type.replace('h', '') > summary[i + 1].type.replace('h', '') ?
            true :
            false;
        }
      }

      summary.unshift({
        id: null,
        lastChild: false,
        name: '#',
        title: postTitle || null,
        type: 'h0'
      });

      return summary;
    }

    function _resetTab() {
      _$el.scrolls.scrollTop(0);
    }

    function _resetView() {
      WikiDetails.set('post', null);
      WikiDetails.set('emptyTags', true);
      WikiDetails.set('tags',  null);
      _resetTab();
    }

    function _readPost(args) {
      if (args.error || !args.post) {
        _resetView();

        return;
      }

      if (!args.selected) {
        return;
      }

      var post = $.extend(true, {}, args.post);

      if (args.emojiUpdated) {
        WikiDetails.set('post.emojis', post.emojis);

        return;
      }

      _fetchSummary(post.summary, post.title);

      if (WikiDetails.get('post.id') != args.post.id) {
        _resetTab();
      }

      if (post.contributors) {
        post.contributors.sort(function(a, b) {
          return window.moment(b.modifiedAt) - window.moment(a.modifiedAt);
        });

        post.contributors.forEach(function(contributor) {
          var lastYear = window.moment(contributor.modifiedAt).get('year'),
              newDateFormat = lastYear == window.moment().get('year') ? 'DD/MM hh:mm a' : 'DD/MM/YYYY hh:mm a';

          contributor.dateAgo = window.moment(contributor.modifiedAt).fromNow();
          contributor.dateText = window.moment(contributor.modifiedAt).format(newDateFormat);
          contributor.fullDateText = window.moment(contributor.modifiedAt).format('DD/MM/YYYY hh:mm a');
        });
      }

      if (post.createdAt) {
        var lastYear = window.moment(post.createdAt).get('year'),
            newDateFormat = lastYear == window.moment().get('year') ? 'DD/MM' : 'DD/MM/YYYY';

        post.createdDateAgo = window.moment(post.createdAt).fromNow();
        post.createdTime = window.moment(post.createdAt).format('hh:mm a');
        post.createdDate = window.moment(post.createdAt).format(newDateFormat);
      }

      WikiDetails.set('post', post);

      post.tags = post.tags || {};
      var tags = [],
          emptyTags = true;

      W.forEach(function(w, i) {
        var hasTags = false,
            sectionTags = post.tags[w] || [],
            masterTags = {};

        for (var i = 0; i < sectionTags.length; i++) {
          var tag = sectionTags[i].split(':');

          if (tag && tag.length > 1) {
            hasTags = true;
            emptyTags = false;
            masterTags[tag[0]] = masterTags[tag[0]] || [];
            masterTags[tag[0]].push(tag[1]);
          }
        }

        tags.push({
          name: w,
          hasTags: hasTags,
          masterTags: Object.keys(masterTags).map(function(masterTagKey) {
            return {
              name: masterTagKey,
              delete: false,
              tags: masterTags[masterTagKey].map(function(tag) {
                return {
                  name: tag,
                  delete: false
                };
              })
            };
          })
        });
      });

      WikiDetails.set('emptyTags', emptyTags);
      WikiDetails.set('tags', tags);

      WikiDetails.require();
    }

    WikiService.onSafe('wikiDetailsController.readPost', _readPost);

    WikiService.onSafe('wikiDetailsController.readPostViews', function(args) {
      args = args || {};

      var post = WikiDetails.get('post');

      if (post && post.id && post.id == args.id) {
        WikiDetails.set('post.views', args.views);
      }
    });

    WikiDetails.require().then(function() {
      _scrolls = WikiDetails.findChild('name', 'pl-scrolls');

      _modeChanged();

      if (WikiService.lastReadPostSelected()) {
        _readPost({
          post: WikiService.lastReadPostSelected(),
          selected: true
        });
      }

      if (WikiService.editSummary()) {
        _editSummary({
          summary: WikiService.editSummary(),
          title: WikiService.editSummaryTitle()
        });
      }

      _modeChanged();

      $Layout.on('rightContextOpened', _rightContextOpened);

      $done();
    });
  }]);

})();
