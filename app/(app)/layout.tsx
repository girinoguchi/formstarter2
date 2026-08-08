import { redirect } from "next/navigation";

import { getSession } from "../../src/lib/auth";
import { Sidebar } from "../../src/ui/components/sidebar";
import { TopBar } from "../../src/ui/components/top-bar";
import { AuthProvider } from "../../src/ui/providers/auth-provider";
import { QueryProvider } from "../../src/ui/providers/query-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <QueryProvider>
      <AuthProvider user={{ id: user.id, username: user.username }}>
        <Sidebar />
        <TopBar />
        {/* pt-14は固定トップバーの高さ分。背景を薄いグレーにして、白いカードを浮かせる。 */}
        {/* bodyがflexコンテナのため、flex-1が無いとmainが中身の幅までしか広がらず
            右側に余白が残る。pt-14は固定トップバー、pl-60は固定サイドバーの分。 */}
        <main className="min-h-screen w-full flex-1 bg-gray-50 pt-14 pl-60">
          <div className="px-8 py-8">{children}</div>
        </main>
      </AuthProvider>
    </QueryProvider>
  );
}
