# SQB-connect-sqlite

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Dependencies][dependencies-image]][dependencies-url]
[![DevDependencies][devdependencies-image]][devdependencies-url]
[![PeerDependencies][peerdependencies-image]][peerdependencies-url]

SQLite connection adapter for [SQB](https://github.com/panates/sqb).

## Configuring

### Authentication options

#### Internal Authentication

Applications using internal authentication stores credentials manually and passes `user` and `password` properties in configuration object.

```js
sqb.use('sqb-connect-sqlite');
const pool = sqb.pool({
  dialect: 'sqlite',
  user: 'anyuser',
  password: 'anypassword',
  ....
})
```

#### External Authentication

External Authentication allows applications to use an external password store (such as sqlite Wallet), the Secure Socket Layer (SSL), or the operating system to validate user access. One of the benefits is that database credentials do not need to be hard coded in the application.

To use external authentication, set the `externalAuth` property to true. (Default false)

```js
sqb.use('sqb-connect-sqlite');
const pool = sqb.pool({
  dialect: 'sqlite',
  externalAuth: true
  ....
})
```

### Connection configuration options

#### Configure using connection parameters

```js
sqb.use('sqb-connect-sqlite');
const pool = sqb.pool({
  dialect: 'sqlite',
  ** Authentication options here 
  host: 'localhost',
  port: 1521,
  database: 'SALES'
})
```

- `host`: Hostname to connect to
- `port`: Port to connect to (default: 1521)
- `database`: Database (service name) to connect to (Optional)
- `serverType`: Type of server (Optional)
- `instanceName`: Instance name (Optional)


#### Configure using easy connection syntax

An Easy Connect string is often the simplest to use. With sqlite Database 12c the syntax is:

`[//]host[:port][/database][:serverType][/instanceName]`

```js
sqb.use('sqb-connect-sqlite');
const pool = sqb.pool({
  dialect: 'sqlite',
  ** Authentication options here 
  connectString: 'localhost:1521/SALES'
})
```

#### Configure using Net service name

A Net Service Name, such as sales in the example below, can be used to connect:

```js
sqb.use('sqb-connect-sqlite');
const pool = sqb.pool({
  dialect: 'sqlite',
  ** Authentication options here 
  connectString: 'sales'
})
```

This could be defined in a directory server, or in a local tnsnames.ora file, for example:
```
sales =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = mymachine.example.com)(PORT = 1521))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = orcl)
    )
  )
```

#### Configure using full connection strings

```js
sqb.use('sqb-connect-sqlite');
const pool = sqb.pool({
  dialect: 'sqlite',
  ** Authentication options here 
  connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=mymachine.example.com)(PORT=1521))(CONNECT_DATA=(SERVER=DEDICATED)(SERVICE_NAME=orcl)))'
})
```

### Additional parameters

```js
sqb.use('sqb-connect-sqlite');
const pool = sqb.pool({
  dialect: 'sqlite',
  ** Connection options here 
  schema: 'otherschema'
})
```

- `schema`: Sets default schema for session

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
