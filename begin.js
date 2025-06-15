#!/usr/bin/env node
import util from './util/index.js';


//获取端口
await util.getPort();

//准备后端docker容器
await util.dockerBack();

//创建rbac数据库表
util.createDbAndTable();

//拉后端代码、建立GitHub仓库，配置CICD
util.backCode();

//配置nginx-前端路由
util.dockerFront();

//拉前端代码、建立GitHub仓库，配置CICD
util.frontCode();