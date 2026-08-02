# formstarter2 ローカルエージェント

「実行」を押したときにフォーム入力済みのChromeタブを、あなた自身のPC上に開くための常駐プログラムです。フォーム入力はサーバー側が自動で行いますが、Turnstile解決・最終的な送信ボタンのクリックは常にあなた自身がこのPC上で行います。

## セットアップ

```bash
cd agent
npm install
cp .env.example .env
# .env を編集して FORMSTARTER_SERVER_URL / FORMSTARTER_USERNAME / FORMSTARTER_PASSWORD を設定
npm start
```

起動すると:
1. ローカルにChromeが1つ起動します（既存のformstarter2用プロファイルとは別の専用プロファイル）。
2. あなたのアカウントでログインし、サーバーへ接続します。
3. 接続している間、Web UIで「実行」「まとめて開く」を押すと、このPC上のChromeにタブが開きます。

このプログラムを終了してもChromeは開いたままになります（次回起動時は既存のChromeを再利用します）。サーバーとの接続が切れても自動的に再接続を試みます。
