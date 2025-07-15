import path from 'path';
import { app, dirname } from './config.js';

const name = `${app.name}`;
const name_back = `${name}-back`;
const name_front = `${name}-front`;
const backAppDir = path.join(dirname, name_back);
const frontAppDir = path.join(dirname, name_front);
const githubOwner = app.githubOwner;

export {
  getName as getPort, port, name, name_back, name_front, backAppDir, frontAppDir, githubOwner
};
