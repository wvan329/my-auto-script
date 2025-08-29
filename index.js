#!/usr/bin/env node
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args[0] === "install") {
  console.log("install");
} else if (args[0] === "uninstall") {
  console.log("i1nstall");
}