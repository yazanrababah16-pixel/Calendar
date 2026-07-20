import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { db } = await import("@/lib/db");

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.username = token.username;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT" }).role;
        token.username = (user as { username?: string | null }).username;
      } else if (token.sub) {
        const { db } = await import("@/lib/db");
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          select: { username: true, role: true },
        });
        if (dbUser) {
          token.username = dbUser.username;
          token.role = dbUser.role;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
