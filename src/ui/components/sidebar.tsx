"use client";

import { List, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/profile", label: "送信内容設定", icon: Mail },
  { href: "/targets", label: "リスト設定・送信実行", icon: List },
];

export function Sidebar() {
  const pathname = usePathname();

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
    </aside>
  );
}
