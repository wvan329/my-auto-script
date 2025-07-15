import mysql from 'mysql2/promise';
import fs from 'fs-extra';
import { app } from './config.js';
import { name_port } from './name.js';

const createDbAndTable = async () => {
  const connection = await mysql.createConnection({
    host: app.host,
    user: app.user,
    password: app.password,
    multipleStatements: true,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name_port}\`;`);
  await connection.query(`USE \`${name_port}\`;`);
  const script = fs.readFileSync('D:/auto/config/sql.txt', 'utf8');
  await connection.query(script);
  await connection.end();
};

export { createDbAndTable };
