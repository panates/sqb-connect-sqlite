/* eslint-disable */
const assert = require('assert');
const sqb = require('sqb');
const createTable = require('./support/createTable');
const airportsTable = require('./support/table_airports');
const waterfall = require('putil-waterfall');

sqb.use(require('../'));

describe('Driver', function() {

  var pool;
  var client1;

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
        createTable(connection._client.client, airportsTable, function(err) {
          connection.release();
          done(err);
        });
      });
    });

    it('should test pool', function(done) {
      pool.test(done);
    });

    it('should fetch test table (rowset)', function(done) {
      var k = 0;
      pool.select()
          .from('airports')
          .limit(100)
          .execute(function(err, result) {
            if (err)
              return done(err);
            try {
              const rowset = result.rowset;
              assert(rowset);
              assert.equal(rowset.length, 100);
              while (rowset.next()) {
                assert.equal(rowset.row[0], airportsTable.rows[k++].ID);
              }
              assert(k, 100);
              done();
            } catch (e) {
              done(e);
            }
          });
    });

    it('should fetch test table (rowset, objectRows)', function(done) {
      var k = 0;
      pool.select()
          .from('airports')
          .limit(100)
          .execute({objectRows: true}, function(err, result) {
            if (err)
              return done(err);
            try {
              const rowset = result.rowset;
              assert(rowset);
              assert.equal(rowset.length, 100);
              while (rowset.next()) {
                assert.equal(rowset.row.ID, airportsTable.rows[k++].ID);
              }
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
                  assert.equal(cursor.row[0], airportsTable.rows[k++].ID);
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
                  assert.equal(cursor.row.ID, airportsTable.rows[k++].ID);
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
              .execute(function(err, result) {
                if (err)
                  return next(err);
                try {
                  const rowset = result.rowset;
                  assert(rowset.next());
                  assert.equal(rowset.get('catalog'), 1234);
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
              .execute(function(err, result) {
                if (err)
                  return next(err);
                try {
                  const rowset = result.rowset;
                  assert(rowset.next());
                  assert.equal(rowset.get('catalog'), null);
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