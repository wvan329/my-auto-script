import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { NodeSSH } from 'node-ssh';
import AdmZip from 'adm-zip';
import simpleGit from 'simple-git';
import sealedbox from 'tweetnacl-sealedbox-js';

import { app, dirname, replace } from './config.js';
import {
  name_port, name_port_front, frontAppDir, githubOwner
} from './port.js';

const dockerFront = async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ host: app.host, username: app.user, password: app.password });

  const remoteFile = '/var/lib/docker/volumes/nginx-conf/_data/default.conf';
  const result = await ssh.execCommand(`cat ${remoteFile}`);
  let content = result.stdout;

  const config = `
    location /${name_port}-api/ {
        proxy_pass http://172.17.0.1:8080/;
        ...
    }
    location /${name_port} {
        ...
    }
    # -替换1
  `;

  content = content.replace('# -替换1', config);
  const localFile = path.join(dirname, 'default.conf');
  fs.writeFileSync(localFile, content);
  await ssh.putFile(localFile, remoteFile);
  await ssh.execCommand('docker exec nginx nginx -s reload');
  fs.unlinkSync(localFile);
  ssh.dispose();
};

const frontCode = async () => {
  const zipUrl = `https://api.github.com/repos/${githubOwner}/my-project-front/zipball/main`;
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

  replace(path.join(frontAppDir, 'vite.config.js'), 1, name_port);
  replace(path.join(frontAppDir, 'vite.config.js'), 2, `${name_port}-api`);
  replace(path.join(frontAppDir, 'vite.config.js'), 3, 'localhost');
  replace(path.join(frontAppDir, 'src/router/index.js'), 1, name_port);
  replace(path.join(frontAppDir, 'index.html'), 1, app.chinese || app.name);
  replace(path.join(frontAppDir, '.github/workflows/maven.yml'), 1, name_port);

  await axios.post(`https://api.github.com/user/repos`, {
    name: name_port_front,
    private: false,
    auto_init: false
  }, {
    headers: { Authorization: `token ${app.githubToken}` }
  });

  const { data: publicKey } = await axios.get(
    `https://api.github.com/repos/${githubOwner}/${name_port_front}/actions/secrets/public-key`,
    { headers: { Authorization: `token ${app.githubToken}` } }
  );

  const setGithubSecret = async (name, value) => {
    const encrypted = Buffer.from(
      sealedbox.seal(Buffer.from(value), Buffer.from(publicKey.key, 'base64'))
    ).toString('base64');

    await axios.put(
      `https://api.github.com/repos/${githubOwner}/${name_port_front}/actions/secrets/${name}`,
      { encrypted_value: encrypted, key_id: publicKey.key_id },
      { headers: { Authorization: `token ${app.githubToken}` } }
    );
  };

  await setGithubSecret('SERVER_HOST', app.host);
  await setGithubSecret('SERVER_SSH_KEY', fs.readFileSync(path.join(dirname, 'config/id_rsa'), 'utf8'));

  const git = simpleGit(frontAppDir);
  await git.init();
  await git.addRemote('origin', `https://github.com/${githubOwner}/${name_port_front}.git`);
  await git.add('./*');
  await git.commit('yes:初始化');
  await git.push('origin', 'main', { '--force': null });
};

export { dockerFront, frontCode };
