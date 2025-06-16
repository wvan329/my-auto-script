#!/usr/bin/env node
import util from './util/index.js';


//获取端口
await util.getPort();

//初始化后端docker容器
await util.dockerBack();

//创建rbac数据库表
util.createDbAndTable();

//拉后端代码、建立GitHub仓库、修改项目配置、推送代码、CICD
util.backCode();

//配置nginx路由
util.dockerFront();

//拉前端代码、建立GitHub仓库、修改项目配置、推送代码、CICD
util.frontCode();