'use strict';

module.exports = [{

  event: 'call(posts/post)',
  permissions: ['wiki-access'],
  controller: function($allonsy, $i18nService, PostModel, UserModel, $SocketsService, $socket, $message) {
    if (!this.validMessage($message, {
      url: ['string', 'filled']
    })) {
      return $SocketsService.error($socket, $message, 'read(posts/post)', $i18nService._('Please send an "url".'));
    }

    PostModel.searchPostsByUrlOrRedirection($message.url, function(err, post) {
      if (err) {
        return $SocketsService.error($socket, $message, 'read(posts/post)', err);
      }

      if (!post) {
        PostModel.searchByTitle($message.url, 5, function(err, posts) {
          if (err || !posts) {
            posts = [];
          }

          $socket.emit('read(posts/post)', {
            isOwner: true,
            error: 'not exists',
            url: $message.url,
            enterMode: $message.enterMode,
            enterUrl: $message.enterUrl,
            searchPosts: posts.map(function(post) {
              return post.tileData();
            })
          });
        });

        return;
      }

      var userIsContributor = false,
          viewsIncremented = false;

      if (post.contributors) {
        for (var i = 0; i < post.contributors.length; i++) {
          if (post.contributors[i].id == $socket.user.id) {
            userIsContributor = true;

            break;
          }
        }
      }

      if (!userIsContributor && !$message.lock) {
        post.views++;
        viewsIncremented = true;

        $SocketsService.emit($socket, {
          'route.url': /^\/wiki/
        }, null, 'read(posts/post.views)', {
          id: post.id,
          views: post.views
        });
      }

      var returnMessage = {
            isOwner: true,
            enterMode: $message.enterMode,
            enterUrl: $message.enterUrl,
            post: post.publicData({
              locked: false
            })
          },
          ownerLocked = PostModel.populateLocked($SocketsService, $socket, returnMessage.post);

      if ($socket.user.postLocked) {
        $SocketsService.emit($socket, {
          'route.url': /^\/wiki/
        }, null, 'read(posts/post.unlock)', {
          id: $socket.user.postLocked
        });

        $socket.user.postLocked = null;
      }

      if ($message.lock && returnMessage.post.locked) {
        returnMessage.alreadyLocked = true;
      }
      else if ($message.lock && (!returnMessage.post.locked || ownerLocked)) {
        PostModel.applyLocked(returnMessage.post, $socket);

        $SocketsService.emit($socket, {
          'route.url': /^\/wiki/
        }, null, 'read(posts/post.lock)', {
          post: returnMessage.post
        });

        PostModel.refreshPost(post);

        $allonsy.log('allons-y-wiki', 'posts:post-lock', {
          label: 'Lock the <strong>' + post.title + '</strong> article',
          socket: $socket,
          post: PostModel.mongo.objectId(post.id),
          postTitle: post.title
        });

        returnMessage.locked = true;
      }

      post.populateBackposts(function(err, backposts) {
        if (err) {
          return $SocketsService.error($socket, $message, 'read(posts/post)', err);
        }

        returnMessage.post.backposts = (backposts || []).map(function(post) {
          return post.tileData();
        });

        $socket.emit('read(posts/post)', returnMessage);

        post.save(function() {

          if (viewsIncremented || (returnMessage.locked && !returnMessage.alreadyLocked)) {
            PostModel.refreshPost(post);
          }

          if (viewsIncremented) {
            PostModel.callMostOpenedPosts();
          }

          UserModel.fromSocket($socket, function(err, user) {
            if (err || !user) {
              return;
            }

            user.postsViewed = user.postsViewed || [];

            for (var i = user.postsViewed.length - 1; i >= 0; i--) {
              if (user.postsViewed[i].id == post.id) {
                user.postsViewed.splice(i, 1);

                break;
              }
            }

            user.postsViewed.unshift({
              openedAt: new Date(),
              id: post.id
            });

            while (user.postsViewed.length > 8) {
              user.postsViewed.pop();
            }

            user.save(function() {
              PostModel.callLastViewedPosts($socket.user.id, null, true);

              PostModel.callPostsOpened();

              $allonsy.log('allons-y-wiki', 'posts:post-open', {
                label: 'Open the <strong>' + post.title + '</strong> article',
                socket: $socket,
                post: PostModel.mongo.objectId(post.id),
                postTitle: post.title,
                metric: {
                  key: 'wikiOpenArticle',
                  name: 'Open article',
                  description: 'Open an article, whatever the origin.'
                }
              });
            });
          });
        });
      });
    });
  }
}, {

  event: 'create(posts/post)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function(
    $allonsy, $socket, $SocketsService, $i18nService, $message, PostModel, UserModel, TagModel, WikiDigestModel,
    webUrlFactory, postsSummaryFactory, postsDescriptionFactory, postsLinkFactory, postsCoverThumbsFactory
  ) {
    if (!this.validMessage($message, {
      post: ['object', 'filled']
    })) {
      return;
    }

    if (!$message.post.title || typeof $message.post.title != 'string') {
      return $SocketsService.error($socket, $message, 'read(posts/post)', $i18nService._('Please send a "title".'));
    }

    var fromDirectUrl = !!$message.post.url;

    function saveNewPost(post) {
      UserModel.fromSocket($socket, function(err, contributor) {
        if (err || !contributor) {
          return $SocketsService.error($socket, $message, 'read(posts/post)', err);
        }

        post.updatedAt = new Date();
        post.views = 0;
        post.summary = postsSummaryFactory(post.content);
        post.description = postsDescriptionFactory(post.content);
        post.tags = TagModel.insertTags(post.tags, null);

        post.search1 = post.title;
        post.search2 = TagModel.flatten(post.tags);
        post.search3 = PostModel.contentToText(post.content);

        var contributorPublicData = contributor.publicData();
        contributorPublicData.modifiedAt = post.updatedAt;
        post.contributors = [contributorPublicData];

        postsLinkFactory(post, function(err, postsLinksAll) {
          if (err) {
            return $SocketsService.error($socket, $message, 'read(posts/post)', err);
          }

          post.links = postsLinksAll.postsLinks;
          post.linksPosts = postsLinksAll.availablePosts;

          postsCoverThumbsFactory(post, function() {

            PostModel
              .create(post)
              .exec(function(err, post) {
                if (err) {
                  return $SocketsService.error($socket, $message, 'read(posts/post)', err);
                }

                $allonsy.log('allons-y-wiki', 'posts:post-create', {
                  label: 'Create the <strong>' + post.title + '</strong> article',
                  socket: $socket,
                  post: PostModel.mongo.objectId(post.id),
                  postTitle: post.title,
                  postContent: post.content,
                  postUrl: post.url,
                  postRedirections: post.redirections,
                  postContentLength: post.content.length,
                  postTags: post.tags,
                  fromDirectUrl: fromDirectUrl,
                  metric: {
                    key: 'wikiCreatePost',
                    name: 'Create article',
                    description: 'A new article is created in the database.'
                  }
                });

                var postPublicData = post.publicData();
                PostModel.populateLocked($SocketsService, $socket, postPublicData);

                $SocketsService.emit($socket, {
                  'route.url': /^\/wiki/
                }, null, 'read(posts/post)', {
                  post: postPublicData,
                  created: true
                });

                PostModel.refreshLastCreatedPosts(post.id, $socket);
                PostModel.refreshLastUpdatedPosts(post.id, $socket);

                PostModel.callPostsCount();

                WikiDigestModel.addContributor(contributor.id);

                contributor.postsCreated = contributor.postsCreated || [];
                contributor.postsCreated.push(post.id);
                contributor.postsContributed = contributor.postsContributed || [];
                contributor.postsContributed.push(post.id);

                contributor.save();
              });
          });
        });
      });
    }

    var protectedUrls = PostModel.protectedUrls(),
        newUrl = webUrlFactory($message.post.url || $message.post.title),
        newUrlRegex = newUrl + '.*',
        post = {
          title: $message.post.title,
          content: $message.post.content,
          status: $message.post.status,
          cover: $message.post.cover || null,
          tags: $message.post.tags || null
        };

    if (protectedUrls.indexOf(newUrl) > -1) {
      newUrl += '-1';
    }

    PostModel.searchAvaiblablePostsByUrlRegex(newUrlRegex, function(err, postsArray) {
      if (err) {
        return $SocketsService.error($socket, $message, 'read(posts/post)', err);
      }

      if (postsArray && postsArray.length > 0) {

        if (newUrl) {
          //check if new url is in the redirection of other post
          var newUrlInredirectionsPost = {};

          for (var i = 0; i < postsArray.length; i++) {
            var postem = postsArray[i];
            if (typeof postem.redirections !== 'undefined' && postem.redirections.indexOf(newUrl) != -1) {
              newUrlInredirectionsPost = postem;
            }
          }

          if (Object.keys(newUrlInredirectionsPost).length) {
            post.url = newUrl;
            var matchedPostOldRedirections = newUrlInredirectionsPost.redirections;
            matchedPostOldRedirections.splice(matchedPostOldRedirections.indexOf(newUrl), 1);

            PostModel
              .update({
                id: newUrlInredirectionsPost.id
              }, {
                redirections: matchedPostOldRedirections
              })
              .exec(function() {
                saveNewPost(post);
              });
          }
          else {
            var urlArray = [],
                searchPattern = new RegExp('^' + newUrl + '-[0-9]+$');

            for (var i = 0; i < postsArray.length; i++) {
              var postem = postsArray[i];
              postem.redirections = postem.redirections || [];

              if (postem.url.indexOf(newUrl) != -1) {
                urlArray.push(postem.url);
              }

              for (var j = 0; j < postem.redirections.length; j++) {
                var redirection = postem.redirections[j];
                if (redirection.indexOf(newUrl) != -1) {
                  urlArray.push(redirection);
                }
              }
            }

            if (urlArray.indexOf(newUrl) != -1) {
              var matchesArr = urlArray.filter(function(em) {
                if (em == newUrl || searchPattern.test(em)) {
                  return em;
                }
              });

              var versionArr = matchesArr.map(function(em) {
                if (em == newUrl) {
                  return 1;
                }
                else {
                  return new RegExp('^' + newUrl + '-[0-9]+$').test(em) ?
                    (em.match(/[0-9]+$/) ? em.match(/[0-9]+$/)[0] : -1) :
                    -1;
                }
              });
              var maxVersion = Math.max.apply(Math, versionArr) + 1;
              post.url = newUrl + '-' +  maxVersion;
              saveNewPost(post);
            }
            else {
              post.url = newUrl;
              saveNewPost(post);
            }
          }
        }
        else {
          //empty url, check only full integer url
          var urlArray = [],
              integRegex = /^\d+$/;

          for (var i = 0; i < postsArray.length; i++) {
            var postem = postsArray[i];
            if (integRegex.test(postem.url)) {
              urlArray.push(postem.url);
            }

            for (var j = 0; j < postem.redirections.length; j++) {
              var redirection = postem.redirections[j];
              if (integRegex.test(redirection)) {
                urlArray.push(redirection);
              }
            }
          }
          post.url =  Math.max.apply(Math, urlArray) + 1;
          saveNewPost(post);
        }
      }
      else {
        post.url = newUrl ? newUrl : 1;
        saveNewPost(post);
      }

    });
  }
}, {

  event: 'update(posts/post)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function(
    $allonsy, $socket, $SocketsService, $i18nService, $message, PostModel, UserModel, WikiDigestModel,
    webUrlFactory, postsSummaryFactory, postsDescriptionFactory, postsLinkFactory, postsCoverThumbsFactory, postsEmojiFactory
  ) {
    if (!this.validMessage($message, {
      post: ['object', 'filled']
    })) {
      return;
    }

    if (!$message.post.id) {
      return $SocketsService.error($socket, $message, 'read(posts/post)', $i18nService._('Please send a "post" object.'));
    }

    if (!$message.post.title || typeof $message.post.title != 'string') {
      return $SocketsService.error($socket, $message, 'read(posts/post)', $i18nService._('Please send a post "title".'));
    }

    var async = require('async'),
        TagModel = DependencyInjection.injector.controller.get('TagModel'),
        isNewStatus = false,
        isNewUrl = false;

    function savePost(post, postUrlChanged) {
      UserModel.fromSocket($socket, function(err, contributor) {
        if (err || !contributor) {
          return $SocketsService.error($socket, $message, 'read(posts/post)', err);
        }

        post.updatedAt = new Date();
        post.contributors = post.contributors || [];

        var userFound = false;

        post.contributors.forEach(function(contributorFound) {
          if (contributorFound.id == $socket.user.id) {
            userFound = true;
            contributor.modifiedAt = post.updatedAt;
          }
        });

        if (!userFound) {
          var contributorPublicData = contributor.publicData();
          contributorPublicData.modifiedAt = post.updatedAt;

          post.contributors.push(contributorPublicData);
        }

        post.summary = postsSummaryFactory(post.content);
        post.description = postsDescriptionFactory(post.content);
        post.emojis = postsEmojiFactory(post);
        post.tags = TagModel.insertTags(post.tags, post.oldTags);

        post.search1 = post.title;
        post.search2 = TagModel.flatten(post.tags);
        post.search3 = PostModel.contentToText(post.content);

        postsLinkFactory(post, function(err, postsLinksAll) {
          if (err) {
            return $SocketsService.error($socket, $message, 'read(posts/post)', err);
          }

          post.links = postsLinksAll.postsLinks;
          post.linksPosts = postsLinksAll.availablePosts;

          postsCoverThumbsFactory(post, function() {
            post.save(function(err) {
              if (err) {
                return $SocketsService.error($socket, $message, 'read(posts/post)', err);
              }

              var metrics = [{
                key: 'wikiUpdatePost',
                name: 'Update article',
                description: 'Article is saved in the database.'
              }];

              if (isNewStatus) {
                metrics.push({
                  key: 'wikiEditChangeStatus',
                  name: 'Change status',
                  description: 'Change an article status (published/draft/obsolete).'
                });
              }

              if (isNewUrl) {
                metrics.push({
                  key: 'wikiEditPostUrl',
                  name: 'Change URL',
                  description: 'Save article with a new URL.'
                });
              }

              $allonsy.log('allons-y-wiki', 'posts:post-update', {
                label: 'Update the <strong>' + post.title + '</strong> article',
                socket: $socket,
                post: PostModel.mongo.objectId(post.id),
                postTitle: post.title,
                postContent: post.content,
                postUrl: post.url,
                postRedirections: post.redirections,
                postContentLength: post.content.length,
                postTags: post.tags,
                metrics: metrics
              });

              var postPublicData = post.publicData();
              PostModel.populateLocked($SocketsService, $socket, postPublicData);

              $SocketsService.emit($socket, {
                'route.url': /^\/wiki/
              }, null, 'read(posts/post)', {
                post: postPublicData,
                updated: true,
                enterUrl: $message.enterUrl,
                enterMode: $message.enterMode
              });

              PostModel.refreshPost(post);
              PostModel.callLastUpdatedPosts();

              if (postUrlChanged) {
                PostModel.searchPostLinks($message.post.id, false, function(err, posts) {
                  if (err) {
                    return $SocketsService.error($socket, $message, 'read(posts/post)', err);
                  }

                  posts = posts || [];

                  async.mapSeries(posts, function(matchedPost, nextPost) {
                    if (matchedPost.links) {
                      var postChanged = false;

                      for (var link in matchedPost.links) {
                        if (link.indexOf($message.post.id) != -1) {
                          postChanged = true;
                          var linkArr = matchedPost.links[link].split('#');
                          linkArr[0] = post.url;
                          matchedPost.links[link] = linkArr.join('#');
                        }
                      }

                      if (postChanged) {
                        matchedPost.save(function(err) {
                          if (err) {
                            return $SocketsService.error($socket, $message, 'read(posts/post)', err);
                          }
                        });
                      }
                    }

                    nextPost();
                  });
                });
              }

              WikiDigestModel.addContributor(contributor.id);

              contributor.postsContributed = contributor.postsContributed || [];

              if (contributor.postsContributed.indexOf(post.id) == -1) {
                contributor.postsContributed.push(post.id);

                contributor.save();
              }
            });
          });
        });
      });
    }

    PostModel
      .findOne({
        id: $message.post.id
      })
      .exec(function(err, post) {
        if (err) {
          return $SocketsService.error($socket, $message, 'read(posts/post)', err);
        }

        if (post.status != $message.post.status) {
          isNewStatus = true;
        }

        post.title = $message.post.title;
        post.content = $message.post.content;
        post.status = $message.post.status;
        post.cover = $message.post.cover || null;
        post.oldTags = post.tags || null;
        post.tags = $message.post.tags || null;

        var protectedUrls = PostModel.protectedUrls(),
            oldUrl = post.url,
            newUrl = webUrlFactory($message.post.url);

        if (newUrl && newUrl != oldUrl) {
          isNewUrl = true;

          var searchByUrlRegex = '^' + newUrl + '(-[0-9]+|)$';

          if (protectedUrls.indexOf(newUrl) > -1) {
            newUrl += '-1';
          }

          PostModel.searchAvaiblablePostsObjectsByUrlRegex(newUrl, searchByUrlRegex, function(err, matchedPosts) {
            if (err) {
              return $SocketsService.error($socket, $message, 'read(posts/post)', err);
            }

            if (Object.keys(matchedPosts).length) {
              var searchPattern = new RegExp('^' + newUrl + '-[0-9]+$'),
                  extractUrls = [],
                  newUrlInredirectionsPost = {};

              for (var key in matchedPosts) {
                if (matchedPosts[key].redirections && matchedPosts[key].redirections.indexOf(newUrl) != -1) {
                  newUrlInredirectionsPost[key] = matchedPosts[key];
                }
              }

              if (Object.keys(newUrlInredirectionsPost).length) {
                post.url = newUrl;
                if (newUrlInredirectionsPost.hasOwnProperty($message.post.id)) {
                  post.redirections.push(oldUrl);
                  post.redirections.splice(post.redirections.indexOf(newUrl), 1);
                  savePost(post, true);
                }
                else {
                  post.redirections.push(oldUrl);
                  var matchedPostOldRedirections = newUrlInredirectionsPost[Object.keys(newUrlInredirectionsPost)].redirections;
                  matchedPostOldRedirections.splice(matchedPostOldRedirections.indexOf(newUrl), 1);

                  PostModel
                    .update({
                      id: Object.keys(newUrlInredirectionsPost)[0]
                    }, {
                      redirections: matchedPostOldRedirections
                    })
                    .exec(function() {
                      savePost(post, true);
                    });
                }
              }
              else {
                for (var obj in matchedPosts) {
                  var postem = matchedPosts[obj];
                  extractUrls.push(postem.url);

                  for (var j = 0; j < postem.redirections.length; j++) {
                    extractUrls.push(postem.redirections[j]);
                  }
                }
                var versionArr = extractUrls.map(function(em) {
                  if (em == newUrl) {
                    return 1;
                  }
                  else {
                    return searchPattern.test(em) ? (em.match(/\d+$/) ? em.match(/\d+$/)[0] : -1) : -1;
                  }
                });
                var maxVersion = Math.max.apply(Math, versionArr) + 1;
                post.url = newUrl + '-' +  maxVersion;
                post.redirections.push(oldUrl);
                savePost(post, true);
              }
            }
            else {
              post.url = newUrl;
              post.redirections.push(oldUrl);
              savePost(post, true);
            }
          });
        }
        else {
          post.url = oldUrl;
          savePost(post);
        }
      });
  }
}, {

  event: 'delete(posts/post)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function($allonsy, $socket, $SocketsService, $i18nService, PostModel, TagModel, $message) {
    if (!this.validMessage($message, {
      id: 'filled'
    })) {
      return;
    }

    var async = require('async');

    PostModel
      .findOne({
        id: $message.id
      })
      .exec(function(err, deletedPost) {
        if (err || !deletedPost) {
          return $SocketsService.error($socket, $message, 'read(posts/post)', err);
        }

        PostModel
          .destroy({
            id: $message.id
          })
          .exec(function(err) {
            if (err) {
              return $SocketsService.error($socket, $message, 'read(posts/post)', err);
            }

            $allonsy.log('allons-y-wiki', 'posts:post-delete', {
              label: 'Delete the <strong>' + deletedPost.title + '</strong> article',
              socket: $socket,
              post: PostModel.mongo.objectId(deletedPost.id),
              postTitle: deletedPost.title,
              postContent: deletedPost.content,
              postUrl: deletedPost.url,
              postRedirections: deletedPost.redirections,
              postContentLength: deletedPost.content.length,
              postTags: deletedPost.tags,
              metric: {
                key: 'wikiDeletePost',
                name: 'Delete article',
                description: 'Remove an article from the database.'
              }
            });

            $SocketsService.emit($socket, {
              'route.url': /^\/wiki/
            }, null, 'read(posts/post)', {
              post: {
                id: $message.id
              },
              deleted: true
            });

            PostModel.callLastCreatedPosts();
            PostModel.callLastUpdatedPosts();
            PostModel.callMostOpenedPosts();

            TagModel.deleteTags(deletedPost.tags);

            PostModel.searchPostLinks($message.id, false, function(err, posts) {
              if (err) {
                return $SocketsService.error($socket, $message, 'read(posts/post)', err);
              }

              posts = posts || [];

              async.mapSeries(posts, function(post, nextPost) {
                var postsLinksIndex = post.postsLinks ? post.postsLinks.indexOf($message.id) : -1;

                if (postsLinksIndex > -1) {
                  post.postsLinks.splice(postsLinksIndex, 1);
                }

                if (post.links) {
                  var newPostLinks = post.links,
                      postChanged = false;

                  for (var link in post.links) {
                    if (link.indexOf($message.id) != -1) {
                      postChanged = true;
                      delete newPostLinks[link];
                    }
                  }

                  post.links = newPostLinks;

                  if (postChanged) {
                    post.content = post.content.replace(
                      new RegExp('<a[^>]+data-post-id="' + $message.id + '"[^>]+>', 'gi'),
                      function() {
                        return '<a href="/wiki/' + deletedPost.url + '">';
                      }
                    );

                    post.save(function(err) {
                      if (err) {
                        return $SocketsService.error($socket, $message, 'read(posts/post)', err);
                      }
                    });
                  }
                }
                nextPost();
              });

            });

            PostModel.callPostsCount();

            var UserModel = DependencyInjection.injector.controller.get('UserModel');

            UserModel
              .find({
                or: [{
                  postsCreated: $message.id
                }, {
                  postsContributed: $message.id
                }]
              })
              .exec(function(err, users) {

                users = users || [];

                async.mapSeries(users, function(user, nextUser) {

                  user.postsCreated = user.postsCreated || [];
                  user.postsContributed = user.postsContributed || [];

                  var postsCreatedIndex = user.postsCreated.indexOf($message.id),
                      postsContributedIndex = user.postsContributed.indexOf($message.id);

                  if (postsCreatedIndex > -1) {
                    user.postsCreated.splice(postsCreatedIndex, 1);
                  }

                  if (postsContributedIndex > -1) {
                    user.postsContributed.splice(postsContributedIndex, 1);
                  }

                  if (postsCreatedIndex > -1 || postsContributedIndex > -1) {
                    user.save(function() {
                      nextUser();
                    });
                  }
                  else {
                    nextUser();
                  }

                }, function() {

                  UserModel
                    .find({
                      'postsViewed.id': $message.id
                    })
                    .exec(function(err, users) {
                      if (err || !users || !users.length) {
                        return;
                      }

                      async.eachSeries(users, function(user, nextUser) {
                        for (var i = 0; i < user.postsViewed.length; i++) {
                          if (user.postsViewed[i].id == $message.id) {
                            user.postsViewed.splice(i, 1);
                            break;
                          }
                        }

                        user.save(nextUser);
                      }, function() { });
                    });

                });
              });

          });
      });
  }
}, {

  event: 'update(posts/post.lock)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function($allonsy, $socket, $SocketsService, $i18nService, PostModel, $message) {
    if (!this.validMessage($message, {
      id: 'filled'
    })) {
      return;
    }

    var alreadyLocked = false;

    $SocketsService.each(function(socket) {
      if (socket && socket.user && socket.user.postLocked == $message.id) {
        alreadyLocked = {};
        PostModel.fillLocked(alreadyLocked, socket);
        alreadyLocked = alreadyLocked.locked;

        return false;
      }
    });

    if (alreadyLocked) {
      return $SocketsService.error($socket, $message, 'read(posts/post.lock)', 'alreadyLocked', {
        id: $message.id,
        locked: alreadyLocked
      });
    }

    PostModel
      .findOne({
        id: $message.id
      })
      .exec(function(err, post) {
        if (err || !post) {
          return $SocketsService.error($socket, $message, 'read(posts/post.lock)', err);
        }

        var postPublicData = post.publicData();

        PostModel.applyLocked(postPublicData, $socket);

        $SocketsService.emit($socket, {
          'route.url': /^\/wiki/
        }, null, 'read(posts/post.lock)', {
          post: postPublicData
        });

        PostModel.refreshPost(post);

        PostModel.callPostsOpened();

        $allonsy.log('allons-y-wiki', 'posts:post-lock', {
          label: 'Lock the <strong>' + post.title + '</strong> article',
          socket: $socket,
          post: PostModel.mongo.objectId(post.id),
          postTitle: post.title
        });
      });
  }
}, {

  event: 'update(posts/post.unlock)',
  permissions: ['wiki-access', 'wiki-write'],
  controller: function($allonsy, $socket, $SocketsService, $i18nService, PostModel, $message) {
    var postId = $socket.user.postLocked;

    $socket.user.postLocked = null;

    PostModel
      .findOne({
        id: postId
      })
      .exec(function(err, post) {
        if (err || !post) {
          return $SocketsService.error($socket, $message, 'update(posts/post.unlock)', err);
        }

        $SocketsService.emit($socket, {
          'route.url': /^\/wiki/
        }, null, 'read(posts/post.unlock)', {
          id: postId
        });

        PostModel.refreshPost(post);

        PostModel.callPostsOpened();

        $allonsy.log('allons-y-wiki', 'posts:post-unlock', {
          label: 'Unlock the <strong>' + post.title + '</strong> article',
          socket: $socket,
          post: PostModel.mongo.objectId(post.id),
          postTitle: post.title
        });
      });
  }
}];
