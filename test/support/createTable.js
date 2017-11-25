function createTable(db, table, callback) {
  db.exec(table.createSql, function(err) {
    if (err)
      return callback(err);
    const stmt = db.prepare(table.insertSql);
    var i = 0;
    const fieldKeys = Object.getOwnPropertyNames(table.rows[0]);
    const executeNext = function() {
      var params = [];
      fieldKeys.forEach(function(key) {
        params.push(table.rows[i][key] || null);
      });
      stmt.run(params, function(err) {
        if (err)
          return callback(err);
        if (++i < table.rows.length)
          process.nextTick(executeNext);
        else
          stmt.finalize(callback);
      });
    };
    executeNext();
  });

}

module.exports = createTable;