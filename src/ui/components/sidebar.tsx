"use client";

import { Ban, List, LogOut, Mail, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof List;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/profile", label: "送信内容設定", icon: Mail },
  { href: "/list-search", label: "リスト検索", icon: Search },
  { href: "/targets", label: "リスト設定・送信実行", icon: List },
  { href: "/ng-list", label: "NGリスト", icon: Ban },
];

export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed top-0 left-0 z-40 flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 pt-7 pb-6">
        <Link href="/targets" className="block text-lg font-semibold">
          FormStarter2
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
                active ? "bg-white/20 font-semibold text-white" : "text-white/65 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <p className="truncate px-4 text-xs text-white/60">{username}</p>
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-4 py-2 text-[13px] text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} className="shrink-0" />
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  );
}
