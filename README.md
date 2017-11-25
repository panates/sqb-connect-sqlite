# SQB-connect-sqlite

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Dependencies][dependencies-image]][dependencies-url]
[![DevDependencies][devdependencies-image]][devdependencies-url]
[![PeerDependencies][peerdependencies-image]][peerdependencies-url]

SQLite connection adapter for [SQB](https://github.com/panates/sqb).

## Configuring

```js
const sqlitedriver= require('sqb-connect-sqlite');
sqb.use(sqlitedriver);

const pool = sqb.pool({
  dialect: 'sqlite',
  database: 'dbfile.db',
  mode: sqlitedriver.OPEN_READONLY,
  busyTimeout: 30000
})
```

- `database`: Valid values are filenames, ":memory:" for an anonymous in-memory database and an empty string for an anonymous disk-based database. Anonymous databases are not persisted and when closing the database handle, their contents are lost.
- `mode`: (optional): One or more of OPEN_READONLY, OPEN_READWRITE and OPEN_CREATE. The default value is OPEN_READWRITE | OPEN_CREATE.
- `busyTimeout`: Provide an integer as a value. Sets the [busy timeout](https://www.sqlite.org/c3ref/busy_timeout.html)


## Node Compatibility

  - node `>= 4.x`;
  
### License
[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/sqb-connect-sqlite.svg
[npm-url]: https://npmjs.org/package/sqb-connect-sqlite
[downloads-image]: https://img.shields.io/npm/dm/sqb-connect-sqlite.svg
[downloads-url]: https://npmjs.org/package/sqb-connect-sqlite
[dependencies-image]: https://david-dm.org/panates/sqb-connect-sqlite.svg
[dependencies-url]:https://david-dm.org/panates/sqb-connect-sqlite#info=dependencies
[devdependencies-image]: https://david-dm.org/panates/sqb-connect-sqlite/dev-status.svg
[devdependencies-url]:https://david-dm.org/panates/sqb-connect-sqlite?type=dev
[peerdependencies-image]: https://david-dm.org/panates/sqb-connect-sqlite/peer-status.svg
[peerdependencies-url]:https://david-dm.org/panates/sqb-connect-sqlite?type=peer
