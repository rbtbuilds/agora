import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Nav } from "../components/nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex h-screen">
      <Nav user={{ name: user.name || user.githubUsername, avatarUrl: user.avatarUrl, tier: user.tier }} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
