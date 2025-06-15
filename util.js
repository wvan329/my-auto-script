import yaml from 'js-yaml'
import mysql from 'mysql2/promise';
import { NodeSSH } from 'node-ssh';
import axios from 'axios';
import AdmZip from 'adm-zip';
import fs from 'fs-extra';
import path from 'path';
import { parseStringPromise, Builder } from 'xml2js';
import simpleGit from 'simple-git';

const { app } = yaml.load(fs.readFileSync('D:/auto/config.yaml', 'utf8'));
const githubToken = app.githubToken;
let port = '';
let appName = '';



//获取可用端口
const getPort = async () => {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: app.host,
    username: app.user,
    password: app.password,
  });

  const script = `
      for ((port=8080; port<=65535; port++)); do
        ! lsof -i:$port >/dev/null && echo "$port" && break
      done
    `;

  // port = await ssh.execCommand(script).stdout.trim();
  port = (await ssh.execCommand(script)).stdout.trim();
  console.log(`端口：${port}`);
  appName = `${app.name}-${port}`
  console.log(appName);
  ssh.dispose();
};

//创建rbac数据库表
const createDbAndTable = async () => {
  const connection = await mysql.createConnection({
    host: app.host,
    user: app.user,
    password: app.password
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${appName}\`;`);
  await connection.query(`USE \`${appName}\`;`);

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

//拉取后端代码
const backCode = async () => {

  const dirname = 'D:/auto';
  const appDir = path.join(dirname, 'test');
  //拉取代码
  async function pullCode() {
    const zipUrl = `https://api.github.com/repos/wvan329/my-project/zipball/master`;
    const zipPath = path.join(dirname, 'repo.zip');
    const tempDir = path.join(dirname, 'temp_download');

    // 下载 zip
    const res = await axios.get(zipUrl, {
      headers: { Authorization: `token ${githubToken}` },
      responseType: 'arraybuffer'
    });
    await fs.writeFile(zipPath, res.data);

    // 解压
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);

    // 移动/重命名
    const [inner] = await fs.readdir(tempDir);
    const innerPath = path.join(tempDir, inner);
    await fs.move(innerPath, appDir, { overwrite: true });

    // 删除临时文件
    await fs.remove(zipPath);
    await fs.remove(tempDir);
  }
  await pullCode();

  // 修改 pom.xml
  async function updatePom() {
    const pomPath = path.join(appDir, 'pom.xml');
    const xml = await fs.readFile(pomPath, 'utf-8');
    const obj = await parseStringPromise(xml);
    obj.project.artifactId = ['test'];
    const builder = new Builder();
    await fs.writeFile(pomPath, builder.buildObject(obj));
  }
  await updatePom();

  //修改aciton文件
  async function updateAction() {
    const ymlPath = path.join(appDir, '.github/workflows/maven.yml');
    let content = await fs.readFile(ymlPath, 'utf-8');
    const lines = content.split('\n');
    // 在第二行插入 env 和 APP_NAME
    const insertLines = [
      'env:',
      '  APP_NAME: test\n'
    ];
    // 把 insertLines 插入到 lines[2] 的前面
    lines.splice(2, 0, ...insertLines);
    // 重新合并文本
    content = lines.join('\n');
    await fs.writeFile(ymlPath, content, 'utf-8');
  }
  await updateAction();

  //修改.gitignore文件
  async function updateGitignore() {
    const gitignorePath = path.join(appDir, '.gitignore');
    const lineToAdd = '/src/main/resources/application-dev.yml\n';
    // 读取当前内容
    let content = '';
    if (await fs.pathExists(gitignorePath)) {
      content = await fs.readFile(gitignorePath, 'utf-8');
    }
    // 如果文件末尾没有换行，先加换行符
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    // 追加这一行
    content += lineToAdd;
    // 写回文件
    await fs.writeFile(gitignorePath, content, 'utf-8');
  }
  await updateGitignore();

  //上传仓库
  async function pushCode() {
    // 创建 GitHub 仓库
    async function createGithubRepo() {
      await axios.post(
        'https://api.github.com/user/repos',
        {
          name: 'test009',
          private: false,
          auto_init: false
        },
        {
          headers: {
            Authorization: `token ${githubToken}`,
            'User-Agent': 'Node.js Script'
          }
        }
      );
    }
    await createGithubRepo();
    //推送
    async function push() {
      const git = simpleGit(appDir); // 你的本地项目目录
      await git.init(); // 如果已初始化可以忽略
      await git.addRemote('origin', 'https://github.com/wvan329/test009.git');
      await git.add('./*');   // 添加所有文件（会自动忽略.gitignore里配置的文件）
      await git.commit('初始化');
      // 推送到main分支
      await git.push('origin', 'main', { '--force': null }); // --force可选，看情况用
    }
    await push();
  }
  await pushCode();
}

export default { getPort, createDbAndTable, backCode }