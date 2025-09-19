import yaml from 'js-yaml';
import fs from 'fs-extra';
import path from 'path';

const dirname = 'D:/auto';
const configPath = path.join(dirname, 'config/config.yaml');
const { app } = yaml.load(fs.readFileSync(configPath, 'utf8'));

const nginxConfig = `
    location /${app.name}-api/ {
        proxy_pass http://${app.name}:8080/;
        proxy_http_version 1.1;
        proxy_connect_timeout 300;       # 与后端建立连接的超时时间（秒）
        proxy_send_timeout 300;          # 发送请求给后端的超时时间
        proxy_read_timeout 300;          # 等待后端响应的超时时间
        send_timeout 300;                # 向客户端发送响应的超时时间
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /${app.name} {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /${app.name}/index.html;
    }
    # -替换1`;

function replace(filePath, replace, value) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.split(replace).join(value);
  fs.writeFileSync(filePath, content, 'utf8');
}

export { app, dirname, replace, nginxConfig };
