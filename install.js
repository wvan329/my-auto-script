#!/usr/bin/env node
import util from './util/index.js';

//初始化后端docker容器
await util.dockerBack();

//创建rbac数据库表
util.createDbAndTable();

//拉后端代码、建立GitHub仓库、修改项目配置、推送代码、CICD
util.backCode();

//拉前端代码、建立GitHub仓库、修改项目配置、推送代码、CICD
util.frontCode();

//配置nginx路由
//必须后端容器启动后nginx配置才能刷新成功，因为有反向代理
await util.dockerFront();

console.log("完成");