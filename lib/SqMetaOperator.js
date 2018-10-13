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
 * @param {Object} sqbObj
 * @constructor
 */
class SqMetaData {
  constructor(sqbObj) {
    this.refreshQueue = new TaskQueue();
    this.needRefresh = true;
    this.supportsSchemas = false;
  }

  invalidate() {
    this.needRefresh = true;
  }

  querySchemas(conn) {
    return conn
        .select(conn.raw('1 schema_name'))
        .where(conn.raw('1=2'));
  }

  queryTables(conn) {
    return conn
        .select('name table_name')
        .from('sqlite_master t')
        .where({type: 'table'})
        .orderBy('name');
  };

  queryColumns(db) {
    const query = db
        .select('schema_name', 'table_name', 'column_name', 'data_type',
            'data_type_mean', 'char_length', 'data_size',
            'is_notnull', 'default_value', 'pk')
        .from('sqb$all_columns');
    //console.log(query.generate().sql);
    query.on('execute', (conn) => {
      return this.refreshQueue.enqueue(() => this.refresh(conn));
    });
    return query;
  };

  queryPrimaryKeys(conn) {
    const query = conn
        .select('schema_name', 'table_name', 'constraint_name', 'column_name column_names')
        .from('sqb$all_constraints')
        .where({constraint_type: 'P'});
    query.on('execute', (conn) => {
      return this.refreshQueue.enqueue(() => this.refresh(conn));
    });
    return query;
  };

  queryForeignKeys(conn) {
    const query = conn
        .select('schema_name', 'table_name', 'constraint_name', 'column_name',
            'foreign_table_name', 'foreign_column_name')
        .from('sqb$all_constraints')
        .where({constraint_type: 'F'});
    const self = this;
    query.on('execute', (conn) => {
      return this.refreshQueue.enqueue(() => this.refresh(conn));
    });
    return query;
  };

  getTableColumns(conn, schema, tableName) {
    return conn.execute('PRAGMA table_info(' + tableName + ');', {
      cursor: false,
      fetchRows: 0,
      objectRows: true,
      naming: 'lowercase'
    }).then(resp => {
      const result = {};
      for (const [i, col] of  resp.rows.entries()) {
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
      }
      return result;
    });
  };

  getTablePrimaryKey(conn, schema, tableName) {
    return conn.execute('PRAGMA table_info(' + tableName + ');', {
      cursor: false,
      fetchRows: 0,
      objectRows: true,
      naming: 'lowercase'
    }).then(resp => {
      for (const col of resp.rows) {
        /* istanbul ignore else */
        if (col.pk) {
          return {
            column_names: col.name,
            constraint_name: ('PK_' + tableName + '_' +
                col.name.toUpperCase())
          };
        }
      }
      return null;
    });
  };

  getTableForeignKeys(conn, schema, tableName) {
    return conn.execute('PRAGMA foreign_key_list(' + tableName + ');', {
      cursor: false,
      fetchRows: 100000,
      objectRows: true,
      naming: 'lowercase'
    }).then(resp => {
      /* istanbul ignore else */
      if (resp.rows.length) {
        const result = [];
        for (const row of resp.rows) {
          result.push({
            constraint_name: 'FK_' + tableName + '_' + row.from.toUpperCase(),
            column_name: row.from.toUpperCase(),
            foreign_table_name: row.table.toUpperCase(),
            foreign_column_name: row.to.toUpperCase()
          });
        }
        return result;
      }
      return null;
    });
  };

  refresh(conn) {
    if (!this.needRefresh)
      return Promise.resolve();
    this.needRefresh = false;

    return waterfall([
      /* Create sqb$all_columns temporary table */
      () => conn.execute(
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
          ');'),

      /* Create sqb$all_constraints temporary table */
      () => conn.execute(
          'CREATE temporary TABLE if not exists sqb$all_constraints (\n' +
          '    id          INTEGER     PRIMARY KEY AUTOINCREMENT,\n' +
          '    schema_name  TEXT,\n' +
          '    table_name  TEXT,\n' +
          '    constraint_name TEXT,\n' +
          '    constraint_type CHAR,\n' +
          '    column_name     TEXT,\n' +
          '    foreign_table_name TEXT,\n' +
          '    foreign_column_name TEXT\n' +
          ');'),

      /* Empty sqb$all_columns temporary table */
      () => conn.delete('sqb$all_columns').execute(),

      /* Empty sqb$all_constraints temporary table */
      () => conn.delete('sqb$all_constraints').execute(),

      /* Fetch all tables */
      () => this.queryTables(conn)
          .execute({
            cursor: false,
            fetchRows: 0,
            objectRows: true
          }),

      /* Iterate all tables and insert columns and constraints info */
      (next, resp) => {
        return waterfall.every(resp.rows, (next, tbl) => {

          return waterfall([
            /* Fetch table info for columns, primary keys */
            () => {
              return conn.execute('PRAGMA table_info(' + tbl.table_name +
                  ');', {
                cursor: false,
                fetchRows: 0,
                objectRows: true,
                naming: 'lowercase'
              }).then(resp => {
                /* Iterate columns */
                let colnum = 0;
                return waterfall.every(resp.rows, (next, col) => {
                  return waterfall([
                    /* Insert column info */
                    () => {
                      const dt = parseDataType(col.type);
                      return conn.insert('sqb$all_columns', {
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
                      }).execute({autoCommit: true});
                    },
                    /* Insert primary key constraint info */
                    () => {
                      if (!col.pk)
                        return Promise.resolve();
                      return conn.insert('sqb$all_constraints', {
                        table_name: tbl.table_name,
                        constraint_name: ('PK_' +
                            tbl.table_name.toUpperCase() +
                            '_' + col.name.toUpperCase()),
                        constraint_type: 'P',
                        column_name: col.name.toUpperCase()
                      }).execute();
                    }
                  ]);

                });
              });
            },

            /* Fetch foreign keys */
            () => {
              return conn.execute('PRAGMA foreign_key_list(' + tbl.table_name +
                  ');', {
                rowset: false,
                fetchRows: 0,
                objectRows: true,
                naming: 'lowercase'
              }).then(resp => {
                /* Iterate columns */
                return waterfall.every(resp.rows || [], (next, row) => {
                  return conn.insert('sqb$all_constraints', {
                    table_name: tbl.table_name,
                    constraint_name: ('FK_' + tbl.table_name.toUpperCase() +
                        '_' +
                        row.from.toUpperCase()),
                    constraint_type: 'F',
                    column_name: row.from.toUpperCase(),
                    foreign_table_name: row.table.toUpperCase(),
                    foreign_column_name: row.to.toUpperCase()
                  }).execute();
                });
              });
            }
          ]);

        });

      }
    ]);
  };

}

function parseDataType(s) {
  const m = s.match(/(\w+) *(?:\((\d+)\))?/);
  const dataType = m[1];
  const len = m[2] ? parseInt(m[2], 10) : null;
  const o = {
    data_type: dataType
  };
  /* istanbul ignore next */
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

/**
 * Expose `SqMetaData`.
 */
module.exports = SqMetaData;
