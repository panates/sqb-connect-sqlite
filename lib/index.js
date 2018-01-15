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
const SqAdapter = require('./SqAdapter');
const SqMetaOperator = require('./SqMetaOperator');

module.exports = {
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4
};

module.exports.createAdapter = function(config) {
  /* istanbul ignore else */
  if (config.dialect === 'sqlite') {
    return new SqAdapter(config);
  }
};

module.exports.createMetaOperator = function(config) {
  /* istanbul ignore else */
  if (config.dialect === 'sqlite') {
    return new SqMetaOperator();
  }
};
