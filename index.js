#!/usr/bin/env node
import { install } from "./install.js";
import { uninstall } from "./uninstall.js";
const args = process.argv.slice(2);

if (args[0] === "install") {
  install();
} else if (args[0] === "uninstall") {
  uninstall();
}