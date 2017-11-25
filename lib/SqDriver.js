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
const sqlite3 = require('sqlite3');
const SqConnection = require('./SqConnection');
const SqMetaOperator = require('./SqMetaOperator');

const QUESTION_MARK = 1;

/**
 * Expose `SqDriver`.
 */

module.exports = SqDriver;

function SqDriver(config) {
  this.config = Object.assign({}, config);
  this.paramType = QUESTION_MARK;
  this.supportsSchemas = false;
  this.metaData = new SqMetaOperator();
}

const proto = SqDriver.prototype;

proto.createConnection = function(callback) {
  const config = this.config;
  var db;
  const callbackFn = function(err) {
    if (err)
      return callback(err);
    if (config.busyTimeout)
      db.configure('busyTimeout', config.busyTimeout);
    callback(undefined, new SqConnection(db));
  };

  if (config.mode)
    db = new sqlite3.Database(config.database, config.mode, callbackFn);
  else
    db = new sqlite3.Database(config.database, callbackFn);

};
