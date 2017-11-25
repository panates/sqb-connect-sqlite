/* sqb-connect-sqlite
 ------------------------
 (c) 2017-present Panates
 SQB may be freely distributed under the MIT license.
 For details and documentation:
 https://panates.github.io/sqb-connect-sqlite/
 */

/**
 * Module dependencies.
 * @private
 */
const SqDriver = require('./SqDriver');

// noinspection JSUnusedGlobalSymbols
module.exports = {

  //createSerializer: require('sqb-serializer-sqlite').createSerializer,

  createDriver: function(config) {
    if (config.dialect === 'sqlite') {
      return new SqDriver(config);
    }
  },

  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4

};
