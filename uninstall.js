#!/usr/bin/env node
import mysql from 'mysql2/promise';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { NodeSSH } from 'node-ssh';
import { app, dirname, replace, nginxConfig } from './install/config.js';
import {
  name, name_back, backAppDir, githubOwner, name_front, frontAppDir
} from './install/name.js';

export const uninstall = async () => {
  // 删除数据库
  const connection = await mysql.createConnection({
    host: app.host,
    user: app.user,
    password: app.password,
    multipleStatements: true,
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${name}\`;`);

  //删除docker所有内容
  const ssh = new NodeSSH();
  await ssh.connect({ host: app.host, username: app.user, password: app.password });

  //1.删除后端容器、镜像
  const script1 = `docker stop ${name}`;
  const script2 = `docker rm ${name}`;
  const script3 = `docker volume rm ${name}`;
  //2.删除前端nginx配置、文件
  {
    const remoteFile = '/var/lib/docker/volumes/nginx-conf/_data/default.conf';
    const result = await ssh.execCommand(`cat ${remoteFile}`);
    let content = result.stdout;
    content = content.replace(nginxConfig, '# -替换1',);
    const localFile = path.join(dirname, 'default.conf');
    fs.writeFileSync(localFile, content);
    await ssh.putFile(localFile, remoteFile);
    await ssh.execCommand('docker exec nginx nginx -s reload');
    fs.unlinkSync(localFile);
    const folderPath = `/var/lib/docker/volumes/nginx-html/_data/${name}`;
    await ssh.execCommand(`rm -rf ${folderPath}`);
  }
  // 执行命令
  await ssh.execCommand(script1);
  await ssh.execCommand(script2);
  await ssh.execCommand(script3);
  ssh.dispose();

  //删除本地文件
  let folderPath = path.join('D:', 'auto', name_back);
  await fs.rm(folderPath, { recursive: true, force: true });
  folderPath = path.join('D:', 'auto', name_front);
  await fs.rm(folderPath, { recursive: true, force: true });

  //删除github
  await axios.delete(`https://api.github.com/repos/${githubOwner}/${name_back}`, {
    headers: { Authorization: `token ${app.githubToken}` }
  });
  await axios.delete(`https://api.github.com/repos/${githubOwner}/${name_front}`, {
    headers: { Authorization: `token ${app.githubToken}` }
  });

  console.log("清理完成");

}