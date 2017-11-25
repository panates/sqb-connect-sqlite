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
const SqCursor = require('./SqCursor');

/**
 * Expose `SqConnection`.
 */
module.exports = SqConnection;

var sessionIdGen = 0;

/**
 *
 * @param {Object} client
 * @constructor
 */
function SqConnection(client) {
  this.client = client;
  this.sessionId = ++sessionIdGen;
}

const proto = SqConnection.prototype = {
  /**
   * @return {boolean}
   */
  get isClosed() {
    return !this.client;
  }
};
proto.constructor = SqConnection;

/**
 * @param {Function} callback
 */
proto.close = function(callback) {
  if (!this.client)
    return callback();
  const conn = this.client;
  this.client = undefined;
  conn.close(callback);
};

/**
 *
 * @param {string} sql
 * @param {Array|Object} params
 * @param {Object} options
 * @param {Function} callback
 * @private
 */
proto.execute = function(sql, params, options, callback) {

  if (this.isClosed) {
    callback(new Error('Connection closed'));
    return;
  }

  const statement = this.client.prepare(sql, params, function(err) {
    if (err)
      return callback(err);

    const cursor = new SqCursor(statement, options);
    if (options.cursor) {
      return callback(undefined, {
        fields: cursor.fields,
        cursor: cursor
      });
    }
    cursor.fetch(options.fetchRows, function(err, rows) {
      cursor.close(function() {
        /* istanbul ignore next */
        if (err)
          return callback(err);
        if (rows)
          callback(undefined, {fields: cursor.fields, rows: rows});
        else
          callback(undefined, {fields: [], rows: []});
      });
    });
  });
};

proto.startTransaction = function(callback) {
  this.client.run('BEGIN;', function(err) {
    if (err && err.message.indexOf('cannot start a transaction'))
      return callback();
    callback(err);
  });
};

proto.commit = function(callback) {
  this.client.run('COMMIT;', function(err) {
    if (err && err.message.indexOf('no transaction'))
      return callback();
    callback(err);
  });
};

proto.rollback = function(callback) {
  this.client.run('ROLLBACK;', function(err) {
    if (err && err.message.indexOf('no transaction'))
      return callback();
    callback(err);
  });
};

proto.test = function(callback) {
  const self = this;
  self.client.run('select 1;', [], {}, function(err) {
    return callback(err);
  });
};
