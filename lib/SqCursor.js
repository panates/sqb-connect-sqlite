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
 * Expose `SqCursor`.
 */
module.exports = SqCursor;

/**
 *
 * @param {Object} statement
 * @param {Object} options
 * @constructor
 */

function SqCursor(statement, options) {
  this._statement = statement;
  this._objectRows = options.objectRows;
  this.fields = [];
}

const proto = SqCursor.prototype = {
  get isClosed() {
    return !this._statement;
  }
};
proto.constructor = SqCursor;

proto.close = function(callback) {
  const self = this;
  if (!self._statement)
    return callback();
  self._statement.finalize(function(err) {
    if (!err)
      self._statement = undefined;
    callback(err);
  });
};

proto.fetch = function(nRows, callback) {
  nRows = parseInt(nRows, 10);
  if (this.isClosed)
    return callback(undefined, []);
  const self = this;
  const rows = [];
  const getNext = function() {
    self._statement.get(function(err, row) {
      if (err)
        return callback(err);

      if (!row) {
        if (!rows.length)
          callback();
        else
          callback(undefined, rows);
        return;
      }

      if (!self.fields.length)
        self._buildFields(row);

      // Convert object row to array row
      if (!self._objectRows) {
        var arr = [];
        self.fields.forEach(function(f) {
          arr.push(row[f.name]);
        });
        rows.push(arr);
      } else
        rows.push(row);

      if ((nRows && rows.length >= nRows))
        return self.close(function() {
          callback(undefined, rows);
        });
      setImmediate(getNext);
    });
  };
  getNext();
};

proto._buildFields = function(row) {
  const self = this;
  Object.getOwnPropertyNames(row).forEach(function(t) {
    self.fields.push({name: t});
  });
};
