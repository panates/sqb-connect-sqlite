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

class SqDriver {

  constructor(config) {
    this.config = Object.assign({}, config);
    this.paramType = 1; // QUESTION_MARK
  }

  /**
   * @return {Promise<SqConnection>}
   */
  createConnection() {
    return new Promise((resolve, reject) => {
      let db;
      const config = this.config;
      const callbackFn = (err) => {
        /* istanbul ignore next */
        if (err)
          return reject(err);
        /* istanbul ignore next: we don't test sqlite driver itself */
        if (config.busyTimeout)
          db.configure('busyTimeout', config.busyTimeout);
        resolve(new SqConnection(db));
      };
      /* istanbul ignore next: we don't test sqlite driver itself */
      if (config.mode)
        db = new sqlite3.Database(config.database, config.mode, callbackFn);
      else
        db = new sqlite3.Database(config.database, callbackFn);
    });
  };

}

/**
 * Expose `SqDriver`.
 */
module.exports = SqDriver;
