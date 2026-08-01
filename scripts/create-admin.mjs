#!/usr/bin/env node
// 初回セットアップ用: 管理者ユーザーを作成する。管理者UI（/admin）ができる前に
// 最低1人ログインできる状態を作るための一度きりのスクリプト。
// 使い方: node scripts/create-admin.mjs <username> <password>
import "dotenv/config";
import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { Client } from "pg";

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("使い方: node scripts/create-admin.mjs <username> <password>");
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
  `INSERT INTO "User" (id, username, "passwordHash", "isAdmin", "createdAt", "updatedAt")
   VALUES ($1, $2, $3, true, now(), now())
   ON CONFLICT (username) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "isAdmin" = true`,
  [id, username, passwordHash],
);

console.log(`管理者ユーザー "${username}" を作成/更新しました。`);
await client.end();
