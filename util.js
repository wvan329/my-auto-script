#!/usr/bin/env node

import mysql from 'mysql2/promise';



//创建rbac数据库表
async function createDbAndTable({ db }) {

  const connection = await mysql.createConnection({
    host: db.host,
    user: db.user,
    password: db.password
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${db.name}\`;`);
  await connection.query(`USE \`${db.name}\`;`);

  const table1 = `create table permissions
(
    id          bigint auto_increment
        primary key,
    permission  varchar(255) null,
    description text         null,
    constraint permission_code
        unique (permission)
);`
  const table2 = `create table role_permission
(
    role_id       bigint not null,
    permission_id bigint not null,
    primary key (role_id, permission_id)
);`
  const table3 = `create table roles
(
    id          bigint auto_increment
        primary key,
    role        varchar(255) null,
    description text         null,
    constraint role_code
        unique (role)
);
`
  const table4 = `create table user_role
(
    user_id bigint not null,
    role_id bigint not null,
    primary key (user_id, role_id)
);`
  const table5 = `create table users
(
    id  bigint auto_increment
        primary key,
    username varchar(255) null comment '用户名',
    password varchar(255) null comment '密码',
    birthday datetime     null,
    constraint username
        unique (username)
);`

  await connection.query(table1);
  await connection.query(table2);
  await connection.query(table3);
  await connection.query(table4);
  await connection.query(table5);

  console.log(`✅创建成功！`);
  await connection.end();
}

export default {createDbAndTable}