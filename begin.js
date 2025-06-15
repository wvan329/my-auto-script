#!/usr/bin/env node
import util from './util.js';


// //获取端口
await util.getPort();

// //后端docker
// await util.dockerBack();

// // //创建rbac数据库表
// await util.createDbAndTable();

// // //后端仓库、代码
// await util.backCode();

await util.dockerFront();