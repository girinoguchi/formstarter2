#!/usr/bin/env node
// アカウントを作成する。アプリ内にサインアップ画面・ユーザー管理画面が無いため、
// 新しい営業マンのアカウントはこのスクリプトで発行する。
// 既存ユーザー名を指定した場合はパスワードの再設定になる。
// 使い方: node scripts/create-user.mjs <username> <password>
import "dotenv/config";
import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { Client } from "pg";

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("使い方: node scripts/create-user.mjs <username> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("パスワードは8文字以上にしてください");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const passwordHash = await bcrypt.hash(password, 12);
const id = `usr${randomUUID().replace(/-/g, "")}`;

await client.query(
  `INSERT INTO "User" (id, username, "passwordHash", "createdAt", "updatedAt")
   VALUES ($1, $2, $3, now(), now())
   ON CONFLICT (username) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"`,
  [id, username, passwordHash],
);

console.log(`ユーザー "${username}" を作成/更新しました。`);
await client.end();
