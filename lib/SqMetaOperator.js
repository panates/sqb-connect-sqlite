/* sqb-connect-sqlite
 ------------------------
 (c) 2017-present Panates
 SQB may be freely distributed under the MIT license.
 For details and documentation:
 https://panates.github.io/sqb-connect-sqlite/
 */

const waterfall = require('putil-waterfall');

/**
 * Expose `SqMetaData`.
 */
module.exports = SqMetaData;

/**
 * @param {Object} sqbObj
 * @constructor
 */
function SqMetaData(sqbObj) {
}

const proto = SqMetaData.prototype = {};
proto.constructor = SqMetaData;

proto.query = function(sqbObj, request, callback) {
  const response = {
    tables: {}
  };

  waterfall([
    function(next) {
      fetchTables(sqbObj, request, response, next);
    }
  ], function(err) {
    if (err)
      return callback(err);
    callback(undefined, response);
  });

};

function fetchTables(sqbObj, request, response, callback) {
  var tableKeys;
  if (request.tables !== '*') {
    // Replace schema names to upper case names
    tableKeys = request.tables
        .map(function(key) {
          const upname = String(key).toUpperCase();
          if (upname !== key) {
            request.tables[upname] = request.tables[key];
            delete request.tables[key];
          }
          return upname;
        });
  }

  waterfall([
    // Fetch tables
    function(next) {
      const query = sqbObj
          .select('name', 'sql')
          .from('sqlite_master t')
          .where(['type', 'table']);
      if (tableKeys && tableKeys.length)
        query.where(['upper(name)', tableKeys]);
      query.execute(function(err, result) {
        if (err)
          return callback(err);
        const rowset = result.rowset;
        var name;
        var sql;
        while (rowset.next()) {
          name = rowset.get('name');
          sql = rowset.get('name');
          response.tables = response.tables || {};
          response.tables[name] = {
            columns: {}
          };
        }
        next();
      });
    },

    // Fetch columns
    function(next) {
      waterfall.every(Object.getOwnPropertyNames(response.tables),
          function(next, tableName) {
            sqbObj.execute('PRAGMA table_info(' + tableName + ');',
                function(err, result) {
                  if (err)
                    return callback(err);
                  const rowset = result.rowset;
                  var table;
                  var o;
                  var v;
                  var pkCols = {
                    length: 0
                  };
                  table = response.tables[tableName];
                  while (rowset.next()) {
                    var dataType = rowset.get('type');
                    switch (dataType) {
                      case 'TEXT':
                        dataType = 'VARCHAR';
                        break;
                    }
                    o = {
                      data_type: dataType,
                      data_type_org: rowset.get('type')
                    };
                    if ((v = rowset.get('dflt_value')))
                      o.default_value = v;
                    if (rowset.get('pk'))
                      o.pk = true;
                    if (rowset.get('notnull'))
                      o.nullable = true;
                    table.columns[rowset.get('name')] = o;

                    if (rowset.get('pk')) {
                      pkCols[rowset.get('pk')] = rowset.get('name');
                      pkCols.length++;
                    }
                  }
                  if (pkCols.length) {
                    table.primaryKey = {
                      constraint_name: 'PK_' + tableName,
                      column: ''
                    };
                    var i = 0;
                    while (++i <= pkCols.length) {
                      table.primaryKey.column +=
                          (table.primaryKey.column ? ',' : '') +
                          pkCols[i];
                    }
                  }
                  next();
                });
          }, next);
    },

    // Fetch foreign keys
    function(next) {
      waterfall.every(Object.getOwnPropertyNames(response.tables),
          function(next, tableName) {
            sqbObj.execute('PRAGMA foreign_key_list(' + tableName + ');',
                function(err, result) {
                  if (err)
                    return callback(err);
                  const rowset = result.rowset;
                  var table = response.tables[tableName];
                  table.foreignKeys = table.foreignKeys || [];
                  while (rowset.next()) {
                    table.foreignKeys.push({
                      constraint_name: 'FK_' + tableName,
                      column_name: rowset.get('from'),
                      remote_table_name: rowset.get('table'),
                      remote_columns: rowset.get('to')
                    });
                  }
                  next();
                });
          }, next);
    }

  ], callback);
}
