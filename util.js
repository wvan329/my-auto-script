import yaml from 'js-yaml'
import mysql from 'mysql2/promise';
import { NodeSSH } from 'node-ssh';
import axios from 'axios';
import AdmZip from 'adm-zip';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import sealedbox from 'tweetnacl-sealedbox-js';


let port = '';
let name_port = '';
let name_port_back = '';
let name_port_front = '';
const dirname = 'D:/auto';
let backAppDir = '';
let frontAppDir = '';
let githubOwner = 'wvan329';
const { app } = yaml.load(fs.readFileSync(path.join(dirname, 'config/config.yaml'), 'utf8'));

function replace(path, replaceNum, value) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.split(`-替换${replaceNum}`).join(value);
  fs.writeFileSync(path, content, 'utf8');
}

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
  name_port = `${app.name}${port}`
  name_port_back = `${name_port}-back`
  name_port_front = `${name_port}-front`
  backAppDir = path.join(dirname, `${name_port_back}`);
  frontAppDir = path.join(dirname, `${name_port_front}`);
  console.log(name_port);
  ssh.dispose();
};

//后端docker
const dockerBack = async () => {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: app.host,
    username: app.user,
    password: app.password,
  });

  const script = `
  docker run -d \
  --name ${name_port_back} \
	-p ${port}:8080 \
  -v ${name_port_back}:/app \
  openjdk:17-jdk-slim \
  java -jar /app/${name_port_back}.jar --spring.profiles.active=prod
    `;
  await ssh.execCommand(script)
  ssh.dispose();
}

//创建rbac数据库表
const createDbAndTable = async () => {
  const connection = await mysql.createConnection({
    host: app.host,
    user: app.user,
    password: app.password
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name_port}\`;`);
  await connection.query(`USE \`${name_port}\`;`);
  const script = fs.readFileSync(path.join(dirname, 'config/sql.txt'));
  await connection.query(script);
  await connection.end();
}

//拉取后端代码
const backCode = async () => {
  //拉取代码
  async function pullCode() {
    const zipUrl = `https://api.github.com/repos/${githubOwner}/my-project-back/zipball/master`;
    const zipPath = path.join(dirname, 'repo.zip');
    const tempDir = path.join(dirname, 'temp_download');

    // 下载 zip
    const res = await axios.get(zipUrl, {
      headers: { Authorization: `token ${app.githubToken}` },
      responseType: 'arraybuffer'
    });
    await fs.writeFile(zipPath, res.data);

    // 解压
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);

    // 移动/重命名
    const [inner] = await fs.readdir(tempDir);
    const innerPath = path.join(tempDir, inner);
    await fs.move(innerPath, backAppDir, { overwrite: true });

    // 删除临时文件
    await fs.remove(zipPath);
    await fs.remove(tempDir);
  }
  await pullCode();
  // 修改 pom.xml
  replace(path.join(backAppDir, 'pom.xml'), 1, name_port_back)
  //修改aciton文件
  replace(path.join(backAppDir, '.github/workflows/maven.yml'), 1, name_port_back)
  //修改.gitignore文件
  replace(path.join(backAppDir, '.gitignore'), 1, `/src/main/resources/application-dev.yml`)
  // 更新 application.yml 文件
  replace(path.join(backAppDir, 'src/main/resources/application.yml'), 1, name_port)
  // 更新 application-dev.yml 文件
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 1, app.host)
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 2, app.password)

  //上传仓库
  async function pushCode() {
    // 创建 GitHub 仓库
    async function createGithubRepo() {
      await axios.post(
        'https://api.github.com/user/repos',
        {
          name: `${name_port_back}`,
          private: false,
          auto_init: false
        },
        {
          headers: {
            Authorization: `token ${app.githubToken}`,
            'User-Agent': 'Node.js Script'
          }
        }
      );
    }
    await createGithubRepo();

    // 1. 获取仓库的公钥
    const { data: publicKey } = await axios.get(
      `https://api.github.com/repos/${githubOwner}/${name_port_back}/actions/secrets/public-key`,
      {
        headers: {
          Authorization: `token ${app.githubToken}`,
          'User-Agent': 'node.js'
        }
      }
    );
    //设置secret
    async function setGithubSecret(name, value) {
      // 加密 secret
      const encryptedBytes = sealedbox.seal(
        Buffer.from(value),
        Buffer.from(publicKey.key, 'base64')
      );
      const encrypted = Buffer.from(encryptedBytes).toString('base64');

      // 3. 上传加密后的 secret
      await axios.put(
        `https://api.github.com/repos/${githubOwner}/${name_port_back}/actions/secrets/${name}`,
        {
          encrypted_value: encrypted,
          key_id: publicKey.key_id
        },
        {
          headers: {
            Authorization: `token ${app.githubToken}`,
            'User-Agent': 'node.js'
          }
        }
      );
    }
    await setGithubSecret('SERVER_HOST', app.host);
    await setGithubSecret('PASSWORD', app.password);
    await setGithubSecret('SERVER_SSH_KEY', fs.readFileSync(path.join(dirname, 'config/id_rsa'), 'utf8'));

    //推送
    async function push() {
      const git = simpleGit(backAppDir); // 你的本地项目目录
      await git.init(); // 如果已初始化可以忽略
      await git.addRemote('origin', `https://github.com/${githubOwner}/${name_port_back}.git`);
      await git.add('./*');   // 添加所有文件（会自动忽略.gitignore里配置的文件）
      await git.commit('yes:初始化');
      // 推送到main分支
      await git.push('origin', 'main', { '--force': null }); // --force可选，看情况用
    }
    await push();
  }
  await pushCode();
}

