/* eslint-disable */
const assert = require('assert');
const sqb = require('sqb');
const createTestTables = require('./support/createTestTables');
const tableAirports = require('./support/table_airports');
const waterfall = require('putil-waterfall');

sqb.use(require('../'));

describe('sqb-connect-sqlite', function() {

  let pool;
  let client1;
  let table;
  let metaData;

  after(function() {
    if (pool)
      pool.close(true);
  });

  describe('Driver', function() {

    it('should initialize pool with sqlite driver', function() {
      pool = sqb.pool({
        dialect: 'sqlite',
        database: ':memory:',
        pool: {
          validate: true,
          max: 1
        },
        defaults: {
          objectRows: true,
          autoCommit: false
        }
      });
      assert(pool.dialect, 'sqlite');
    });

    it('should test pool', function() {
      return pool.test();
    });

    it('should create a connection', function() {
      return pool.acquire(connection => {
        client1 = connection._client; // Will be used later
      });
    });

    it('create test tables', function() {
      this.slow(200);
      return pool.acquire(connection => {
        return createTestTables(connection._client.intlcon);
      });
    });

    it('should fetch "airports" table (objectRows=false)', function() {
      let k = 0;
      return pool.select()
          .from('airports')
          .limit(100)
          .execute({objectRows: false}).then(result => {
            const rows = result.rows;
            assert(rows);
            assert.equal(rows.length, 100);
            rows.forEach((row) => {
              assert.equal(row[0], tableAirports.rows[k++].ID);
            });
            assert(k, 100);
          });
    });

    it('should fetch "airports" table (objectRows=true)', function() {
      let k = 0;
      return pool.select()
          .from('airports')
          .limit(100)
          .execute().then(result => {
            const rows = result.rows;
            assert(rows);
            assert.equal(rows.length, 100);
            rows.forEach(function(row) {
              assert.equal(row.ID, tableAirports.rows[k++].ID);
            });
            assert(k, 100);
          });
    });

    it('should fetch test table (cursor)', function() {
      return pool.select()
          .from('airports')
          .execute({objectRows: false, cursor: true, fetchRows: 100})
          .then(result => {
            const cursor = result.cursor;
            assert(cursor);
            return cursor.next().then((row) => {
              assert.equal(cursor.row, row);
              assert.equal(cursor.row[0], tableAirports.rows[0].ID);
              return cursor.close();
            });
          });
    });

    it('should fetch test table (cursor, objectRows)', function() {
      let k = 0;
      return pool.select()
          .from('airports')
          .execute({
            cursor: true,
            fetchRows: 100
          }).then(result => {
            const cursor = result.cursor;
            assert(cursor);
            return cursor.next().then((row) => {
              assert.equal(cursor.row, row);
              assert.equal(cursor.row.ID, tableAirports.rows[k++].ID);
              return cursor.close();
            });
          });
    });

    it('should invalid sql return error', function(done) {
      pool.execute('invalid sql').then(() => {
        done(new Error('Failed'));
      }).catch(() => done());
    });

    it('should call startTransaction more than one', function() {
      return pool.acquire(connection => {
        return waterfall([
          () => connection.startTransaction(),
          () => connection.startTransaction()
        ]);
      });
    });

    it('should call commit more than one', function() {
      return pool.acquire(connection => {
        return waterfall([
          () => connection.startTransaction(),
          () => connection.commit(),
          () => connection.commit()
        ]);
      });
    });

    it('should call rollback more than one', function() {
      return pool.acquire(connection => {
        return waterfall([
          () => connection.startTransaction(),
          () => connection.rollback(),
          () => connection.rollback()
        ]);
      });
    });

    it('should start transaction when autoCommit is off', function() {
      return pool.acquire(conn => {
        return waterfall([
          () => conn.update('airports', {Catalog: 1234})
              .where({ID: 'LFOI'})
              .execute(),
          () => conn.rollback(),
          () => conn.select()
              .from('airports')
              .where({ID: 'LFOI'})
              .execute({objectRows: true}).then((result) => {
                assert.notEqual(result.rows[0].Catalog, 1234);
              })
        ]);
      });
    });

    it('should not start transaction when autoCommit is on', function() {
      return pool.acquire({autoCommit: true}, conn => {
        return waterfall([
          () => conn.update('airports', {Catalog: 1234})
              .where({ID: 'LFOI'})
              .execute(),
          () => conn.rollback(),
          () => conn.select()
              .from('airports')
              .where({ID: 'LFOI'})
              .execute({objectRows: true}).then((result) => {
                assert.equal(result.rows[0].Catalog, 1234);
              })
        ]);
      });
    });

  });

  describe('Meta-Data', function() {

    it('should initialize DBMeta', function() {
      metaData = new sqb.DBMeta(pool);
      metaData.invalidate();
    });

    it('should select().from(schemas) return empty rows ', function() {
      return metaData.select()
          .from('schemas')
          .execute().then(result => {
            assert(!result.rows);
          });
    });

    it('should select tables', function() {
      return metaData.select()
          .from('tables')
          .where({table_name: 'AIRPORTS'})
          .execute().then(result => {
            assert.equal(result.rows.length, 1);
            assert.equal(result.rows[0].table_name, 'AIRPORTS');
          });
    });

    it('should select columns', function() {
      return metaData.select()
          .from('columns')
          .where({table_name: 'AIRPORTS'})
          .execute().then(result => {
            assert.equal(result.rows.length, 13);
            assert.equal(result.rows[0].column_name, 'ID');
          });
    });

    it('should select primary keys', function() {
      assert.equal(pool.acquired, 0);
      return metaData.select()
          .from('primary_keys')
          .execute().then(result => {
            assert.equal(result.rows.length, 2);
            assert.equal(result.rows[0].column_names, 'ID');
          });
    });

    it('should select foreign keys', function() {
      assert.equal(pool.acquired, 0);
      return metaData.select()
          .from('foreign_keys')
          .execute().then(result => {
            assert.equal(result.rows.length, 1);
            assert.equal(result.rows[0].column_name, 'REGION');
            assert.equal(result.rows[0].foreign_table_name, 'REGIONS');
            assert.equal(result.rows[0].foreign_column_name, 'ID');
          });
    });

    it('should get schema objects with metaData.getSchemas()', function() {
      assert.equal(pool.acquired, 0);
      return metaData.getSchemas()
          .then(schemas => {
            assert.equal(schemas.length, 0);
          });
    });

    it('should get table objects with metaData.getTables()', function() {
      assert.equal(pool.acquired, 0);
      return metaData.getTables()
          .then(tables => {
            assert.equal(tables.length, 2);
            table = tables[0];
            assert.equal(table.meta.table_name, 'AIRPORTS');
          });
    });

    it('should get table columns', function() {
      assert.equal(pool.acquired, 0);
      return table.getColumns().then(result => {
        assert(result);
        assert(result.ID);
        assert.equal(result.ID.data_type, 'TEXT');
      });
    });

    it('should get table primary key', function() {
      return table.getPrimaryKey().then(result => {
        assert(result);
        assert.equal(result.column_names, 'ID');
      });
    });

    it('should get table foreign keys', function() {
      return table.getForeignKeys().then(result => {
        assert(result);
        assert(result.length);
        assert.equal(result[0].column_name, 'REGION');
      });
    });

  });

  describe('Finalize', function() {

    it('should have no active connection after all tests', function() {
      assert.equal(pool.acquired, 0);
    });

    it('should shutdown pool', function() {
      return pool.close().then(() => {
        if (!pool.isClosed)
          throw new Error('Failed');
      });
    });

    it('should closed connection ignore close()', function() {
      return client1.close();
    });

    it('should not call execute on closed connection', function(done) {
      client1.execute('', {})
          .then(() => done('Failed'))
          .catch(() => done());
    });

  });
});
