import { type DefaultSession } from "next-auth";

type Role = "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT";

declare module "next-auth" {
  interface User {
    role: Role;
    username?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      username?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    username?: string | null;
  }
}
