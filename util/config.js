import yaml from 'js-yaml';
import fs from 'fs-extra';
import path from 'path';

const dirname = 'D:/auto';
const configPath = path.join(dirname, 'config/config.yaml');
const { app } = yaml.load(fs.readFileSync(configPath, 'utf8'));

function replace(filePath, replaceNum, value) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.split(`-替换${replaceNum}`).join(value);
  fs.writeFileSync(filePath, content, 'utf8');
}

export { app, dirname, replace };
