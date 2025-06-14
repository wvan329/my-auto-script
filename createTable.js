#!/usr/bin/env node
import fs from 'fs';
import yaml from 'js-yaml'
import util from './util.js';
const config = yaml.load(fs.readFileSync('D:/auto/config.yaml', 'utf8'));


//创建rbac数据库表
await util.createDbAndTable(config);
//拉取前后端代码

