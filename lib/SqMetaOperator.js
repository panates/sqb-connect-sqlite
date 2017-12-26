/* sqb-connect-sqlite
 ------------------------
 (c) 2017-present Panates
 SQB may be freely distributed under the MIT license.
 For details and documentation:
 https://panates.github.io/sqb-connect-sqlite/
 */

const waterfall = require('putil-waterfall');
const TaskQueue = require('putil-taskqueue');

/**
 * Expose `SqMetaData`.
 */
module.exports = SqMetaData;

/**
 * @param {Object} sqbObj
 * @constructor
 */
function SqMetaData(sqbObj) {
  this.refreshQueue = new TaskQueue();
  this.needRefresh = true;
  this.supportsSchemas = false;
}

const proto = SqMetaData.prototype = {};
proto.constructor = SqMetaData;

proto.invalidate = function() {
  this.needRefresh = true;
};

proto.refresh = function(db, callback) {
  if (!this.needRefresh)
    return callback();
  this.needRefresh = false;
  const self = this;
  waterfall([
    function(next) {

      /* Create sqb$all_columns temporary table */
      db.execute(
          'CREATE temporary TABLE if not exists sqb$all_columns (\n' +
          '    id          INTEGER     PRIMARY KEY AUTOINCREMENT,\n' +
          '    schema_name  TEXT,\n' +
          '    table_name  TEXT,\n' +
          '    column_name TEXT,\n' +
          '    column_number INTEGER,\n' +
          '    data_type   TEXT,\n' +
          '    data_type_mean TEXT,\n' +
          '    char_length INTEGER,\n' +
          '    data_size INTEGER,\n' +
          '    default_value  TEXT,\n' +
          '    is_notnull  BOOLEAN,\n' +
          '    pk          BOOLEAN\n' +
          ');', next);
    },

    /* Create sqb$all_constraints temporary table */
    function(next) {
      db.execute(
          'CREATE temporary TABLE if not exists sqb$all_constraints (\n' +
          '    id          INTEGER     PRIMARY KEY AUTOINCREMENT,\n' +
          '    schema_name  TEXT,\n' +
          '    table_name  TEXT,\n' +
          '    constraint_name TEXT,\n' +
          '    constraint_type CHAR,\n' +
          '    column_name     TEXT,\n' +
          '    foreign_table_name TEXT,\n' +
          '    foreign_column_name TEXT\n' +
          ');', next);
    },

    /* Empty sqb$all_columns temporary table */
    function(next) {
      db.execute('delete from sqb$all_columns', next);
    },

    /* Empty sqb$all_constraints temporary table */
    function(next) {
      db.execute('delete from sqb$all_constraints', next);
    },

    /* Fetch all tables */
    function(next) {
      self.queryTables(db)
          .execute({
            rowset: false,
            fetchRows: 0,
            objectRows: true
          }, next);
    },

    /* Iterate all tables and insert columns and constraints info */
    function(next, resp) {
      waterfall.every(resp.rows, function(next, tbl) {

        waterfall([
          /* Fetch table info for columns, primary keys */
          function(next) {
            db.execute('PRAGMA table_info(' + tbl.table_name + ');', null, {
              rowset: false,
              fetchRows: 9999,
              objectRows: true
            }, function(err, resp) {
              if (err)
                return next(err);
              /* Iterate columns */
              var colnum = 0;
              waterfall.every(resp.rows, function(next, col) {
                waterfall([
                  /* Insert column info */
                  function(next) {
                    const dt = parseDataType(col.type);
                    db.insert({
                      table_name: tbl.table_name,
                      column_name: col.name,
                      column_number: ++colnum,
                      data_type: dt.data_type,
                      data_type_mean: dt.data_type_mean,
                      char_length: dt.char_length,
                      data_size: dt.data_size,
                      default_value: col.dflt_value,
                      is_notnull: col.notnull,
                      pk: col.pk
                    }).into('sqb$all_columns')
                        .execute({autoCommit: true}, next);
                  },
                  /* Insert primary key constraint info */
                  function(next) {
                    if (!col.pk)
                      return next();
                    db.insert({
                      table_name: tbl.table_name,
                      constraint_name: 'PK_' + tbl.table_name.toUpperCase() +
                      '_' + col.name.toUpperCase(),
                      constraint_type: 'P',
                      column_name: col.name.toUpperCase()
                    }).into('sqb$all_constraints').execute(next);
                  }
                ], next);

              }, next);
            });
          },
          /* Fetch foreign keys */
          function() {
            db.execute('PRAGMA foreign_key_list(' + tbl.table_name +
                ');', null, {
              rowset: false,
              fetchRows: 9999,
              objectRows: true
            }, function(err, resp) {
              if (err)
                return next(err);
              /* Iterate columns */
              waterfall.every(resp.rows, function(next, row) {
                db.insert({
                  table_name: tbl.table_name,
                  constraint_name: 'FK_' + tbl.table_name.toUpperCase() + '_' +
                  row.from.toUpperCase(),
                  constraint_type: 'F',
                  column_name: row.from.toUpperCase(),
                  foreign_table_name: row.table.toUpperCase(),
                  foreign_column_name: row.to.toUpperCase()
                }).into('sqb$all_constraints').execute(next);
              }, next);
            });
          }
        ], next);

      }, next);

    }
  ], callback);
};

