
import fs from "fs";
import { parse } from "yaml";
import { Env } from "./interfaces";

const file = fs.readFileSync("./user_config.yml", "utf8");

export const env: Env = parse(file);