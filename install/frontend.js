import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { NodeSSH } from 'node-ssh';
import AdmZip from 'adm-zip';
import simpleGit from 'simple-git';
import sealedbox from 'tweetnacl-sealedbox-js';

import { app, dirname, replace, nginxConfig } from './config.js';
import {
  name, name_front, frontAppDir, githubOwner
} from './name.js';

const dockerFront = async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ host: app.host, username: app.user, password: app.password });

  const remoteFile = '/var/lib/docker/volumes/nginx-conf/_data/default.conf';
  const result = await ssh.execCommand(`cat ${remoteFile}`);
  let content = result.stdout;



  content = content.replace('# -替换1', nginxConfig);
  const localFile = path.join(dirname, 'default.conf');
  fs.writeFileSync(localFile, content);
  await ssh.putFile(localFile, remoteFile);

  //后端容器启动成功才能刷新成功
  while (true) {
    const result = await ssh.execCommand('docker exec nginx nginx -s reload');

    if (result.code !== 0) {
      console.log("等待后端容器启动...");
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒钟
    } else {
      break;
    }
  }
  fs.unlinkSync(localFile);
  ssh.dispose();
};

const frontCode = async () => {
  const zipUrl = `https://api.github.com/repos/wvan329/my-project-front/zipball/main`;
  const zipPath = path.join(dirname, 'repo-f.zip');
  const tempDir = path.join(dirname, 'temp_download-f');

  const res = await axios.get(zipUrl, {
    headers: { Authorization: `token ${app.githubToken}` },
    responseType: 'arraybuffer'
  });
  await fs.writeFile(zipPath, res.data);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tempDir, true);
  const [inner] = await fs.readdir(tempDir);
  await fs.move(path.join(tempDir, inner), frontAppDir, { overwrite: true });

  fs.removeSync(zipPath);
  fs.removeSync(tempDir);

  replace(path.join(frontAppDir, 'vite.config.js'), 1, name);
  replace(path.join(frontAppDir, 'vite.config.js'), 2, `${name}-api`);
  replace(path.join(frontAppDir, '.env'), 1, app.chinese || app.name);
  replace(path.join(frontAppDir, '.env'), 2, name);
  replace(path.join(frontAppDir, '.github/workflows/maven.yml'), 1, name);

  await axios.post(`https://api.github.com/user/repos`, {
    name: name_front,
    private: false,
    auto_init: false
  }, {
    headers: { Authorization: `token ${app.githubToken}` }
  });

  const { data: publicKey } = await axios.get(
    `https://api.github.com/repos/${githubOwner}/${name_front}/actions/secrets/public-key`,
    { headers: { Authorization: `token ${app.githubToken}` } }
  );

  const setGithubSecret = async (name, value) => {
    const encrypted = Buffer.from(
      sealedbox.seal(Buffer.from(value), Buffer.from(publicKey.key, 'base64'))
    ).toString('base64');

    await axios.put(
      `https://api.github.com/repos/${githubOwner}/${name_front}/actions/secrets/${name}`,
      { encrypted_value: encrypted, key_id: publicKey.key_id },
      { headers: { Authorization: `token ${app.githubToken}` } }
    );
  };

  await setGithubSecret('SERVER_HOST', app.host);
  await setGithubSecret('SERVER_SSH_KEY', fs.readFileSync(path.join(dirname, 'config/id_rsa'), 'utf8'));

  const git = simpleGit(frontAppDir);
  await git.init();
  await git.addRemote('origin', `https://github.com/${githubOwner}/${name_front}.git`);
  await git.add('./*');
  await git.commit('yes:初始化');
  await git.push('origin', 'main', { '--force': null });
};

export { dockerFront, frontCode };
