import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-medium text-secondary uppercase tracking-wider mb-4">Account</h2>
        <div className="flex items-center gap-4 mb-4">
          <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-full" />
          <div>
            <p className="text-lg font-medium">{user.name || user.githubUsername}</p>
            <p className="text-secondary text-sm">@{user.githubUsername}</p>
            {user.email && <p className="text-secondary text-sm">{user.email}</p>}
          </div>
        </div>
        <p className="text-xs text-secondary">Account created {new Date(user.createdAt).toLocaleDateString()}</p>
      </div>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button type="submit" className="text-sm text-red-400 hover:text-red-300 px-4 py-2 border border-red-800 rounded-lg hover:bg-red-900/20 transition-colors">
          Sign out
        </button>
      </form>
    </div>
  );
}
