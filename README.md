This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3300](http://localhost:3300) with your browser to see the result.

### ポート（ローカル開発）

開発機では他プロジェクトと同時に立ち上げることが多いため、このプロジェクトは
混み合う3000番台前半・5432を避けて専用の番号を使う。

| 用途 | ポート | 備考 |
| --- | --- | --- |
| アプリ（`npm run dev`） | 3300 | `server.ts`の既定値。`PORT`で上書き可 |
| PostgreSQL | 5433 | `postgresql@16`（`brew services`で常駐）。5432はDockerの`ridge_db`が占有 |

Postgresが落ちている状態で`localhost:5432`へ繋ぐと、別プロジェクトのDockerコンテナに
当たって`SASL: ... client password must be a string`で全ページが500になる。
その場合は`brew services list`で`postgresql@16`が`started`か確認する。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
