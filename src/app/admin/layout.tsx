import { Header } from "@/components/Header";
import { AdminTabs } from "./AdminTabs";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <Header user={user} />
      <main>
        <h1 style={{ marginBottom: 14 }}>Administration</h1>
        <AdminTabs />
        {children}
      </main>
    </>
  );
}
