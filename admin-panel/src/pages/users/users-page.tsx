import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Power, KeyRound, Loader2 } from "lucide-react";

import { api, type AdminUser } from "@/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user form
  const [showCreate, setShowCreate] = useState(false);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"super_admin" | "client_admin">("client_admin");
  const [newClientId, setNewClientId] = useState("");
  const [creating, setCreating] = useState(false);

  // Reset password
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = () => {
    setLoading(true);
    api.users
      .list()
      .then(setUsers)
      .catch(() => toast.error(t("failed_load_users")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.users.create({
        login: newLogin,
        password: newPassword,
        email: newEmail || undefined,
        phone: newPhone || undefined,
        role: newRole,
        clientId: newRole === "client_admin" && newClientId ? Number(newClientId) : undefined,
      });
      toast.success(t("user_created"));
      setNewLogin(""); setNewPassword(""); setNewEmail(""); setNewPhone(""); setNewClientId("");
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed_create_user"));
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resetId) return;
    setResetting(true);
    try {
      await api.users.resetPassword(resetId, resetPassword);
      toast.success(t("password_reset_success"));
      setResetId(null); setResetPassword("");
    } catch {
      toast.error(t("failed_reset_password"));
    } finally {
      setResetting(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      const result = await api.users.toggleActive(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: result.isActive } : u)),
      );
      toast.success(result.isActive ? t("user_activated") : t("user_deactivated"));
    } catch {
      toast.error(t("failed_toggle_user"));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader title={t("nav_users")} description={t("users_desc")} />
        <Button onClick={() => setShowCreate(!showCreate)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t("create_user")}
        </Button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">{t("create_user")}</CardTitle>
            <CardDescription>{t("create_user_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("login_label")}</Label>
                  <Input
                    value={newLogin}
                    onChange={(e) => setNewLogin(e.target.value)}
                    placeholder="john_doe"
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("password")}</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("min_6_chars")}
                    minLength={6}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("email")} <span className="text-muted-foreground text-xs">({t("optional")})</span></Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("phone")} <span className="text-muted-foreground text-xs">({t("optional")})</span></Label>
                  <Input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+1234567890"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("role")}</Label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as typeof newRole)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="client_admin">{t("client_admin")}</option>
                    <option value="super_admin">{t("super_admin")}</option>
                  </select>
                </div>
                {newRole === "client_admin" && (
                  <div className="space-y-2">
                    <Label>{t("client_id_optional")}</Label>
                    <Input
                      type="number"
                      value={newClientId}
                      onChange={(e) => setNewClientId(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : t("create")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reset password form */}
      {resetId !== null && (
        <Card className="border-orange-300/50">
          <CardHeader>
            <CardTitle className="text-base">{t("reset_password")}</CardTitle>
            <CardDescription>
              {t("reset_password_for", { login: users.find((u) => u.id === resetId)?.login })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder={t("new_password")}
                minLength={6}
                required
                autoComplete="new-password"
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={resetting} variant="destructive">
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("reset_password")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { setResetId(null); setResetPassword(""); }}
              >
                {t("cancel")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_users")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id} className={!user.isActive ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{user.login}</span>
                      <Badge
                        variant={user.role === "super_admin" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {user.role === "super_admin" ? t("super_admin") : t("client_admin")}
                      </Badge>
                      {!user.isActive && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          {t("inactive")}
                        </Badge>
                      )}
                      {user.clientId && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Client #{user.clientId}
                        </Badge>
                      )}
                    </div>
                    {(user.email || user.phone) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {[user.email, user.phone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("created")}: {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetId(user.id);
                        setResetPassword("");
                        setShowCreate(false);
                      }}
                      title={t("reset_password")}
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                      {t("reset_password")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(user)}
                      title={user.isActive ? t("deactivate") : t("activate")}
                      className={user.isActive ? "text-destructive hover:text-destructive" : ""}
                    >
                      <Power className="w-3.5 h-3.5 mr-1.5" />
                      {user.isActive ? t("deactivate") : t("activate")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={load} className="text-muted-foreground">
        <RefreshCw className="w-3.5 h-3.5 mr-2" />
        {t("refresh")}
      </Button>
    </div>
  );
}
