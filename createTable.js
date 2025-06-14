#!/usr/bin/env node

import mysql from 'mysql2/promise';
import fs from 'fs';
import yaml from 'js-yaml'


async function createDbAndTable() {
  const connection = await mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.name}\`;`);
  await connection.query(`USE \`${config.name}\`;`);

  const tableSchema = `
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
  `;

  const createTableSQL = `CREATE TABLE IF NOT EXISTS \`${config.table}\` (${tableSchema});`;
  await connection.query(createTableSQL);

  console.log(`✅ 数据库 ${config.name} 的表 ${config.table} 创建成功！`);
  await connection.end();
}

const fileContents = fs.readFileSync('C:/Users/22873/Desktop/config.yaml', 'utf8');
const config = yaml.load(fileContents);

createDbAndTable().catch(console.error);
