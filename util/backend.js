import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import simpleGit from 'simple-git';
import sealedbox from 'tweetnacl-sealedbox-js';
import { NodeSSH } from 'node-ssh';

import { app, dirname, replace } from './config.js';
import {
  name_port, name_port_back, port, backAppDir, githubOwner
} from './port.js';

const dockerBack = async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ host: app.host, username: app.user, password: app.password });

  const script = `
    docker run -d \
    --name ${name_port} \
    -p ${port}:8080 \
    -v ${name_port}:/app \
    openjdk:17-jdk-slim \
    java -jar /app/${name_port}.jar --spring.profiles.active=prod
  `;
  await ssh.execCommand(script);
  ssh.dispose();
};

const backCode = async () => {
  const zipUrl = `https://api.github.com/repos/${githubOwner}/my-project-back/zipball/main`;
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

  replace(path.join(backAppDir, 'pom.xml'), 1, name_port_back);
  replace(path.join(backAppDir, '.github/workflows/maven.yml'), 1, name_port_back);
  replace(path.join(backAppDir, '.github/workflows/maven.yml'), 2, name_port);
  replace(path.join(backAppDir, '.gitignore'), 1, `/src/main/resources/application-dev.yml`);
  replace(path.join(backAppDir, 'src/main/resources/application.yml'), 1, name_port);
  replace(path.join(backAppDir, 'src/main/resources/application.yml'), 2, app.name);
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 1, app.host);
  replace(path.join(backAppDir, 'src/main/resources/application-dev.yml'), 2, app.password);

  const { data: publicKey } = await axios.get(
    `https://api.github.com/repos/${githubOwner}/${name_port_back}/actions/secrets/public-key`,
    { headers: { Authorization: `token ${app.githubToken}` } }
  );

  const setGithubSecret = async (name, value) => {
    const encrypted = Buffer.from(
      sealedbox.seal(Buffer.from(value), Buffer.from(publicKey.key, 'base64'))
    ).toString('base64');

    await axios.put(
      `https://api.github.com/repos/${githubOwner}/${name_port_back}/actions/secrets/${name}`,
      { encrypted_value: encrypted, key_id: publicKey.key_id },
      { headers: { Authorization: `token ${app.githubToken}` } }
    );
  };

  await axios.post(`https://api.github.com/user/repos`, {
    name: name_port_back,
    private: false,
    auto_init: false
  }, {
    headers: { Authorization: `token ${app.githubToken}` }
  });

  await setGithubSecret('SERVER_HOST', app.host);
  await setGithubSecret('PASSWORD', app.password);
  await setGithubSecret('SERVER_SSH_KEY', fs.readFileSync(path.join(dirname, 'config/id_rsa'), 'utf8'));

  const git = simpleGit(backAppDir);
  await git.init();
  await git.addRemote('origin', `https://github.com/${githubOwner}/${name_port_back}.git`);
  await git.add('./*');
  await git.commit('yes:初始化');
  await git.push('origin', 'main', { '--force': null });
};

export { dockerBack, backCode };
