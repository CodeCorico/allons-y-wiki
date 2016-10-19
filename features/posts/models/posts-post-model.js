module.exports = function() {
  'use strict';

  DependencyInjection.model('PostModel', function($AbstractModel, $RealTimeService, $WebCreateService) {

    var PROTECTED_URLS = ['create'],
        PERMISSIONS = {
          'wiki-access': {
            title: 'Access to the Wiki app',
            description: 'Access to the Wiki app.',
            isPublic: true
          },
          'wiki-write': {
            title: 'Write to the Wiki app',
            description: 'Create and edit articles in the Wiki.',
            isPublic: true
          },
          'wiki-ask-share-read': {
            title: 'Ask to share an article in write mode',
            description: 'Ask to share an article in write mode.',
            linked: true,
            isPublic: false
          },
          'wiki-ask-share-write': {
            title: 'Ask to share an article in read mode',
            description: 'Ask to share an article in read mode.',
            linked: true,
            isPublic: false
          }
        },
        REALTIME_EVENTS = {
          'wiki-post': {
            permissions: ['wiki-access']
          },
          'wiki-post-locked': {
            permissions: ['wiki-access'],
            call: 'callPostLocked'
          },
          'wiki-lastcreated': {
            permissions: ['wiki-access'],
            call: 'callLastCreatedPosts'
          },
          'wiki-lastupdated': {
            permissions: ['wiki-access'],
            call: 'callLastUpdatedPosts'
          },
          'wiki-mostopened': {
            permissions: ['wiki-access'],
            call: 'callMostOpenedPosts'
          },
          'wiki-contributions': {
            permissions: ['wiki-access'],
            call: 'callContributions'
          },
          'users-wiki-coworkers': {
            call: 'callCoworkers'
          }
        },
        CREATE_LINKS = {
          title: 'Wiki',
          links: [{
            url: '/wiki/create',
            image: '/public/wiki/wiki-web-create-thumb.png',
            title: 'Empty article',
            description:  'Create a new empty article.'
          }]
        },
        WIKI_HOME_TILE = {
          url: '/wiki',
          cover: '/public/wiki/wiki-home.png',
          large: true,
          centered: {
            title: 'WIKI'
          }
        },
        WIKI_URL_PATTERN = /^\/wiki\/?$/,
        WIKI_POST_URL_PATTERN = /^\/wiki\/(?!create\/?$)(.+?)\/?$/,

        extend = require('extend'),
        async = require('async'),
        _postsOpened = 0,
        _postsEdited = 0,
        _postsCount = 0,
        _contributorsCount = 0,
        _reactionsCount = 0;

    return $AbstractModel('PostModel', function() {

      return {
        identity: 'posts',
        entities: true,
        entityType: 'post',
        isSearchable: true,
        isSearchableAdvanced: true,
        attributes: {
          title: {
            type: 'string',
            index: true,
            defaultsTo: ''
          },
          content: {
            type: 'string',
            defaultsTo: ''
          },
          url: {
            type: 'string',
            index: true,
            defaultsTo: ''
          },
          redirections: {
            type: 'array',
            defaultsTo: []
          },
          cover: 'string',
          coverThumb: 'string',
          coverLarge: 'string',
          views: {
            type: 'integer',
            index: true
          },
          contributors: 'array',
          status: {
            type: 'string',
            index: true,
            defaultsTo: ''
          },
          summary: {
            type: 'array',
            defaultsTo: []
          },
          description: {
            type: 'string',
            defaultsTo: ''
          },
          linksPosts: {
            type: 'array',
            defaultsTo: []
          },
          links: {
            type: 'object',
            defaultsTo: {}
          },
          tags: {
            type: 'object',
            defaultsTo: {}
          },
          emojis: {
            type: 'object',
            defaultsTo: {}
          },

          populateBackposts: function(callback) {
            var PostModel = DependencyInjection.injector.model.get('PostModel'),
                id = this.id;

            PostModel
              .find({
                linksPosts: id
              })
              .exec(function(err, posts) {
                if (err) {
                  return callback(err);
                }

                posts = (posts || []).filter(function(post) {
                  return post.id != id;
                });

                callback(null, posts);
              });
          },

          toggleEmoji: function(user, emoji, tagName, tagIndex, callback) {
            tagName = (tagName || '').toLowerCase();

            var _this = this,
                PostModel = DependencyInjection.injector.model.get('PostModel'),
                i = -1,
                found = false,
                emojiAdded = null,
                emojiRemoved = null;

            this.emojis = this.emojis || {};
            this.emojis.nodes = this.emojis.nodes || [];
            this.emojis.members = this.emojis.members || {};
            this.emojis.total = this.emojis.total || 0;

            this.content = this.content.replace(new RegExp('(<' + tagName + '(>|\\s+[^>]*>))', 'gi'), function(match) {
              i++;

              if (i == tagIndex) {
                found = true;

                var emojiNode = null,
                    dataEmoji = /data-emoji="(.*?)"/.exec(match);

                if (dataEmoji && dataEmoji.length > 1) {
                  dataEmoji = dataEmoji[1];

                  for (var j = 0; j < _this.emojis.nodes.length; j++) {
                    if (_this.emojis.nodes[j].id == dataEmoji) {
                      emojiNode = _this.emojis.nodes[j];

                      break;
                    }
                  }
                }

                if (!emojiNode) {
                  emojiNode = {
                    id: dataEmoji || new Date().getTime().toString()
                  };

                  _this.emojis.nodes.push(emojiNode);

                  match = match.replace('>', ' data-emoji="' + emojiNode.id + '">');
                }

                emojiNode[emoji] = emojiNode[emoji] || [];
                _this.emojis[emoji] = _this.emojis[emoji] || 0;

                var userIndex = emojiNode[emoji].indexOf(user.id);

                if (userIndex < 0) {
                  emojiNode[emoji].push(user.id);
                  _this.emojis[emoji]++;
                  _this.emojis.total++;

                  if (!_this.emojis.members[user.id]) {
                    _this.emojis.members[user.id] = {
                      count: 0
                    };
                  }

                  _this.emojis.members[user.id].name = user.username;
                  _this.emojis.members[user.id].count++;

                  emojiAdded = {
                    username: user.username,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    avatarMini: user.avatarMini,
                    emoji: emoji
                  };
                }
                else {
                  emojiNode[emoji].splice(userIndex, 1);
                  if (!emojiNode[emoji].length) {
                    delete emojiNode[emoji];
                  }

                  _this.emojis[emoji]--;
                  _this.emojis.total--;
                  if (!_this.emojis[emoji]) {
                    delete _this.emojis[emoji];
                  }

                  _this.emojis.members[user.id].count--;
                  if (!_this.emojis.members[user.id].count) {
                    delete _this.emojis.members[user.id];
                  }

                  emojiRemoved = {
                    username: user.username,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    avatarMini: user.avatarMini,
                    emoji: emoji
                  };
                }
              }

              return match;
            });

            if (found) {
              PostModel
                .update({
                  id: this.id
                }, {
                  content: this.content,
                  emojis: this.emojis
                })
                .exec(function() {
                  callback(null, _this, emojiAdded, emojiRemoved);
                });

              return;
            }

            callback('not found');
          },

          publicData: function(moreData, remove) {
            var post = this.toJSON();

            delete post.isSearchable;
            delete post.isSearchableAdvanced;
            delete post.entityType;

            if (moreData) {
              extend(true, post, moreData);
            }

            if (remove) {
              remove.forEach(function(removeKey) {
                delete post[removeKey];
              });
            }

            return post;
          },

          tileData: function(moreData, remove) {
            return DependencyInjection.injector.model.get('PostModel').tileData(this, moreData, remove);
          }
        },

        init: function() {
          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel'),
              EntityModel = DependencyInjection.injector.model.get('EntityModel'),
              UserModel = DependencyInjection.injector.model.get('UserModel');

          GroupModel.registerPermissions(PERMISSIONS);

          Object.keys(REALTIME_EVENTS).forEach(function(eventName) {
            if (REALTIME_EVENTS[eventName].call) {
              var call = REALTIME_EVENTS[eventName].call;

              REALTIME_EVENTS[eventName].call = function() {
                _this[call].apply(_this, arguments);
              };
            }
          });

          $RealTimeService.registerEvents(REALTIME_EVENTS);

          EntityModel.registerSearchPublicData('post', this, this.searchPublicData);

          UserModel.onChangeAvatar(function(user, callback) {
            _this.updateMember(user, function() {
              callback();
            });
          });

          UserModel.homeDefaultTile(extend(true, {
            date: new Date()
          }, WIKI_HOME_TILE), ['wiki-access']);

          $WebCreateService.links(function() {
            _this.webCreateLinks.apply(this, arguments);
          });

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

          if ($WebHomeService) {
            $WebHomeService.metric({
              name: 'postsOpened',
              title: 'articles opened',
              value: 0
            });

            $WebHomeService.metric({
              name: 'postsEdited',
              title: 'articles under edition',
              value: 0
            });
          }

          async.waterfall([function(next) {

            _this
              .count()
              .exec(function(err, count) {
                _postsCount = count || 0;

                if ($WebHomeService) {
                  $WebHomeService.metric({
                    name: 'postsCount',
                    title: 'articles',
                    value: _postsCount
                  });
                }

                next();
              });

          }, function(next) {

            UserModel
              .count({
                isContributor: true
              })
              .exec(function(err, count) {
                _contributorsCount = count || 0;

                if ($WebHomeService) {
                  $WebHomeService.metric({
                    name: 'contributorsCount',
                    title: 'contributors',
                    value: _contributorsCount
                  });
                }

                next();
              });

          }, function(next) {

            _this.totalEmojis(function(total) {
              _reactionsCount = total || 0;

              if ($WebHomeService) {
                $WebHomeService.metric({
                  name: 'reactionsCount',
                  title: 'reactions',
                  value: _reactionsCount
                });
              }

              next();
            });
          }]);
        },

        webCreateLinks: function(sockets, sections, callback) {
          sockets.forEach(function(socket) {
            if (!socket || !socket.user || !socket.user.id) {
              return;
            }

            if (socket.user.hasPermission('wiki-write')) {
              sections.push(CREATE_LINKS);
            }
          });

          callback();
        },

        postsCount: function(add) {
          _postsCount += add;

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

          $WebHomeService.metric('postsCount', _postsCount);
        },

        contributorsCount: function(add) {
          _contributorsCount += add;

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

          $WebHomeService.metric('contributorsCount', _contributorsCount);
        },

        reactionsCount: function(add) {
          _reactionsCount += add;

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

          $WebHomeService.metric('reactionsCount', _reactionsCount);
        },

        protectedUrls: function() {
          return PROTECTED_URLS;
        },

        cleanTitle: function(title) {
          return title
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/(<\/?[a-zA-Z]+.*?>)/g, '')
            .trim();
        },

        searchPostsByUrl: function(url, callback) {
          var _this = this;

          _this
            .findOne({
              url: url
            })
            .exec(function(err, post) {
              if (err) {
                return callback(err);
              }

              callback(null, post);
            });
        },

        searchPostsByUrlOrRedirection: function(param, callback) {
          var _this = this;

          _this
            .findOne({
              or: [{
                redirections: param
              }, {
                url: param
              }]
            })
            .exec(function(err, post) {
              if (err) {
                return callback(err);
              }

              callback(null, post);
            });
        },

        searchAvaiblablePostsByUrlRegex: function(newUrlRegex, callback) {
          this
            .find({
              or: [{
                redirections: newUrlRegex == '.*' ? /^\d+$/ : new RegExp(newUrlRegex, 'i')
              }, {
                url: newUrlRegex == '.*' ? /^\d+$/ : new RegExp(newUrlRegex, 'i')
              }]
            }, {
              select: ['id', 'title', 'url', 'redirections']
            })
            .exec(function(err, posts) {
              if (err) {
                return callback(err);
              }

              callback(null, posts);
            });
        },

        searchAvaiblablePostsObjectsByUrlRegex: function(newUrl, newUrlRegex, callback) {
          this
            .find({
              or: [{
                redirections: new RegExp(newUrlRegex, 'i')
              }, {
                url: new RegExp(newUrlRegex, 'i')
              }]
            }, {
              select: ['id', 'title', 'url', 'redirections']
            })
            .exec(function(err, posts) {
              if (err) {
                return callback(err);
              }

              var matchedPosts = {},
                  searchPattern = new RegExp(newUrl + '-');

              if (posts && posts.length > 0) {

                for (var i = 0; i < posts.length; i++) {
                  var postem = posts[i],
                      matched = false;

                  if (postem.url == newUrl || searchPattern.test(postem.url)) {
                    matched = true;
                  }
                  else {
                    for (var j = 0; j < postem.redirections.length; j++) {
                      var redirection = postem.redirections[j];

                      if (redirection == newUrl || searchPattern.test(redirection)) {
                        matched = true;
                      }
                    }
                  }

                  if (matched) {
                    matchedPosts[postem.id] = {
                      url: postem.url,
                      redirections: postem.redirections
                    };
                  }
                }
              }

              callback(null, matchedPosts);
            });
        },

        searchByTitle: function(title, limit, callback) {
          var webUrlFactory = DependencyInjection.injector.model.get('webUrlFactory');

          title = '(' + webUrlFactory(title).replace(/-/g, ').*?(') + ')';

          var regex = new RegExp(title, 'i');

          this
            .find({
              title: regex
            })
            .sort({
              updatedAt: 'desc'
            })
            .limit(limit || 10)
            .exec(function(err, posts) {
              if (err) {
                return callback(err);
              }

              callback(null, posts, regex);
            });
        },

        searchById: function(id, limit, callback) {
          this
            .find({
              id: id
            })
            .sort({
              updatedAt: 'desc'
            })
            .limit(limit || 10)
            .exec(function(err, posts) {
              if (err) {
                return callback(err);
              }

              callback(null, posts);
            });
        },

        beforeValidate: function(values, callback) {
          if (typeof values.title == 'string') {
            values.title = this.cleanTitle(values.title);
          }

          callback();
        },

        applyLocked: function(post, socket) {
          socket.user.postLocked = post.id;

          this.fillLocked(post, socket);
        },

        fillLocked: function(post, socket) {
          post.locked = {
            id: socket.user.id,
            username: socket.user.username,
            firstname: socket.user.firstname,
            email: socket.user.email,
            lastname: socket.user.lastname,
            avatarMini: socket.user.avatarMini || null,
            avatarThumbVertical: socket.user.avatarThumbVertical || null
          };
        },

        populateLocked: function($SocketsService, $socket, post) {
          var _this = this,
              ownerLocked = false;

          post.locked = false;

          $SocketsService.each(function(socket) {
            if (socket && socket.user && socket.user.postLocked == post.id) {

              _this.fillLocked(post, socket);

              if (socket == $socket) {
                ownerLocked = true;
              }

              return false;
            }
          });

          return ownerLocked;
        },

        searchPostLinks: function(postId, notItself, callback) {
          var query = {
            linksPosts: postId
          };

          if (notItself) {
            query.id = {
              '!': postId
            };
          }

          this
            .find(query)
            .exec(callback);
        },

        toggleEmoji: function(user, postId, emoji, tagName, tagIndex, callback) {
          this
            .findOne({
              id: postId
            })
            .exec(function(err, post) {
              if (err || !post) {
                return;
              }

              post.toggleEmoji(user, emoji, tagName, tagIndex, callback);
            });
        },

        totalEmojis: function(callback) {
          var _this = this;

          this.native(function(err, collection) {
            collection.aggregate([{
              $match: {
                entityType: _this.entityType
              }
            }, {
              $group: {
                _id: null,
                total: {
                  $sum: '$emojis.total'
                }
              }
            }], function(err, result) {
              callback(!err && result.length && result[0] && result[0].total || 0);
            });
          });
        },

        contentToText: function(content) {
          return content && content
            .replace(/<(?:.|\n)*?>/gm, ' ')
            .replace(/&(nbsp|amp|quot|lt|gt);/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/ +/g, ' ') || '';
        },

        refreshPostLocked: function(post) {
          this.callPostLocked(null, null, [post.id]);
        },

        callPostLocked: function($socket, eventName, args, callback) {
          if (!args || !args.length) {
            if (callback) {
              callback();
            }

            return;
          }

          eventName = eventName || 'wiki-post-locked:' + args[0];

          var $SocketsService = DependencyInjection.injector.model.get('$SocketsService'),
              post = {
                id: args[0]
              };

          this.populateLocked($SocketsService, $socket, post);

          $RealTimeService.fire(eventName, {
            post: post
          }, $socket || null);

          if (callback) {
            callback();
          }
        },

        callLastByType: function(type, $socket, eventName, args, lockPostId, lockSocket, callback) {
          var _this = this,
              eventNamesCount = $RealTimeService.eventNamesFromCount('wiki-last' + type, 0, $socket);

          if (eventNamesCount === false) {
            return;
          }

          this
            .find()
            .limit(eventNamesCount ? eventNamesCount.maxCount : args && args[0] || 10)
            .sort(type + 'At DESC')
            .exec(function(err, posts) {
              if (err || !posts) {
                return callback();
              }

              posts = posts.map(function(post) {
                var postData = post.tileData();

                if (lockPostId && post.id == lockPostId) {
                  _this.fillLocked(postData, lockSocket);
                }

                return postData;
              });

              if ($socket) {
                $RealTimeService.fire(eventName, {
                  posts: posts
                }, $socket);
              }
              else {
                Object.keys(eventNamesCount.eventNames).forEach(function(eventName) {
                  $RealTimeService.fire(eventName, {
                    posts: !eventNamesCount.eventNames[eventName].count ?
                      posts :
                      posts.slice(0, eventNamesCount.eventNames[eventName].count)
                  });
                });
              }

              if (callback) {
                callback();
              }
            });
        },

        callLastCreatedPosts: function($socket, eventName, args, callback) {
          this.callLastByType('created', $socket, eventName, args, null, null, callback);
        },

        refreshLastCreatedPosts: function(lockPostId, lockSocket, callback) {
          this.callLastByType('created', null, null, null, lockPostId, lockSocket, callback);
        },

        callLastUpdatedPosts: function($socket, eventName, args, callback) {
          this.callLastByType('updated', $socket, eventName, args, null, null, callback);
        },

        refreshLastUpdatedPosts: function(lockPostId, lockSocket, callback) {
          this.callLastByType('updated', null, null, null, lockPostId, lockSocket, callback);
        },

        callMostOpenedPosts: function($socket, eventName, args, callback) {
          var eventNamesCount = $RealTimeService.eventNamesFromCount('wiki-mostopened', 0, $socket);

          if (eventNamesCount === false) {
            return;
          }

          this
            .find()
            .limit(eventNamesCount ? eventNamesCount.maxCount : args && args[0] || 10)
            .sort('views DESC')
            .exec(function(err, posts) {
              if (err || !posts) {
                return callback();
              }

              posts = posts.map(function(post) {
                return post.tileData();
              });

              if ($socket) {
                $RealTimeService.fire(eventName, {
                  posts: posts
                }, $socket);
              }
              else {
                Object.keys(eventNamesCount.eventNames).forEach(function(eventName) {
                  $RealTimeService.fire(eventName, {
                    posts: !eventNamesCount.eventNames[eventName].count ?
                      posts :
                      posts.slice(0, eventNamesCount.eventNames[eventName].count)
                  });
                });
              }

              if (callback) {
                callback();
              }
            });
        },

        postsOpened: function($socket, url) {
          var _this = this,
              match = url && url.match(WIKI_POST_URL_PATTERN) || false,
              matchWiki = !match && url && url.match(WIKI_URL_PATTERN) || false,
              UserModel = DependencyInjection.injector.model.get('UserModel');

          if ((match || matchWiki) && $socket && $socket.user && $socket.user.id) {
            var tile = null;

            async.waterfall([function(next) {
              if (matchWiki) {
                tile = extend(true, {
                  date: new Date()
                }, WIKI_HOME_TILE);

                return next();
              }

              var postUrl = match[1].split('/')[0];

              _this
                .findOne({
                  url: postUrl
                })
                .exec(function(err, post) {
                  if (err || !post) {
                    return;
                  }

                  tile = {
                    date: new Date(),
                    url: '/wiki/' + postUrl,
                    cover: post.coverThumb || '/public/wiki/default-article.png',
                    details: {
                      title: post.title,
                      text: post.description
                    }
                  };

                  next();
                });

            }, function() {
              if (!tile) {
                return;
              }

              UserModel.addHomeTile(tile, $socket.user.id);
            }]);
          }

          if (match && !$socket.isPostOpened) {
            _postsOpened++;
          }
          else if (!match && $socket.isPostOpened) {
            _postsOpened--;
          }
          else {
            return;
          }

          $socket.isPostOpened = !!match;

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);
          if (!$WebHomeService) {
            return;
          }

          $WebHomeService.metric('postsOpened', _postsOpened);
        },

        postsEdited: function($socket, postId) {
          if (!$socket.lastPostLocked && postId) {
            _postsEdited++;
          }
          else if ($socket.lastPostLocked && !postId) {
            _postsEdited--;
          }
          else {
            return;
          }

          $socket.lastPostLocked = postId;

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);
          if (!$WebHomeService) {
            return;
          }

          $WebHomeService.metric('postsEdited', _postsEdited);
        },

        callContributions: function($socket, eventName, args, callback) {
          if (args.length < 2) {
            if (callback) {
              callback();
            }

            return;
          }

          var _this = this,
              UserModel = DependencyInjection.injector.model.get('UserModel'),
              eventNamesCount = $RealTimeService.eventNamesFromCount('wiki-contributions', 1, $socket, [args[0]]),
              contributions = [];

          if (eventNamesCount === false) {
            return;
          }

          UserModel
            .findOne({
              id: $socket ? args[0] : eventNamesCount.eventNames
            })
            .exec(function(err, selectedUser) {
              if (err || !selectedUser) {
                if ($socket) {
                  $RealTimeService.fire(eventName, {
                    error: 'not found'
                  }, $socket);
                }

                if (callback) {
                  callback();
                }

                return;
              }

              async.waterfall([function(nextFunction) {
                if (!selectedUser.postsContributed || !selectedUser.postsContributed.length) {
                  return nextFunction();
                }

                _this.populateContributions(selectedUser, null, 'tileData', function(err, posts) {
                  if (err) {
                    return;
                  }

                  contributions = posts;

                  nextFunction();
                });
              }], function() {
                $RealTimeService.fire(eventName, {
                  posts: contributions
                }, $socket || null);

                if (callback) {
                  callback();
                }
              });
            });
        },

        populateContributions: function(user, sort, outFormat, callback) {
          this
            .find({
              id: user.postsContributed
            })
            .sort(sort ? sort : {
              updatedAt: 'desc'
            })
            .exec(function(err, posts) {
              if (err) {
                return callback(err);
              }

              if (!posts || !posts.length) {
                callback(null, []);
              }

              if (!outFormat) {
                return callback(null, postsFetched);
              }

              var postsFetched = posts.map(function(post) {
                return post[outFormat]();
              });

              callback(null, postsFetched);
            });
        },

        refreshPost: function(post, args, socket) {
          $RealTimeService.fire('wiki-post:' + post.id, extend(true, {
            post: post.tileData ? post.tileData() : post
          }, args || {}), socket || null);
        },

        refreshCoworkers: function(groupId, callback) {
          this.callCoworkers(null, null, [groupId], callback);
        },

        callCoworkers: function($socket, eventName, args, callback) {
          if (!args || args.length < 2) {
            if (callback) {
              callback();
            }

            return;
          }

          var _this = this,
              UserModel = DependencyInjection.injector.model.get('UserModel'),
              eventNamesCount = $RealTimeService.eventNamesFromCount('wiki-mostopened', 1, $socket, [args[0]]),
              coworkers = [];

          if (eventNamesCount === false) {
            return;
          }

          UserModel
            .findOne({
              id: args[0]
            })
            .exec(function(err, selectedUser) {
              if (err || !selectedUser) {
                if ($socket) {
                  $RealTimeService.fire(eventName, {
                    error: 'not found'
                  }, $socket);
                }

                if (callback) {
                  callback();
                }

                return;
              }

              _this
                .find({
                  'contributors.id': selectedUser.id
                }, {
                  select: ['contributors']
                })
                .exec(function(err, postsContributed) {
                  postsContributed = postsContributed || [];

                  var coworkersIds = [],
                      coworkersContributionsCount = {};

                  postsContributed.forEach(function(post) {
                    post.contributors.forEach(function(contributor) {
                      if (contributor.id == selectedUser.id) {
                        return;
                      }

                      if (coworkersIds.indexOf(contributor.id) < 0) {
                        coworkersIds.push(contributor.id);
                      }

                      coworkersContributionsCount[contributor.id] = coworkersContributionsCount[contributor.id] || 0;
                      coworkersContributionsCount[contributor.id]++;
                    });
                  });

                  async.waterfall([function(nextFunction) {
                    if (!coworkersIds.length) {
                      return nextFunction();
                    }

                    UserModel
                      .find({
                        id: coworkersIds
                      })
                      .exec(function(err, users) {
                        coworkers = (users || []).map(function(user) {
                          return user.publicData({
                            sameContributionsCount: coworkersContributionsCount[user.id]
                          });
                        });

                        coworkers.sort(function(a, b) {
                          return b.sameContributionsCount - a.sameContributionsCount;
                        });

                        nextFunction();
                      });

                  }], function() {

                    if ($socket) {
                      $RealTimeService.fire(eventName, {
                        total: coworkers.length,
                        users: coworkers
                      }, $socket);
                    }
                    else {
                      Object.keys(eventNamesCount.eventNames).forEach(function(eventName) {
                        $RealTimeService.fire(eventName, {
                          total: coworkers.length,
                          users: !eventNamesCount.eventNames[eventName].count ?
                            coworkers :
                            coworkers.slice(0, eventNamesCount.eventNames[eventName].count)
                        });
                      });
                    }

                    if (callback) {
                      callback();
                    }
                  });
                });
            });
        },

        updateMember: function(user, callback) {
          var _this = this;

          this
            .find({
              'contributors.id': user.id
            })
            .exec(function(err, posts) {
              if (err) {
                return callback(err);
              }

              if (!posts || !posts.length) {
                return callback(null);
              }

              async.eachSeries(posts, function(post, nextPost) {

                for (var i = 0; i < post.contributors.length; i++) {
                  if (post.contributors[i].id == user.id) {
                    post.contributors[i] = user.publicData({
                      modifiedAt: post.contributors[i].modifiedAt
                    });

                    break;
                  }
                }

                _this
                  .update({
                    id: post.id
                  }, {
                    contributors: post.contributors
                  })
                  .exec(function() {
                    _this.refreshPost(post);

                    nextPost();
                  });

              }, callback);
            });
        },

        viewsFormatted: function(post) {
          var views = parseInt(post.views || 0, 10);

          if (views > 1000000) {
            views = (Math.round(views / 1000000) / 10) + ' M';
          }
          else if (views > 1000) {
            views = (Math.round(views / 100) / 10) + ' k';
          }

          return views;
        },

        searchPublicData: function(post, $socket, regex) {
          var content = post.search3;

          post = this.tileData(post);

          post.title = post.title.replace(regex, '<strong>$1</strong>');

          var description = [],
              first = true;

          content.replace(regex, function(match, p1, offset) {
            var minOffset = Math.max(0, offset - 20);

            description.push(
              (minOffset > 0 && first ? '[...] ' : '') +
              content.substr(
                minOffset,
                20 + p1.length + 20
              )
                .replace(p1, '<strong>' + p1 + '</strong>')
            );

            first = false;
          });

          if (description.length) {
            post.description = description.join(' [...] ') + ' [...]';
          }
          else {
            post.description = post.description && post.description.replace(regex, '<strong>$1</strong>') || '';
          }

          return post;
        },

        tileData: function(post, moreData, remove) {
          var _this = this,
              $SocketsService = DependencyInjection.injector.model.get('$SocketsService');

          post = {
            id: post.id || post._id,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            title: post.title,
            description: post.description,
            contributors: post.contributors,
            views: this.viewsFormatted(post),
            url: post.url,
            coverThumb: post.coverThumb,
            emojis: post.emojis,
            status: post.status
          };

          $SocketsService.each(function(socket) {
            if (!socket || !socket.user || !socket.user.postLocked || socket.user.postLocked != post.id) {
              return;
            }

            _this.fillLocked(post, socket);

            return false;
          });

          if (moreData) {
            extend(true, post, moreData);
          }

          if (remove) {
            remove.forEach(function(removeKey) {
              delete post[removeKey];
            });
          }

          return post;
        },

        nowPostUpdate: function(postPublicData, member, type, args) {
          var _this = this,
              $NowService = DependencyInjection.injector.model.get('$NowService'),
              GroupModel = DependencyInjection.injector.model.get('GroupModel'),
              EntityModel = DependencyInjection.injector.model.get('EntityModel'),
              UserModel = DependencyInjection.injector.model.get('UserModel'),
              unknownUser = null;

          async.waterfall([function(next) {

            GroupModel.unknownPermissions(function(permissions) {

              if (permissions.permissions.indexOf('wiki-access') < 0) {
                return next();
              }

              EntityModel
                .findOne({
                  entityType: 'userUnknownNow'
                })
                .exec(function(err, userUnknownNow) {
                  if (err || !userUnknownNow) {
                    return next();
                  }

                  unknownUser = userUnknownNow;

                  next();
                });
            });

          }], function() {

            UserModel
              .find({
                permissions: 'wiki-access'
              })
              .exec(function(err, users) {
                if (err || !users || !users.length) {
                  return;
                }

                if (unknownUser) {
                  users.push(unknownUser);
                }

                postPublicData.activityType = 'post';
                postPublicData.referenceId = postPublicData.id;
                postPublicData.postId = postPublicData.id;

                delete postPublicData.id;
                delete postPublicData.search1;
                delete postPublicData.search2;
                delete postPublicData.search2;
                delete postPublicData.tags;
                delete postPublicData.content;
                delete postPublicData.links;
                delete postPublicData.linksPosts;
                delete postPublicData.redirections;
                delete postPublicData.summary;
                delete postPublicData.contributors;

                postPublicData.activityPostType = type;

                if (type == 'create') {
                  postPublicData.activityStatus = 'has published';
                }
                else if (type == 'delete') {
                  delete postPublicData.locked;
                  postPublicData.activityStatus = 'has deleted';
                }
                else if (type == 'update') {
                  postPublicData.activityStatus = 'has updated';
                }
                else if (type == 'status') {
                  postPublicData.activityStatus = args[1] == 'published' ?
                    'has removed the <strong>' + args[0] + '</strong> status' :
                    'has added a <strong>' + args[1] + '</strong> status';
                }
                else if (type == 'emoji-added') {
                  postPublicData.activityStatus = 'has reacted <span class="emoji-icon emoji-' + args + '"></span>';
                }
                else if (type == 'emoji-removed') {
                  postPublicData.activityStatus = 'removes a <span class="emoji-icon emoji-' + args + '"></span>';
                }
                else if (type == 'views') {
                  postPublicData.activityStatus =
                    'has reached <strong>' + _this.viewsFormatted(postPublicData) + ' views</strong>';
                }

                if (member) {
                  postPublicData.activityMember = {
                    id: member.id,
                    url: member.url,
                    firstname: member.firstname,
                    username: member.username,
                    avatarMini: member.avatarMini
                  };
                }

                $NowService.add(users, postPublicData, function(oldActivity, activity) {
                  if (
                    (type == 'update' || type == 'status') &&
                    oldActivity.activityPostType && oldActivity.activityPostType == 'create' &&
                    oldActivity.activityMember && activity.activityMember &&
                    oldActivity.activityMember.id == activity.activityMember.id &&
                    new Date().getTime() - new Date(oldActivity.createdAt).getTime() < 3600 * 24 * 1000
                  ) {
                    activity.activityDate = oldActivity.activityDate;
                    activity.activityMember = oldActivity.activityMember;
                    activity.activityStatus = oldActivity.activityStatus;
                  }
                });
              });
          });
        }
      };

    });

  });

  return 'PostModel';
};
