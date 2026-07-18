import { type DefaultSession } from "next-auth";

type Role = "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT";

declare module "next-auth" {
  interface User {
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
  }
}