proto.querySchemas = function(db) {
  return db
      .select('1 schema_name')
      .where(['1', 2]);
};

proto.queryTables = function(db) {
  return db
      .select('name table_name')
      .from('sqlite_master t')
      .where(['type', 'table'])
      .orderBy('name');
};

proto.queryColumns = function(db) {
  const query = db
      .select('schema_name', 'table_name', 'column_name', 'data_type',
          'data_type_mean', 'char_length', 'data_size',
          'is_notnull', 'default_value', 'pk')
      .from('sqb$all_columns');
  const self = this;
  query.beforeExecute(function(callback) {
    self.refreshQueue.enqueue(function(done) {
      self.refresh(db, function(err) {
        callback(err);
        done();
      });
    });
  });
  return query;
};

proto.queryPrimaryKeys = function(db) {
  const query = db
      .select('schema_name', 'table_name', 'constraint_name', 'column_name column_names')
      .from('sqb$all_constraints')
      .where(['constraint_type', 'P']);
  const self = this;
  query.beforeExecute(function(callback) {
    self.refreshQueue.enqueue(function(done) {
      self.refresh(db, function(err) {
        callback(err);
        done();
      });
    });
  });
  return query;
};

proto.queryForeignKeys = function(db) {
  const query = db
      .select('schema_name', 'table_name', 'constraint_name', 'column_name',
          'foreign_table_name', 'foreign_column_name')
      .from('sqb$all_constraints')
      .where(['constraint_type', 'F']);
  const self = this;
  query.beforeExecute(function(callback) {
    self.refreshQueue.enqueue(function(done) {
      self.refresh(db, function(err) {
        callback(err);
        done();
      });
    });
  });
  return query;
};

proto.getTableColumns = function(db, schema, tableName, callback) {
  db.execute('PRAGMA table_info(' + tableName + ');', null, {
    fetchRows: 0,
    objectRows: true,
    naming: 'lowercase'
  }, function(err, resp) {
    if (err)
      return reject(err);
    const result = {};
    resp.rows.forEach(function(col, i) {
      const dt = parseDataType(col.type);
      result[col.name] = {
        column_name: col.name,
        column_number: i + 1,
        data_type: dt.data_type,
        data_type_mean: dt.data_type_mean,
        char_length: dt.char_length,
        data_size: dt.data_size,
        default_value: col.dflt_value,
        is_notnull: !!col.notnull,
        pk: !!col.pk
      };
    });
    callback(null, result);
  });
};

proto.getTablePrimaryKey = function(db, schema, tableName, callback) {
  db.execute('PRAGMA table_info(' + tableName + ');', null, {
    fetchRows: 0,
    objectRows: true,
    naming: 'lowercase'
  }, function(err, resp) {
    if (err)
      return reject(err);
    var col;
    for (var i = 0; i < resp.rows.length; i++) {
      col = resp.rows[i];
      if (col.pk) {
        callback(null, {
          column_names: col.name,
          constraint_name: ('PK_' + tableName + '_' +
              col.name.toUpperCase())
        });
        return;
      }
    }
    callback();
  });
};

proto.getTableForeignKeys = function(db, schema, tableName, callback) {
  db.execute('PRAGMA foreign_key_list(' + tableName + ');', null, {
    fetchRows: 100000,
    objectRows: true,
    naming: 'lowercase'
  }, function(err, resp) {
    if (err)
      return reject(err);
    if (resp.rows.length) {
      const result = [];
      resp.rows.forEach(function(row) {
        result.push({
          constraint_name: 'FK_' + tableName + '_' + row.from.toUpperCase(),
          column_name: row.from.toUpperCase(),
          foreign_table_name: row.table.toUpperCase(),
          foreign_column_name: row.to.toUpperCase()
        });
      });
      callback(null, result);
      return;
    }
    callback();
  });
};

function parseDataType(s) {
  const m = s.match(/(\w+) *(?:\((\d+)\))?/);
  const dataType = m[1];
  const len = m[2] ? parseInt(m[2], 10) : null;
  const o = {
    data_type: dataType
  };
  switch (o.data_type) {
    case 'BIGINT':
    case 'INTEGER':
    case 'BLOB':
      o.data_type_mean = o.data_type;
      break;
    case 'DOUBLE':
    case 'REAL':
    case 'DECIMAL':
    case 'NUMERIC':
      o.data_type_mean = 'NUMBER';
      break;
    case 'INT':
      o.data_type_mean = 'INTEGER';
      break;
    case 'DATETIME':
      o.data_type_mean = 'TIMESTAMP';
      break;
    default:
      o.data_type_mean = 'VARCHAR';
  }
  o.char_length = (o.data_type_mean === 'VARCHAR' && len) || null;
  o.data_size = (o.data_type_mean !== 'VARCHAR' && len) || null;
  return o;
}