"use client";

import { format } from "date-fns";
import {
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminUserRecord,
  CompanyOption,
  CreateUserResponse,
} from "@/lib/admin/settings-types";
import { cn } from "@/lib/utils";

type UserManagementTabProps = {
  companies: CompanyOption[];
};

function getInitials(fullName: string | null, email: string): string {
  const source = fullName?.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function UserManagementTab({ companies }: UserManagementTabProps) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [removeUser, setRemoveUser] = useState<AdminUserRecord | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "client">("client");
  const [companyId, setCompanyId] = useState<string>("");
  const [sendInvite, setSendInvite] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users");
      const result = (await response.json()) as {
        data: AdminUserRecord[] | null;
        error: string | null;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to load users.");
      }

      setUsers(result.data ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load users.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function resetAddForm() {
    setFullName("");
    setEmail("");
    setRole("client");
    setCompanyId("");
    setSendInvite(true);
  }

  async function handleAddUser(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          role,
          companyId: role === "client" ? companyId : null,
          sendInvite,
        }),
      });

      const result = (await response.json()) as {
        data: CreateUserResponse | null;
        error: string | null;
      };

      if (!response.ok || result.error || !result.data) {
        throw new Error(result.error ?? "Failed to create user.");
      }

      setUsers((current) => [result.data!.user, ...current]);
      setAddOpen(false);
      resetAddForm();

      if (result.data.tempPassword) {
        setTempPassword(result.data.tempPassword);
        toast.success("User created with temporary password.");
      } else {
        toast.success("Invite sent successfully.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create user.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendInvite(user: AdminUserRecord) {
    setActionUserId(user.id);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/resend-invite`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        data: { success: boolean } | null;
        error: string | null;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to resend invite.");
      }

      toast.success(`Invite resent to ${user.email}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resend invite.";
      toast.error(message);
    } finally {
      setActionUserId(null);
    }
  }

  async function handleResetPassword(user: AdminUserRecord) {
    setActionUserId(user.id);

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/reset-password`,
        { method: "POST" }
      );
      const result = (await response.json()) as {
        data: { success: boolean } | null;
        error: string | null;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to send reset email.");
      }

      toast.success(`Password reset email sent to ${user.email}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send reset email.";
      toast.error(message);
    } finally {
      setActionUserId(null);
    }
  }

  async function handleRemoveUser() {
    if (!removeUser) {
      return;
    }

    setActionUserId(removeUser.id);

    try {
      const response = await fetch(`/api/admin/users/${removeUser.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        data: { success: boolean } | null;
        error: string | null;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to remove user.");
      }

      setUsers((current) => current.filter((user) => user.id !== removeUser.id));
      toast.success("User removed.");
      setRemoveUser(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove user.";
      toast.error(message);
    } finally {
      setActionUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-navy">Platform Users</h2>
          <p className="text-sm text-text-muted">
            Manage admin and client access
          </p>
        </div>
        <Button
          className="bg-tbc-red hover:bg-tbc-red-hover"
          onClick={() => setAddOpen(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-text-muted">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading users...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-text-muted"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-navy/10 text-xs text-navy">
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.full_name ?? "Unnamed user"}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          user.role === "admin"
                            ? "bg-[#CC2B2B] text-white dark:bg-navy hover:bg-navy"
                            : "bg-[#CC2B2B] text-white dark:bg-tbc-red hover:bg-tbc-red"
                        )}
                      >
                        {user.role === "admin" ? "Admin" : "Client"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.company_name ?? (
                        <span className="text-text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          user.status === "active"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        )}
                      >
                        {user.status === "active" ? "Active" : "Invited"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        {user.status === "invited" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionUserId === user.id}
                            onClick={() => void handleResendInvite(user)}
                          >
                            {actionUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Mail className="mr-1 h-3.5 w-3.5" />
                                Resend Invite
                              </>
                            )}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionUserId === user.id}
                          onClick={() => void handleResetPassword(user)}
                        >
                          {actionUserId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="mr-1 h-3.5 w-3.5" />
                              Reset Password
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={actionUserId === user.id}
                          onClick={() => setRemoveUser(user)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Create a new admin or client account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(value: "admin" | "client") => {
                  setRole(value);
                  if (value === "admin") {
                    setCompanyId("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "client" ? (
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={companyId} onValueChange={setCompanyId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <Checkbox
                checked={sendInvite}
                onCheckedChange={(checked) => setSendInvite(checked === true)}
              />
              Send invite email
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-tbc-red hover:bg-tbc-red-hover"
                disabled={
                  submitting ||
                  (role === "client" && !companyId) ||
                  !fullName.trim() ||
                  !email.trim()
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tempPassword)} onOpenChange={() => setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary Password</DialogTitle>
            <DialogDescription>
              Share this password with the user securely. They should change it
              after first login.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-slate-50 px-4 py-3 font-mono text-sm">
            {tempPassword}
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(removeUser)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {removeUser?.email} from Autopilot and remove
              their login access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleRemoveUser()}
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
