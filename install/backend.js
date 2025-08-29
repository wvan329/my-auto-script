import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import simpleGit from 'simple-git';
import sealedbox from 'tweetnacl-sealedbox-js';
import { NodeSSH } from 'node-ssh';

import { app, dirname, replace } from './config.js';
import {
  name, name_back, backAppDir, githubOwner
} from './name.js';

const dockerBack = async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ host: app.host, username: app.user, password: app.password });

  const script = `
    docker run -d \
    --network wgk-net \
    --name ${name} \
    -v ${name}:/app \
    openjdk:17-jdk-slim \
    java -jar /app/${name}.jar --spring.profiles.active=prod
  `;

  // 执行命令
  const result = await ssh.execCommand(script);

  // 检查执行结果是否包含错误
  if (result.stderr) {
    throw new Error(`执行失败，<${name}>已存在`);
  }

  ssh.dispose();
};

const backCode = async () => {
  const zipUrl = `https://api.github.com/repos/wvan329/my-project-back/zipball/main`;
  const zipPath = path.join(dirname, 'repo-b.zip');
  const tempDir = path.join(dirname, 'temp_download-b');

  const res = await axios.get(zipUrl, {
    headers: { Authorization: `token ${app.githubToken}` },
    responseType: 'arraybuffer'
  });
  await fs.writeFile(zipPath, res.data);

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tempDir, true);

  const [inner] = await fs.readdir(tempDir);
  const innerPath = path.join(tempDir, inner);
  await fs.move(innerPath, backAppDir, { overwrite: true });

  fs.removeSync(zipPath);
  fs.removeSync(tempDir);

  replace(path.join(backAppDir, 'pom.xml'), 1, name_back);
  replace(path.join(backAppDir, '.github/workflows/maven.yml'), 1, name_back);
  replace(path.join(backAppDir, '.github/workflows/maven.yml'), 2, name);
  replace(path.join(backAppDir, '.gitignore'), 1, `/src/main/resources/application-dev.yml`);
  replace(path.join(backAppDir, 'src/main/resources/application.yml'), 1, name);
  replace(path.join(backAppDir, 'src/main/resources/application.yml'), 2, name);
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 1, app.host);
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 2, app.password);
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 3, app.host);
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 4, app.password);
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 5, app.deepseekApi);

  await axios.post(`https://api.github.com/user/repos`, {
    name: name_back,
    private: false,
    auto_init: false
  }, {
    headers: { Authorization: `token ${app.githubToken}` }
  });


  const { data: publicKey } = await axios.get(
    `https://api.github.com/repos/${githubOwner}/${name_back}/actions/secrets/public-key`,
    { headers: { Authorization: `token ${app.githubToken}` } }
  );

  const setGithubSecret = async (name, value) => {
    const encrypted = Buffer.from(
      sealedbox.seal(Buffer.from(value), Buffer.from(publicKey.key, 'base64'))
    ).toString('base64');

    await axios.put(
      `https://api.github.com/repos/${githubOwner}/${name_back}/actions/secrets/${name}`,
      { encrypted_value: encrypted, key_id: publicKey.key_id },
      { headers: { Authorization: `token ${app.githubToken}` } }
    );
  };

  await setGithubSecret('SERVER_HOST', app.host);
  await setGithubSecret('PASSWORD', app.password);
  await setGithubSecret('deepseekApi', app.deepseekApi);
  await setGithubSecret('aliApi', app.aliApi);
  await setGithubSecret('SERVER_SSH_KEY', fs.readFileSync(path.join(dirname, 'config/id_rsa'), 'utf8'));

  const git = simpleGit(backAppDir);
  await git.init();
  await git.addRemote('origin', `https://github.com/${githubOwner}/${name_back}.git`);
  await git.add('./*');
  await git.commit('yes:初始化');
  await git.push('origin', 'main', { '--force': null });
};

export { dockerBack, backCode };
