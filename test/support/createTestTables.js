const waterfall = require('putil-waterfall');
const tableRegions = require('./table_regions');
const tableAirports = require('./table_airports');

function createTestTables(db) {

  return waterfall.every([tableRegions, tableAirports],
      (next, table) => {
        db.exec(table.createSql, function(err) {
          if (err)
            return next(err);
          const stmt = db.prepare(table.insertSql);
          let i = 0;
          const fieldKeys = Object.getOwnPropertyNames(table.rows[0]);
          const executeNext = function() {
            let params = [];
            fieldKeys.forEach(function(key) {
              params.push(table.rows[i][key] || null);
            });
            stmt.run(params, function(err) {
              if (err)
                return next(err);
              if (++i < table.rows.length)
                process.nextTick(executeNext);
              else
                stmt.finalize(next);
            });
          };
          executeNext();
        });
      });
}

module.exports = createTestTables;