import { NodeSSH } from 'node-ssh';
import path from 'path';
import { app, dirname } from './config.js';

let port = '';
let name_port = '';
let name_port_back = '';
let name_port_front = '';
let backAppDir = '';
let frontAppDir = '';
const githubOwner = app.githubOwner;

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

  port = (await ssh.execCommand(script)).stdout.trim();
  name_port = `${app.name}${port}`;
  name_port_back = `${name_port}-back`;
  name_port_front = `${name_port}-front`;
  backAppDir = path.join(dirname, name_port_back);
  frontAppDir = path.join(dirname, name_port_front);

  console.log(`端口：${port}`);
  ssh.dispose();
};

export {
  getPort, port, name_port, name_port_back, name_port_front, backAppDir, frontAppDir,githubOwner
};
