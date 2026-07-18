import { create } from "zustand";

type Role = "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  image?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
}));
