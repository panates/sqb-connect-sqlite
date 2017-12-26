/* eslint-disable */
const assert = require('assert');
const sqb = require('sqb');
const createTable = require('./support/createTable');
const tableRegions = require('./support/table_regions');
const tableAirports = require('./support/table_airports');
const waterfall = require('putil-waterfall');

sqb.use(require('../'));

describe('Driver', function() {

  var pool;
  var client1;
  var table;

  after(function() {
    pool.close(true);
  });

  describe('Driver', function() {

    it('should initialize pool with sqlite driver', function() {
      pool = new sqb.Pool({
        dialect: 'sqlite',
        database: ':memory:',
        pool: {
          validate: true,
          max: 1
        }
      });
      assert(pool.dialect, 'sqlite');
    });

    it('should create a connection', function(done) {
      pool.connect(function(err, connection) {
        if (err)
          return done(err);
        client1 = connection._client; // Will be used later
        connection.release();
        done();
      });
    });

    it('create test tables', function(done) {
      this.slow(200);
      pool.connect(function(err, connection) {
        if (err)
          return done(err);
        waterfall.every(
            [tableRegions, tableAirports],
            function(next, table) {
              createTable(connection._client.client, table, function(err) {
                if (err)
                  return next(err);
                next();
              });
            }, function(err) {
              connection.release();
              done(err);
            });
      });
    });

    it('should test pool', function(done) {
      pool.test(done);
    });

    it('should fetch "airports" table (rows)', function(done) {
      var k = 0;
      pool.select()
          .from('airports')
          .limit(100)
          .execute(function(err, result) {
            if (err)
              return done(err);
            try {
              const rows = result.rows;
              assert(rows);
              assert.equal(rows.length, 100);
              rows.forEach(function(row) {
                assert.equal(row[0], tableAirports.rows[k++].ID);
              });
              assert(k, 100);
              done();
            } catch (e) {
              done(e);
            }
          });
    });

    it('should fetch "airports" table (rows, objectRows)', function(done) {
      var k = 0;
      pool.select()
          .from('airports')
          .limit(100)
          .execute({objectRows: true}, function(err, result) {
            if (err)
              return done(err);
            try {
              const rows = result.rows;
              assert(rows);
              assert.equal(rows.length, 100);
              rows.forEach(function(row) {
                assert.equal(row.ID, tableAirports.rows[k++].ID);
              });
              assert(k, 100);
              done();
            } catch (e) {
              done(e);
            }
          });
    });

    it('should fetch test table (cursor)', function(done) {
      var k = 0;
      pool.select()
          .from('airports')
          .execute({cursor: true, fetchRows: 100}, function(err, result) {
            if (err)
              return done(err);
            try {
              const cursor = result.cursor;
              assert(cursor);
              cursor.next(function(err, row, more) {
                if (err)
                  return done(err);
                if (!row)
                  return done();
                try {
                  assert.equal(cursor.row, row);
                  assert.equal(cursor.row[0], tableAirports.rows[k++].ID);
                  more();
                } catch (e) {
                  done(e);
                }
              });
            } catch (e) {
              done(e);
            }
          });
    });

    it('should fetch test table (cursor, objectRows)', function(done) {
      var k = 0;
      pool.select()
          .from('airports')
          .execute({
            cursor: true,
            fetchRows: 100,
            objectRows: true
          }, function(err, result) {
            if (err)
              return done(err);
            try {
              const cursor = result.cursor;
              assert(cursor);
              cursor.next(function(err, row, more) {
                if (err)
                  return done(err);
                if (!row)
                  return done();
                try {
                  assert.equal(cursor.row, row);
                  assert.equal(cursor.row.ID, tableAirports.rows[k++].ID);
                  more();
                } catch (e) {
                  done(e);
                }
              });
            } catch (e) {
              done(e);
            }
          });
    });

    it('should commit transaction by default', function(done) {
      waterfall([
        function(next) {
          pool.update('airports')
              .set({Catalog: 1234})
              .where(['ID', 'LFOI'])
              .execute(next);
        },

        function(next) {
          pool.select()
              .from('airports')
              .where(['ID', 'LFOI'])
              .execute({objectRows: true}, function(err, result) {
                if (err)
                  return next(err);
                try {
                  assert.equal(result.rows[0].Catalog, 1234);
                } catch (e) {
                  return next(e);
                }
                next();
              });
        }
      ], done);
    });

    it('should rollback transaction on connection close', function(done) {
      var connection;
      waterfall([

        function(next) {
          pool.connect(next);
        },

        function(next, conn) {
          connection = conn;
          connection.startTransaction(next);
        },

        function(next) {
          connection.update('airports')
              .set({Catalog: 1234})
              .where(['ID', 'LFBA'])
              .execute(next);
        },

        function(next) {
          connection.rollback(next);
          connection.release();
        },

        function(next) {
          pool.select()
              .from('airports')
              .where(['ID', 'LFBA'])
              .execute({objectRows: true}, function(err, result) {
                if (err)
                  return next(err);
                try {
                  assert.equal(result.rows[0].Catalog, null);
                } catch (e) {
                  return next(e);
                }
                next();
              });
        }
      ], done);
    });

    it('should invalid sql return error', function(done) {
      pool.execute('invalid sql', function(err) {
        if (err)
          return done();
        done(new Error('Failed'));
      });
    });

    it('should call startTransaction more than one', function(done) {
      pool.connect(function(err, connectiton) {
        connectiton.startTransaction(function(err) {
          if (err)
            return done(err);
          connectiton.startTransaction(function(err) {
            if (err)
              return done(err);
            connectiton.release();
            done();
          });
        });
      });
    });

    it('should call commit more than one', function(done) {
      pool.connect(function(err, connectiton) {
        connectiton.startTransaction(function(err) {
          if (err)
            return done(err);
          connectiton.commit(function(err) {
            if (err)
              return done(err);
            connectiton.commit(function(err) {
              if (err)
                return done(err);
              connectiton.release();
              done();
            });
          });
        });
      });
    });

    it('should call rollback more than one', function(done) {
      pool.connect(function(err, connectiton) {
        connectiton.startTransaction(function(err) {
          if (err)
            return done(err);
          connectiton.rollback(function(err) {
            if (err)
              return done(err);
            connectiton.rollback(function(err) {
              if (err)
                return done(err);
              connectiton.release();
              done();
            });
          });
        });
      });
    });

  });

  describe('Meta-Data', function() {

    it('should select().from(schemas) return empty rows ', function() {
      return pool.metaData.select()
          .from('schemas')
          .then({objectRows: true}, function(result) {
            assert.equal(result.rows.length, 0);
          });
    });

    it('should select tables', function() {
      return pool.metaData.select()
          .from('tables')
          .then({objectRows: true}, function(result) {
            assert.equal(result.rows.length, 2);
            assert.equal(result.rows[0].table_name, 'AIRPORTS');
          });
    });

    it('should select columns', function() {
      return pool.metaData.select()
          .from('columns')
          .then({objectRows: true}, function(result) {
            assert.equal(result.rows.length, 15);
            assert.equal(result.rows[0].column_name, 'ID');
          });
    });

    it('should select primary keys', function() {
      return pool.metaData.select()
          .from('primary_keys')
          .then({objectRows: true}, function(result) {
            assert.equal(result.rows.length, 2);
            assert.equal(result.rows[0].column_names, 'ID');
          });
    });

    it('should select foreign keys', function() {
      return pool.metaData.select()
          .from('foreign_keys')
          .then({objectRows: true}, function(result) {
            assert.equal(result.rows.length, 1);
            assert.equal(result.rows[0].column_name, 'REGION');
            assert.equal(result.rows[0].foreign_table_name, 'REGIONS');
            assert.equal(result.rows[0].foreign_column_name, 'ID');
          });
    });

    it('should get schema objects with metaData.getSchemas()', function() {
      return pool.metaData.getSchemas()
          .then(function(schemas) {
            assert.equal(schemas.length, 0);
          });
    });

    it('should get table objects with metaData.getTables()', function() {
      return pool.metaData.getTables()
          .then(function(tables) {
            assert.equal(tables.length, 2);
            table = tables[0];
            assert.equal(table.meta.table_name, 'AIRPORTS');
          });
    });

    it('should get table columns', function(done) {
      table.getColumns(function(err, result) {
        if (err)
          return done(err);
        try {
          assert(result);
          assert(result.ID);
          assert.equal(result.ID.data_type, 'TEXT');
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should get table primary key', function(done) {
      table.getPrimaryKey(function(err, result) {
        if (err)
          return done(err);
        try {
          assert(result);
          assert.equal(result.column_names, 'ID');
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should get table foreign keys', function(done) {
      table.getForeignKeys(function(err, result) {
        if (err)
          return done(err);
        try {
          assert(result);
          assert(result.length);
          assert.equal(result[0].column_name, 'REGION');
          done();
        } catch (e) {
          done(e);
        }
      });
    });

  });

  describe('Finalize', function() {

    it('shutdown pool', function(done) {
      pool.close(done);
    });

    it('should closed connection ignore close()', function(done) {
      client1.close(done);
    });

    it('should not call execute on closed connection', function(done) {
      client1.execute('', [], {}, function(err) {
        if (err)
          return done();
        done(new Error('Failed'));
      });
    });
  });
});
