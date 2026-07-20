"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";

import { updateProfile, changePassword, listUsers } from "@/server/actions/settings";
import { updateUserPassword } from "@/server/actions/patients";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { Mail, Shield, User, Key, Users, Lock, Save, Search, X } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .optional()
    .or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

function ProfileSection() {
  const { data: session, update } = useSession();
  const user = session?.user;
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      username: user?.username ?? "",
    },
  });

  const onSubmit = useCallback(
    async (data: ProfileFormData) => {
      setError(null);
      const formData = new FormData();
      formData.set("name", data.name);
      formData.set("email", data.email);
      if (data.username) formData.set("username", data.username);

      const result = await updateProfile(formData);
      if (result.success) {
        await update();
        toast({ title: "Profile updated", type: "success" });
      } else {
        setError(result.error);
        toast({ title: "Update failed", description: result.error, type: "error" });
      }
    },
    [toast, update],
  );

  const initial = user?.name ? (user.name.trim()[0]?.toUpperCase() ?? "?") : "?";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-4" />
          Personal Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">{initial}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-base">{user?.name ?? "N/A"}</p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="size-3.5" />
              {user?.email ?? "N/A"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Shield className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Role:</span>
          <span className="font-medium capitalize">{user?.role?.toLowerCase() ?? "N/A"}</span>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" {...register("username")} />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting || !isDirty}>
            <Save className="mr-1 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordSection() {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = useCallback(
    async (data: PasswordFormData) => {
      setError(null);
      const formData = new FormData();
      formData.set("currentPassword", data.currentPassword);
      formData.set("newPassword", data.newPassword);
      formData.set("confirmPassword", data.confirmPassword);

      const result = await changePassword(formData);
      if (result.success) {
        reset();
        toast({ title: "Password changed successfully", type: "success" });
      } else {
        setError(result.error);
        toast({ title: "Password change failed", description: result.error, type: "error" });
      }
    },
    [reset, toast],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" type="password" {...register("currentPassword")} />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" {...register("newPassword")} />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            <Key className="mr-1 size-4" />
            {isSubmitting ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AdminUserSection() {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [resetting, setResetting] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const result = await listUsers();
      if (!result.success) throw new Error(result.error);
      return result.users;
    },
    enabled: true,
  });

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.username?.toLowerCase() ?? "").includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [data, searchQuery]);

  const selectedUser = useMemo(
    () => data?.find((u) => u.id === selectedUserId),
    [data, selectedUserId],
  );

  const handleResetPassword = useCallback(async () => {
    if (!selectedUserId || !newPassword) return;
    setError(null);
    setResetting(true);
    const result = await updateUserPassword(selectedUserId, newPassword);
    setResetting(false);
    if (result.success) {
      setNewPassword("");
      toast({ title: "Password updated", type: "success" });
    } else {
      setError(result.error);
      toast({ title: "Failed", description: result.error, type: "error" });
    }
  }, [selectedUserId, newPassword, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" />
          User Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="userSearch">Search Users</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="userSearch"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedUserId("");
              }}
              placeholder="Search by name, email, username, or role..."
              className="pl-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
          </div>
        ) : isError ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {queryError?.message ?? "Failed to load users"}
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {searchQuery ? "No users match your search." : "No users found."}
          </p>
        ) : (
          <div className="space-y-2">
            <Label>Select User</Label>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-1">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full rounded-sm px-3 py-2 text-left text-sm transition-colors ${
                    selectedUserId === u.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="ml-2 text-xs opacity-70">{u.email}</span>
                  <span className="ml-auto text-xs capitalize opacity-60">
                    {u.role.toLowerCase()}
                  </span>
                  {u.username && <span className="ml-2 text-xs opacity-50">@{u.username}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedUserId && selectedUser && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm">
              <span className="font-medium">{selectedUser.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                ({selectedUser.role.toLowerCase()})
              </span>
              {selectedUser.username && (
                <span className="ml-2 text-xs text-muted-foreground">@{selectedUser.username}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminNewPassword">New Password</Label>
              <div className="flex gap-2">
                <Input
                  id="adminNewPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={!newPassword || newPassword.length < 6 || resetting}
                >
                  <Key className="mr-1 size-4" />
                  {resetting ? "Resetting..." : "Reset"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      <ProfileSection />
      <PasswordSection />

      {role === "ADMIN" && <AdminUserSection />}
    </div>
  );
}
