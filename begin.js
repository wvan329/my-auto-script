#!/usr/bin/env node
import util from './util/index.js';


//获取端口
await util.getPort();

//后端docker
await util.dockerBack();

//创建rbac数据库表
util.createDbAndTable();

//后端仓库、代码
util.backCode();

//前端docker
util.dockerFront();

//前端仓库、代码
util.frontCode();