//前端docker
const dockerFront = async () => {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: app.host,
    username: app.user,
    password: app.password,
  });
  const remoteFile = '/var/lib/docker/volumes/nginx-conf/_data/default.conf';
  const readResult = await ssh.execCommand(`cat ${remoteFile}`);
  let content = readResult.stdout;
  const config = `
    location /${name_port}-api/ {
        proxy_pass http://172.17.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /${name_port} {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /${app.appName}/index.html;
    }
    # -替换1
`;
  content = content.split(`# -替换1`).join(config);
  const localTmpFile = path.join(dirname, `default.conf`);
  fs.writeFileSync(localTmpFile, content, 'utf8');
  await ssh.putFile(localTmpFile, remoteFile);
  await ssh.execCommand('docker exec nginx nginx -s reload');
  fs.unlinkSync(localTmpFile);
  ssh.dispose();
};

//拉取前端代码
const frontCode = async () => {
  //拉取代码
  async function pullCode() {
    const zipUrl = `https://api.github.com/repos/${githubOwner}/my-project-front/zipball/main`;
    const zipPath = path.join(dirname, 'repo1.zip');
    const tempDir = path.join(dirname, 'temp_download1');
    // 下载 zip
    const res = await axios.get(zipUrl, {
      headers: { Authorization: `token ${app.githubToken}` },
      responseType: 'arraybuffer'
    });
    await fs.writeFile(zipPath, res.data);
    // 解压
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);
    // 移动/重命名
    const [inner] = await fs.readdir(tempDir);
    const innerPath = path.join(tempDir, inner);
    await fs.move(innerPath, frontAppDir, { overwrite: true });
    // 删除临时文件
    await fs.remove(zipPath);
    await fs.remove(tempDir);
  }
  await pullCode();
  // 修改 vite.config.js
  replace(path.join(frontAppDir, 'vite.config.js'), 1, name_port)
  replace(path.join(frontAppDir, 'vite.config.js'), 2, `${name_port}-api`)
  replace(path.join(frontAppDir, 'vite.config.js'), 3, 'localhost')
  //修改路由文件
  replace(path.join(frontAppDir, 'src/router/index.js'), 1, name_port)
  //修改index.html文件
  replace(path.join(frontAppDir, 'index.html'), 1, app.chinese || app.name)
  //修改aciton文件
  replace(path.join(backAppDir, '.github/workflows/maven.yml'), 1, name_port)
  //上传仓库
  async function pushCode() {
    // 创建 GitHub 仓库
    async function createGithubRepo() {
      await axios.post(
        'https://api.github.com/user/repos',
        {
          name: `${name_port_front}`,
          private: false,
          auto_init: false
        },
        {
          headers: {
            Authorization: `token ${app.githubToken}`,
            'User-Agent': 'Node.js Script'
          }
        }
      );
    }
    await createGithubRepo();

    // 1. 获取仓库的公钥
    const { data: publicKey } = await axios.get(
      `https://api.github.com/repos/${githubOwner}/${name_port_back}/actions/secrets/public-key`,
      {
        headers: {
          Authorization: `token ${app.githubToken}`,
          'User-Agent': 'node.js'
        }
      }
    );
    //设置secret
    async function setGithubSecret(name, value) {
      // 加密 secret
      const encryptedBytes = sealedbox.seal(
        Buffer.from(value),
        Buffer.from(publicKey.key, 'base64')
      );
      const encrypted = Buffer.from(encryptedBytes).toString('base64');

      // 3. 上传加密后的 secret
      await axios.put(
        `https://api.github.com/repos/${githubOwner}/${name_port_back}/actions/secrets/${name}`,
        {
          encrypted_value: encrypted,
          key_id: publicKey.key_id
        },
        {
          headers: {
            Authorization: `token ${app.githubToken}`,
            'User-Agent': 'node.js'
          }
        }
      );
    }
    await setGithubSecret('SERVER_HOST', app.host);
    await setGithubSecret('SERVER_SSH_KEY', fs.readFileSync(path.join(dirname, 'id_rsa'), 'utf8'));
    //推送
    async function push() {
      const git = simpleGit(frontAppDir); // 你的本地项目目录
      await git.init(); // 如果已初始化可以忽略
      await git.addRemote('origin', `https://github.com/${githubOwner}/${name_port_front}.git`);
      await git.add('./*');   // 添加所有文件（会自动忽略.gitignore里配置的文件）
      await git.commit('yes:初始化');
      // 推送到main分支
      await git.push('origin', 'main', { '--force': null }); // --force可选，看情况用
    }
    await push();
  }
  await pushCode();
}

export default { getPort, createDbAndTable, dockerBack, backCode, dockerFront, frontCode }