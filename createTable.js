#!/usr/bin/env node
import fs from 'fs';
import yaml from 'js-yaml'
import util from './util.js';
const config = yaml.load(fs.readFileSync('C:/Users/22873/Desktop/config.yaml', 'utf8'));


//创建rbac数据库表
util.createDbAndTable(config);

