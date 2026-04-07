import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.id) return false;
      const githubId = String(profile.id);
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.githubId, githubId))
        .limit(1);
      if (existing.length === 0) {
        const id = crypto.randomUUID();
        await db.insert(users).values({
          id,
          githubId,
          githubUsername: (profile as any).login ?? "",
          name: profile.name ?? "",
          email: profile.email ?? "",
          avatarUrl: (profile as any).avatar_url ?? "",
        });
      }
      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.id) {
        const githubId = String(profile.id);
        const user = await db
          .select()
          .from(users)
          .where(eq(users.githubId, githubId))
          .limit(1);
        if (user[0]) {
          token.userId = user[0].id;
          token.tier = user[0].tier;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        (session as any).userId = token.userId;
        (session as any).tier = token.tier;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
