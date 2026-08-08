"use client";

import { Ban, List, Mail, MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof List;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/profile", label: "送信内容設定", icon: Mail },
  { href: "/targets", label: "リスト設定・送信実行", icon: List },
  { href: "/list-search", label: "リスト検索", icon: Search },
  { href: "/ng-list", label: "NGリスト登録・削除", icon: Ban },
  { href: "/contact", label: "お問い合わせ", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 z-40 flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 pt-7 pb-6">
        <Link href="/targets" className="flex items-center gap-0.5">
          {/* 単色のロゴなので、白抜きにして濃緑のサイドバーへ載せる。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="FormStarter"
            className="h-8 w-auto object-contain brightness-0 invert"
          />
          {/* ロゴ画像はFormStarterappと共通のため、プロダクト名の「2」だけを文字で足す。 */}
          <span className="text-xl leading-none font-semibold text-white">2</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-[13px] transition-colors",
                active
                  ? "bg-white/20 font-semibold text-white"
                  : "text-white/65 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 px-6 py-5">
        <Link
          href="/terms"
          className="block text-[11px] text-white/40 transition-colors hover:text-white/70"
        >
          利用規約
        </Link>
        <Link
          href="/privacy"
          className="block text-[11px] text-white/40 transition-colors hover:text-white/70"
        >
          プライバシーポリシー
        </Link>
      </div>
    </aside>
  );
}
