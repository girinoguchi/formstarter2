import { redirect } from "next/navigation";

import { getSession } from "../../src/lib/auth";
import { Sidebar } from "../../src/ui/components/sidebar";
import { AuthProvider } from "../../src/ui/providers/auth-provider";
import { QueryProvider } from "../../src/ui/providers/query-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <QueryProvider>
      <AuthProvider user={{ id: user.id, username: user.username, isAdmin: user.isAdmin }}>
        <Sidebar username={user.username} isAdmin={user.isAdmin} />
        <div className="flex min-h-full flex-1 flex-col pl-60">{children}</div>
      </AuthProvider>
    </QueryProvider>
  );
}
