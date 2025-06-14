#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function createDbAndTable(dbName, tableName) {
  const connection = await mysql.createConnection({
    host: '59.110.35.198',
    user: 'root',
    password: 'swqslwlROOT1',
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
  await connection.query(`USE \`${dbName}\`;`);

  const tableSchema = `
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
  `;

  const createTableSQL = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${tableSchema});`;
  await connection.query(createTableSQL);

  console.log(`✅ 数据库 ${dbName} 的表 ${tableName} 创建成功！`);
  await connection.end();
}

const args = process.argv.slice(2);
const dbName = args[0];
const tableName = args[1];

createDbAndTable(dbName, tableName).catch(console.error);
