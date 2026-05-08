import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import Image from "next/image";
import { SectionLabel } from "../../components/section-label";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-4xl">
      <div className="mb-3">
        <SectionLabel>Account</SectionLabel>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-10">Settings</h1>

      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <h2 className="text-xs font-mono uppercase tracking-widest text-secondary mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-4">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name || "Account avatar"}
              width={64}
              height={64}
              className="rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-bg" aria-hidden />
          )}
          <div>
            <p className="text-lg font-medium">{user.name || user.githubUsername}</p>
            <p className="text-secondary text-sm font-mono">@{user.githubUsername}</p>
            {user.email && <p className="text-secondary text-sm">{user.email}</p>}
          </div>
        </div>
        <p className="text-xs text-secondary font-mono">
          Account created {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-xs font-mono uppercase tracking-widest text-secondary mb-4">Danger zone</h2>
        <p className="text-sm text-secondary mb-4">
          Sign out of this device. Your API keys remain active.
        </p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button
            type="submit"
            className="text-sm text-red-400 hover:text-red-300 px-4 py-2 border border-red-800 rounded-lg hover:bg-red-900/20 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
