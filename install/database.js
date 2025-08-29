import mysql from 'mysql2/promise';
import fs from 'fs-extra';
import { app } from './config.js';
import { name } from './name.js';
import { fileURLToPath } from 'url';
import path from 'path';

//当前文件url
const __filename = fileURLToPath(import.meta.url);
//当前文件所在目录
const __dirname = path.dirname(__filename);

const createDbAndTable = async () => {
  const connection = await mysql.createConnection({
    host: app.host,
    user: app.user,
    password: app.password,
    multipleStatements: true,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\`;`);
  await connection.query(`USE \`${name}\`;`);
  const script = fs.readFileSync(path.join(__dirname, 'sql.txt'), 'utf8');
  await connection.query(script);
  await connection.end();
};

export { createDbAndTable };
