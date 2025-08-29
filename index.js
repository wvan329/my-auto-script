#!/usr/bin/env node
import { install } from "./install";
import { uninstall } from "./uninstall";
const args = process.argv.slice(2);

if (args[0] === "install") {
  install();
} else if (args[0] === "uninstall") {
  uninstall();
}