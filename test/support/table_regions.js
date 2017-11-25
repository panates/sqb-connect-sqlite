module.exports = {
  name: 'REGIONS',
  createSql: ('CREATE TABLE IF NOT EXISTS REGIONS (' +
      'ID TEXT PRIMARY KEY,' +
      'Name TEXT' +
      ')'),
  insertSql: 'INSERT INTO REGIONS (ID,Name) VALUES (?,?)',
  rows: [
    {
      ID: 'FR',
      Name: 'FR Region'
    }
  ]
};