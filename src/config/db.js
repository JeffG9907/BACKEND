const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'LOmqhmefSYeZWuJgrrHVRSwYLkrkEZDy',
  database: 'railway',
  port: 12510
});

module.exports = pool;