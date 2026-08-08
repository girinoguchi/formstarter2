export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold text-gray-800">利用規約</h1>

      <div className="space-y-8 rounded-xl border border-border bg-white p-8 text-sm leading-relaxed text-gray-700">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第1条（適用）</h2>
          <p>
            本利用規約（以下「本規約」）は、FormStarter2（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意した上で本サービスを利用するものとします。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第2条（利用登録）</h2>
          <p>
            本サービスへの登録を希望する方は、本規約に同意の上、所定の方法により利用登録を申請するものとします。運営者が登録を承認した時点で利用契約が成立します。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第3条（禁止事項）</h2>
          <p>ユーザーは以下の行為を行ってはなりません。</p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>法令または公序良俗に違反する行為</li>
            <li>送信を明示的に禁止しているサイトへの営業行為</li>
            <li>スパム行為・大量の迷惑メッセージの送信</li>
            <li>本サービスの運営を妨害する行為</li>
            <li>他のユーザーまたは第三者の権利・利益を侵害する行為</li>
            <li>虚偽の情報を入力・送信する行為</li>
            <li>本サービスを不正な目的で利用する行為</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第4条（本サービスの提供の停止等）</h2>
          <p>
            運営者は、以下のいずれかの事由があると判断した場合、ユーザーへの事前通知なく本サービスの全部または一部の提供を停止または中断することができます。
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>本サービスにかかるシステムの保守点検または更新を行う場合</li>
            <li>
              地震、落雷、火災、停電またはウイルスなどの不可抗力により、本サービスの提供が困難となった場合
            </li>
            <li>その他、運営者が本サービスの提供が困難と判断した場合</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第5条（免責事項）</h2>
          <p>
            運営者は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性を含む）がないことを保証しておりません。本サービスに起因してユーザーに生じたあらゆる損害について、運営者は一切の責任を負いません。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第6条（サービス内容の変更等）</h2>
          <p>
            運営者は、ユーザーへの事前通知なく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第7条（利用規約の変更）</h2>
          <p>
            運営者は必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。変更後の利用規約は、本サービス上に掲示した時点より効力を生じるものとします。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">第8条（準拠法・裁判管轄）</h2>
          <p>
            本規約の解釈にあたっては日本法を準拠法とします。本サービスに関して紛争が生じた場合には、運営者の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">制定日：2026年8月9日</p>
      </div>
    </div>
  );
}
