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
const waterfall = require('putil-waterfall');

let sessionIdGen = 0;

/**
 *
 * @param {Object} client
 * @constructor
 */
class SqConnection {
  constructor(client) {
    this.intlcon = client;
    this.sessionId = ++sessionIdGen;
  }

  /**
   * @return {boolean}
   */
  get isClosed() {
    return !this.intlcon;
  }

  close() {
    return new Promise((resolve, reject) => {
      if (!this.intlcon)
        return resolve();
      const conn = this.intlcon;
      this.intlcon = undefined;
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
   * @param {Array} query.values
   * @param {Object} options
   * @param {Integer} [options.fetchRows]
   * @param {Boolean} [options.cursor]
   * @param {Boolean} [options.autoCommit]
   * @public
   * @return {Promise<Object>}
   */
  execute(query, options) {
    if (this.isClosed)
      return Promise.reject(new Error('Connection closed'));

    return waterfall([

      /* Start transaction if auto commit is off */
      (next) => {
        if (options.autoCommit)
          return next();
        return this.startTransaction();
      },

      /* Execute the query */
      () => this._execute(query, options),

      /* Commit transaction if auto commit is on */
      (next, result) => {
        if (!options.autoCommit)
          return next(null, result);
        return this.commit().then(() => result);
      }
    ]);
  }

  /**
   *
   * @param {string} query
   * @param {Object} options
   * @private
   * @return {Promise<Object>}
   */
  _execute(query, options) {
    return new Promise((resolve, reject) => {
      const statement = this.intlcon.prepare(query.sql, query.values, (err) => {
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
      this.intlcon.run('BEGIN;', (err) => {
        if (!err || err.message.indexOf('cannot start a transaction'))
          return resolve();
        reject(err);
      });
    });
  }

  /**
   *
   * @return {Promise}
   */
  commit() {
    return new Promise((resolve, reject) => {
      this.intlcon.run('COMMIT;', (err) => {
        if (!err || err.message.indexOf('no transaction'))
          return resolve();
        reject(err);
      });
    });
  }

  /**
   *
   * @param {Function} [callback]
   * @return {Promise}
   */
  rollback(callback) {
    return new Promise((resolve, reject) => {
      this.intlcon.run('ROLLBACK;', (err) => {
        if (!err || err.message.indexOf('no transaction'))
          return resolve();
        reject(err);
      });
    });
  }

  /**
   *
   * @return {Promise}
   */
  test() {
    return new Promise((resolve, reject) => {
      this.intlcon.run('select 1;', [], {}, (err) => {
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
