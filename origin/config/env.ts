import fs from "fs";
import { parse } from "yaml";
import { Env } from "./interfaces";
import path from "path";

const file = fs.readFileSync(path.resolve(__dirname, "./user_config.yml"), "utf8");

export const env: Env = parse(file);
