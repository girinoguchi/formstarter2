"use client";

import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  username: string;
}

const AuthContext = createContext<AuthUser | null>(null);

export function AuthProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

/** ログイン中ユーザーを取得する。(app)配下のページ・コンポーネントは常にAuthProvider配下にあるため必ず値が返る。 */
export function useAuth(): AuthUser {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
