import { ExternalLink, MessageSquare } from "lucide-react";

/**
 * お問い合わせ。外部フォーム（Googleフォーム等）へ送るだけの画面で、
 * アプリ側に受信・保存の仕組みは持たない（FormStarterappと同じ扱い）。
 * 差し替えるのはこのURLだけ。
 */
const CONTACT_FORM_URL = "https://forms.gle/XXXXXXXXXXXXXXXXXX";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="space-y-6 rounded-xl border border-border bg-white p-8 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare size={24} className="text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-gray-900">お問い合わせ</h1>
          <p className="text-sm leading-relaxed text-gray-500">
            ご不明点・ご要望・不具合の報告など、
            <br />
            お気軽にお問い合わせください。
          </p>
        </div>
        <a
          href={CONTACT_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          お問い合わせフォームを開く
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
