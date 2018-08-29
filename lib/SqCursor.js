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

/**
 *
 * @param {Object} statement
 * @param {Object} options
 * @constructor
 */

class SqCursor {
  constructor(statement, options) {
    this._statement = statement;
    this._objectRows = options.objectRows;
    this.fields = [];
  }

  get isClosed() {
    return !this._statement;
  }

  close() {
    if (!this._statement)
      return Promise.resolve();
    return new Promise((resolve, reject) => {
      this._statement.finalize((err) => {
        /* istanbul ignore next */
        if (err)
          return reject(err);
        this._statement = undefined;
        resolve();
      });
    });
  };

  fetch(nRows) {
    if (this.isClosed)
      return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      nRows = parseInt(nRows, 10);
      const rows = [];
      const getNext = () => {
        this._statement.get((err, row) => {
          /* istanbul ignore next */
          if (err)
            return reject(err);

          if (!row)
            return resolve(rows.length ? rows : []);

          if (!this.fields.length)
            for (const t of Object.getOwnPropertyNames(row)) {
              this.fields.push({name: t});
            }

          // Convert object row to array row
          if (!this._objectRows) {
            let arr = [];
            for (const f of this.fields) {
              arr.push(row[f.name]);
            }
            rows.push(arr);
          } else
            rows.push(row);

          if ((nRows && rows.length >= nRows)) {
            this.close()
                .then(() => resolve(rows))
                .catch(e => reject(e));
            return;
          }
          setImmediate(getNext);
        });
      };
      getNext();
    });
  }

}

/**
 * Expose `SqCursor`.
 */
module.exports = SqCursor;
