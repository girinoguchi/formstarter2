"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "../providers/auth-provider";

/**
 * 画面上部の固定バー。ログイン中のアカウント表示とログアウトを担う
 * （FormStarterappと同じ配置——サイドバーは案内、アカウント操作は右上に集約する）。
 */
export function TopBar() {
  const { username } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="fixed top-0 right-0 left-60 z-30 flex h-14 items-center justify-end border-b border-border bg-white px-8">
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          <span>{username}</span>
          <ChevronDown size={14} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute top-full right-0 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-muted/50"
            >
              <LogOut size={14} />
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
