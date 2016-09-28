module.exports = function() {
  'use strict';

  DependencyInjection.model('WikiDigestModel', function($AbstractModel, $RealTimeService) {

    var REALTIME_EVENTS = {
      'wiki-contributorscount': {
        permissions: ['wiki-access'],
        call: 'callContributorsCount'
      }
    };

    return $AbstractModel('WikiDigestModel', function() {

      return {
        identity: 'wikidigest',
        connection: 'WikiDigest',
        migrate: 'safe',
        autoCreatedAt: false,
        autoUpdatedAt: false,
        attributes: {
          name: {
            type: 'string',
            index: true
          }
        },

        init: function() {
          var _this = this;

          Object.keys(REALTIME_EVENTS).forEach(function(eventName) {
            if (REALTIME_EVENTS[eventName].call) {
              var call = REALTIME_EVENTS[eventName].call;

              REALTIME_EVENTS[eventName].call = function() {
                _this[call].apply(_this, arguments);
              };
            }
          });

          $RealTimeService.registerEvents(REALTIME_EVENTS);
        },

        addContributor: function(userId, callback) {
          var _this = this;

          this
            .findOrCreate({
              name: 'contributors'
            })
            .exec(function(err, digest) {
              if (err) {
                return callback(err);
              }

              digest.contributors = digest.contributors || [];

              var contributorFound = null;

              for (var i = 0; i < digest.contributors.length; i++) {
                if (digest.contributors[i].user == userId) {
                  contributorFound = digest.contributors[i];

                  break;
                }
              }

              if (!contributorFound) {
                digest.contributors.push({
                  user: userId,
                  date: new Date()
                });

                digest.updatedAt = new Date();
                digest.save(function() {
                  _this.callContributorsCount();

                  if (callback) {
                    callback();
                  }
                });
              }
              else if (callback) {
                callback();
              }
            });
        },

        callContributorsCount: function($socket, eventName, args, callback) {
          eventName = eventName || 'wiki-contributorscount';

          this
            .findOrCreate({
              name: 'contributors'
            })
            .exec(function(err, digest) {
              if (err) {
                return callback(err);
              }

              digest.contributors = digest.contributors || [];

              var last30days = 0,
                  beforeLast30days = 0,
                  dateLastMonth = new Date(),
                  dateBeforeLastMonth = new Date();

              dateLastMonth.setDate(dateLastMonth.getDate() - 30);
              dateBeforeLastMonth.setDate(dateBeforeLastMonth.getDate() - 60);

              digest.contributors.forEach(function(contributor) {
                contributor.date = new Date(contributor.date);

                if (contributor.date >= dateLastMonth) {
                  last30days++;
                }
                else if (contributor.date >= dateBeforeLastMonth && contributor.date < dateLastMonth) {
                  beforeLast30days++;
                }
              });

              var newContributorsPercent = 0;
              if (last30days && beforeLast30days) {
                newContributorsPercent = last30days >= beforeLast30days ? last30days / beforeLast30days : -(beforeLast30days / last30days);
                newContributorsPercent = Math.round(newContributorsPercent * 10) / 10;
              }

              $RealTimeService.fire(eventName, {
                contributorsCount: digest.contributors.length,
                newContributorsCount: last30days,
                newContributorsPercent: newContributorsPercent
              }, $socket || null);

              if (callback) {
                callback();
              }
            });
        }
      };

    });

  });

  return 'WikiDigestModel';
};
