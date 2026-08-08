export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold text-gray-800">プライバシーポリシー</h1>

      <div className="space-y-8 rounded-xl border border-border bg-white p-8 text-sm leading-relaxed text-gray-700">
        <p>
          FormStarter2（以下「本サービス」）は、ユーザーの個人情報の取扱いについて以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第1条（収集する情報）</h2>
          <p>本サービスでは、以下の情報を収集します。</p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>ユーザー名・メールアドレス等の登録情報</li>
            <li>送信内容設定に登録された会社情報・担当者情報</li>
            <li>本サービスの利用履歴（送信先リスト、実行履歴、操作ログ等）</li>
            <li>IPアドレス、ブラウザの種類、アクセス日時等のアクセス情報</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第2条（利用目的）</h2>
          <p>収集した個人情報は、以下の目的で利用します。</p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>本サービスの提供・運営のため</li>
            <li>ユーザーへの連絡・サポート対応のため</li>
            <li>不正利用の防止・セキュリティ確保のため</li>
            <li>本サービスの改善・新機能開発のため</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第3条（第三者提供）</h2>
          <p>運営者は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。</p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命・身体・財産の保護のために必要な場合</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第4条（委託）</h2>
          <p>
            運営者は、本サービスの運営に必要な範囲で、個人情報の取扱いを外部業者に委託することがあります。この場合、適切な管理を行う業者を選定し、必要な監督を行います。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第5条（情報の管理）</h2>
          <p>
            運営者は、個人情報の漏洩・滅失・毀損の防止のため、適切なセキュリティ対策を実施します。ただし、インターネット上での完全な安全性を保証するものではありません。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第6条（開示・訂正・削除）</h2>
          <p>
            ユーザーは、運営者が保有する自己の個人情報について、開示・訂正・削除を求めることができます。運営者までご連絡ください。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第7条（Cookieの使用）</h2>
          <p>
            本サービスでは、ログイン状態の維持（セッション管理）のためにCookieを使用しています。ブラウザの設定によりCookieを無効にすることができますが、その場合本サービスにログインできません。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第8条（プライバシーポリシーの変更）</h2>
          <p>
            運営者は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは本ページに掲示した時点より効力を生じます。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第9条（お問い合わせ）</h2>
          <p>本ポリシーに関するお問い合わせは、運営者までご連絡ください。</p>
        </section>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">制定日：2026年8月9日</p>
      </div>
    </div>
  );
}
