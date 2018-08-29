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

let sessionIdGen = 0;

/**
 *
 * @param {Object} client
 * @constructor
 */
class SqConnection {
  constructor(client) {
    this.client = client;
    this.sessionId = ++sessionIdGen;
  }

  /**
   * @return {boolean}
   */
  get isClosed() {
    return !this.client;
  }

  close() {
    return new Promise((resolve, reject) => {
      if (!this.client)
        return resolve();
      const conn = this.client;
      this.client = undefined;
      conn.close(err => {
        if (err)
          return reject(err);
        resolve();
      });
    });
  }

  /**
   *
   * @param {string} query
   * @param {string} query.sql
   * @param {Array|Object} query.values
   * @param {Object} options
   * @param {Integer} [options.fetchRows]
   * @param {Boolean} [options.cursor]
   * @private
   */
  execute(query, options) {
    if (this.isClosed)
      return Promise.reject(new Error('Connection closed'));

    return new Promise((resolve, reject) => {
      const statement = this.client.prepare(query.sql, query.values, (err) => {
        if (err)
          return reject(err);

        const cursor = new SqCursor(statement, options);
        if (options.cursor)
          return resolve({
            fields: cursor.fields,
            cursor: cursor
          });

        return cursor.fetch(options.fetchRows).then(rows => {
          return cursor.close().then(() => {
            if (rows)
              return resolve({fields: cursor.fields, rows: rows});
            resolve({fields: [], rows: []});
          });
        });
      });
    });
  }

  /**
   *
   * @return {Promise}
   */
  startTransaction() {
    return new Promise((resolve, reject) => {
      this.client.run('BEGIN;', (err) => {
        if (!err || err.message.indexOf('cannot start a transaction'))
          return resolve();
        reject(err);
      });
    });
  }

  /**
   *
   * @return {Promise|null}
   */
  commit() {
    return new Promise((resolve, reject) => {
      this.client.run('COMMIT;', (err) => {
        if (!err || err.message.indexOf('no transaction'))
          return resolve();
        reject(err);
      });
    });
  }

  /**
   *
   * @param {Function} [callback]
   * @return {Promise|null}
   */
  rollback(callback) {
    return new Promise((resolve, reject) => {
      this.client.run('ROLLBACK;', (err) => {
        if (!err || err.message.indexOf('no transaction'))
          return resolve();
        reject(err);
      });
    });
  }

  /**
   *
   * @return {Promise|null}
   */
  test() {
    return new Promise((resolve, reject) => {
      this.client.run('select 1;', [], {}, (err) => {
        if (err)
          return reject(err);
        return resolve();
      });
    });
  }
}

/**
 * Expose `SqConnection`.
 */
module.exports = SqConnection;
