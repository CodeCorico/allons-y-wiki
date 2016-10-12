module.exports = function() {
  'use strict';

  DependencyInjection.model('TagModel', function($allonsy, $AbstractModel, $RealTimeService) {

    var W = ['what', 'where', 'when', 'who', 'why', 'how'],

       _transactionsCounts = [],
       _tagsCount = 0;

    return $AbstractModel('TagModel', function() {

      return {
        identity: 'tags',
        connection: 'Tags',
        migrate: 'safe',
        autoCreatedAt: false,
        autoUpdatedAt: false,
        attributes: {
          name: {
            type: 'string',
            unique: true,
            required: true,
            index: true
          },
          usedCount: {
            type: 'integer',
            required: true,
            index: true,
            defaultsTo: 0
          }
        },

        init: function() {
          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

          this.totalChildrenUsedCount(function(total) {
            _tagsCount = total || 0;

            if ($WebHomeService) {
              $WebHomeService.metric({
                name: 'tagsCount',
                title: 'tags',
                value: _tagsCount
              });
            }
          });
        },

        validTags: function(tags) {
          tags = typeof tags != 'object' || !tags ? {} : tags;

          var newTags = {};

          W.forEach(function(w) {
            if (typeof tags[w] != 'object' || !tags[w] || !tags[w].length) {
              return;
            }

            tags[w].forEach(function(tag) {
              if (typeof tag != 'string') {
                return;
              }

              tag = tag.split(':');
              if (tag.length != 2) {
                return;
              }

              tag.forEach(function(tagPart, i) {
                tag[i] = tagPart
                  .toLowerCase()
                  .replace(/[^\w\u00C0-\u017F\s_-]/gi, '')
                  .replace(/\s+/gi, ' ')
                  .trim();
              });

              if (!tag[0] || !tag[1]) {
                return;
              }

              newTags[w] = newTags[w] || [];
              newTags[w].push(tag[0] + ':' + tag[1]);
            });
          });

          return newTags;
        },

        insertTags: function(tags, oldTags) {
          tags = this.validTags(tags);
          oldTags = this.validTags(oldTags);

          var news = [],
              olds = [];

          W.forEach(function(w) {
            if (tags[w]) {
              tags[w].forEach(function(tag) {
                var split = tag.split(':');
                news.push('master:' + split[0]);
                news.push('child:' + split[1]);
              });
            }
            if (oldTags[w]) {
              oldTags[w].forEach(function(tag) {
                var split = tag.split(':');
                olds.push('master:' + split[0]);
                olds.push('child:' + split[1]);
              });
            }
          });

          var countsToAdd = news.filter(function(value, index, self) {
            return self.indexOf(value) === index && olds.indexOf(value) < 0;
          });

          var countsToRemove = olds.filter(function(value, index, self) {
            return self.indexOf(value) === index && news.indexOf(value) < 0;
          });

          this.updateTagsCounts(countsToAdd, countsToRemove);

          return tags;
        },

        deleteTags: function(tags) {
          tags = this.validTags(tags);

          var countsToRemove = [];

          W.forEach(function(w) {
            if (tags[w]) {
              tags[w].forEach(function(tag) {
                var split = tag.split(':');
                countsToRemove.push('master:' + split[0]);
                countsToRemove.push('child:' + split[1]);
              });
            }
          });

          var countsToRemove = countsToRemove.filter(function(value, index, self) {
            return self.indexOf(value) === index;
          });

          this.updateTagsCounts(null, countsToRemove);

          return tags;
        },

        updateTagsCounts: function(countsToAdd, countsToRemove) {
          _transactionsCounts.push({
            countsToAdd: countsToAdd,
            countsToRemove: countsToRemove
          });

          if (_transactionsCounts.length > 1) {
            return;
          }

          this.transactionUpdateCounts();
        },

        nextTransactionUpdateCounts: function() {
          if (_transactionsCounts.length) {
            _transactionsCounts.shift();
          }

          this.transactionUpdateCounts();
        },

        createMissingTags: function(countsToAdd, callback) {
          var _this = this;

          if (!countsToAdd) {
            return callback();
          }

          this
            .find({
              name: countsToAdd
            })
            .exec(function(err, tags) {
              if (err) {
                return callback();
              }

              var names = tags.map(function(tag) {
                    return tag.name;
                  }),
                  toCreate = [];

              countsToAdd.forEach(function(tagName) {
                if (names.indexOf(tagName) < 0) {
                  toCreate.push(tagName);
                }
              });

              if (!toCreate.length) {
                return callback();
              }

              _this
                .create(toCreate.map(function(tagName) {
                  return {
                    name: tagName,
                    usedCount: 0
                  };
                }))
                .exec(function() {
                  callback();
                });
            });
        },

        incrementCountsTags: function(countsNames, value, callback) {
          if (!countsNames) {
            return callback();
          }

          var _this = this;

          $allonsy.log('allons-y-wiki', 'tags:tag-' + (value > 0 ? 'add' : 'remove'), {
            label: (value > 0 ? 'Add' : 'Remove') + ' tags',
            metric: value > 0 ? {
              key: 'wikiAddTags',
              name: 'Add tags',
              description: 'Save article with new tags in it.'
            } : {
              key: 'wikiRemoveTags',
              name: 'Remove tags',
              description: 'Save article with tags removed from it.'
            }
          });

          this.native(function(err, collection) {
            if (err) {
              return callback();
            }

            collection.update({
              entityType: _this.entityType,
              $or: countsNames.map(function(name) {
                return {
                  name: name
                };
              })
            }, {
              $inc: {
                usedCount: value
              }
            }, {
              multi: true
            }, function() {
              callback();
            });
          });
        },

        cleanCountsTags: function(callback) {
          this
            .destroy({
              usedCount: 0
            })
            .exec(function() {
              callback();
            });
        },

        transactionUpdateCounts: function() {
          var _this = this;

          if (!_transactionsCounts.length) {
            return;
          }

          var transaction = _transactionsCounts[0];

          transaction.countsToAdd = transaction.countsToAdd || [];
          transaction.countsToRemove = transaction.countsToRemove || [];

          var countsToAdd = transaction.countsToAdd.length ? transaction.countsToAdd : null,
              countsToRemove = transaction.countsToRemove.length ? transaction.countsToRemove : null,
              childrenToAdd = transaction.countsToAdd.filter(function(tag) {
                return tag.indexOf('child:') === 0;
              }),
              childrenToRemove = transaction.countsToRemove.filter(function(tag) {
                return tag.indexOf('child:') === 0;
              });

          _this.createMissingTags(countsToAdd, function() {
            _this.incrementCountsTags(countsToAdd, 1, function() {
              _this.incrementCountsTags(countsToRemove, -1, function() {
                _this.cleanCountsTags(function() {
                  if (childrenToAdd.length || childrenToRemove.length) {
                    _this.tagsCount(childrenToAdd.length - childrenToRemove.length);
                  }

                  _this.nextTransactionUpdateCounts();
                });
              });
            });
          });
        },

        tagsCount: function(add) {
          if (add === 0) {
            return;
          }

          _tagsCount += add;

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

          $WebHomeService.metric('tagsCount', _tagsCount);
        },

        totalChildrenUsedCount: function(callback) {
          var _this = this;

          this.native(function(err, collection) {
            collection.aggregate([{
              $match: {
                entityType: _this.entityType,
                name: /^child:/
              }
            }, {
              $group: {
                _id: null,
                total: {
                  $sum: '$usedCount'
                }
              }
            }], function(err, result) {
              callback(!err && result.length && result[0] && result[0].total || 0);
            });
          });
        },

        autocomplete: function(master, name, excludes, callback) {
          var keyword = master ? 'master' : 'child',
              findName = '^(' + keyword + ':' + (name || '').toLowerCase() + ')';

          var findQuery = {
            entityType: this.entityType,
            name: new RegExp(findName)
          };

          if (excludes && excludes.length) {
            findQuery = {
              $and: [findQuery, {
                name: {
                  $nin: excludes.map(function(exclude) {
                    return keyword + ':' + exclude.toLowerCase();
                  })
                }
              }]
            };
          }

          this.native(function(err, collection) {
            collection
              .find(findQuery, {}, {
                limit: 10,
                sort: [['usedCount', 'desc']]
              })
              .toArray(function(err, tags) {
                if (!err && tags && tags.length) {
                  tags = tags.map(function(tag) {
                    return {
                      value: tag.name
                        .replace(new RegExp(findName), name)
                        .replace(keyword + ':', ''),
                      display: (tag.name.replace(new RegExp(findName), name + '<strong>') + '</strong>')
                        .replace(keyword + ':', '')
                    };
                  });
                }

                callback(err, tags);
              });
          });
        },

        flatten: function(tags) {
          if (!tags || typeof tags != 'object') {
            return '';
          }

          var tagsFlatten = [];

          Object.keys(tags).forEach(function(tagKey) {
            tagsFlatten.push(tags[tagKey].join(' '));
          });

          return tagsFlatten.join(' ');
        }
      };

    });

  });

  return 'TagModel';
};
