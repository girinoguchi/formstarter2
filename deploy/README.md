# formstarter2 をVPS（formstarterAppと同じサーバー）にデプロイする

## 前提・設計上の注意

formstarter2は「実Chromeの見える画面を人間が見て、Turnstile解決・送信ボタンを押す」設計
（`src/infrastructure/browser/playwright-session-manager.ts`のコメント参照）のため、通常の
Next.jsアプリと違い**画面(X11ディスプレイ)が必要**。VPSは通常GUIを持たないため、
Xvfb（仮想ディスプレイ）+ x11vnc（VNC経由でその仮想ディスプレイを覗き見る）を使う。

VNCはSSHトンネル経由でのみアクセスする（`-localhost`でバインドし、外部に一切晒さない）。
これはセキュリティ上必須——VNC自体には強い認証機構が無いため、直接インターネットに
晒すと乗っ取りリスクがある。

formstarterAppの既存設定・ポート・nginx server blockには一切手を加えない。別ドメイン
（サブドメイン）・別ポート・別systemdサービスとして完全に独立させる。

## 1. 必要パッケージのインストール

```bash
sudo apt update
sudo apt install -y xvfb x11vnc

# 実Chromeが未インストールなら
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install -y google-chrome-stable
```

`src/infrastructure/browser/playwright-session-manager.ts`のCHROME_EXECUTABLE_CANDIDATES
はLinux向けに`/usr/bin/google-chrome`等を既にフォールバックとして持っている（未検証だが
標準的なパスなので通常はこれで見つかる）。

## 2. VNCパスワードの作成

```bash
sudo mkdir -p /etc/formstarter2
sudo x11vnc -storepasswd /etc/formstarter2/vnc.passwd
```

## 3. 秘密情報ファイルの作成

`.env`と同じ形式で、リポジトリの外（サーバー上にのみ）作成する。

```bash
sudo tee /etc/formstarter2/env <<'EOF'
DATABASE_URL=postgresql://...
FIELD_CLASSIFIER_MODEL=openai/gpt-4o-mini
RUN_CONCURRENCY=8
AUTH_SECRET=（32文字以上のランダム文字列）
EOF
sudo chmod 600 /etc/formstarter2/env
```

## 4. アプリの配置・ビルド

```bash
git clone https://github.com/girinoguchi/formstarter2.git <APP_DIR>
cd <APP_DIR>
npm install
npx prisma migrate deploy
npm run build
```

## 5. systemdサービスの配置

先に`which npm`で実際のnpmの絶対パスを確認しておく。nvm等でNode/npmを入れている場合、
systemdサービスからは`PATH`が通っていないため`/usr/bin/npm`のような固定パスでは動かない
ことが多い（`formstarter2-app.service`の`ExecStart`をその環境の実際のパスに合わせて
書き換えること）。

`deploy/systemd/`配下の3ファイルを`/etc/systemd/system/`へコピーし、
`<APP_USER>` / `<APP_DIR>` / `<APP_PORT>` をプレースホルダから実際の値へ置き換える。

```bash
sudo cp deploy/systemd/formstarter2-xvfb.service /etc/systemd/system/
sudo cp deploy/systemd/formstarter2-x11vnc.service /etc/systemd/system/
sudo cp deploy/systemd/formstarter2-app.service /etc/systemd/system/
# <APP_USER> / <APP_DIR> / <APP_PORT> を編集
sudo systemctl daemon-reload
sudo systemctl enable --now formstarter2-xvfb formstarter2-x11vnc formstarter2-app
sudo systemctl status formstarter2-app
```

## 6. nginxでの公開（formstarterAppとは別ドメイン）

`deploy/nginx/formstarter2.conf`の`<FORMSTARTER2_DOMAIN>` / `<APP_PORT>`を置き換えて配置。

```bash
sudo cp deploy/nginx/formstarter2.conf /etc/nginx/sites-available/formstarter2
sudo ln -s /etc/nginx/sites-available/formstarter2 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <FORMSTARTER2_DOMAIN>
```

## 7. Chrome画面を見る・操作する（VNC経由）

手元のPCから：

```bash
ssh -L 5999:localhost:5999 <APP_USER>@<VPS_HOST>
```

トンネルを張ったまま、手元のVNCビューア（macOSなら「画面共有.app」に`vnc://localhost:5999`
でも開ける）で接続し、VNCパスワード（手順2）を入力する。「実行」を押してタブが開くと、
このVNC画面上にChromeウィンドウが表示され、フォーム内容の確認・Turnstile解決・送信ボタンの
クリックがそのまま行える。

## 8. 動作確認チェックリスト

- [ ] `systemctl status formstarter2-xvfb formstarter2-x11vnc formstarter2-app` が全てactive
- [ ] `https://<FORMSTARTER2_DOMAIN>` にアクセスしてログイン画面が表示される
- [ ] `ssh -L 5999:localhost:5999 ...` + VNCビューアでXvfbの画面（最初は何も無い灰色/黒画面）が見える
- [ ] ターゲットで「実行」を押し、VNC画面上に実際にChromeタブが開く
- [ ] Turnstileがあるサイトで、VNC越しにチェックボックスをクリックして成功する
