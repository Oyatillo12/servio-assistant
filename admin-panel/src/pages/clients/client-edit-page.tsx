import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BotTypePicker } from "./bot-type-picker";
import { getStarterPrompt } from "./prompt-templates";

/**
 * "New client" form. Existing clients are edited via ClientDetailLayout + GeneralTab.
 */
export function ClientEditPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [hasProducts, setHasProducts] = useState(true);
  const [hasServices, setHasServices] = useState(true);
  const [botType, setBotType] = useState<"order" | "lead">("order");
  const [defaultLang, setDefaultLang] = useState<"uz" | "ru" | "en">("ru");
  const [adminChatId, setAdminChatId] = useState<string>("");
  const [adminLogin, setAdminLogin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const adminChatIdNum = adminChatId.trim() ? Number(adminChatId.trim()) : null;
      if (adminChatId.trim() && (!Number.isFinite(adminChatIdNum) || adminChatIdNum === 0)) {
        toast.error(t("invalid_admin_chat_id"));
        setSaving(false);
        return;
      }

      const payload: Parameters<typeof api.clients.create>[0] = {
        name,
        slug,
        systemPrompt,
        hasProducts,
        hasServices,
        type: botType,
        defaultLang,
        adminChatId: adminChatIdNum ?? undefined,
      };
      if (adminLogin && adminPassword) {
        payload.adminCredentials = { login: adminLogin, password: adminPassword };
      }
      const created = await api.clients.create(payload);
      toast.success(t("client_created"));
      navigate(`/clients/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed_save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-page-enter max-w-3xl pb-12 space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground mb-3 -ml-2"
          onClick={() => navigate("/clients")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("nav_clients")}
        </Button>
        <PageHeader title={t("create_new_client")} description={t("configure_bot")} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("core_settings")}</CardTitle>
            <CardDescription>{t("core_settings_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("client_name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Acme Corp"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">{t("bot_slug")}</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  pattern="[a-z0-9\-]+"
                  title={t("slug_hint")}
                  placeholder="acme-bot"
                  className="font-mono bg-muted/30"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("telegram_entry")}{" "}
                  <span className="font-mono text-foreground">
                    t.me/YourBot?start={slug || "..."}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("bot_type")}</Label>
              <BotTypePicker
                value={botType}
                onChange={(next) => {
                  setBotType(next);
                  // Auto-fill starter template if prompt is empty or was a template for the other type
                  const otherStarter = getStarterPrompt(
                    next === "order" ? "lead" : "order",
                    defaultLang,
                  );
                  if (!systemPrompt.trim() || systemPrompt === otherStarter) {
                    setSystemPrompt(getStarterPrompt(next, defaultLang));
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-lang">{t("default_language")}</Label>
              <select
                id="default-lang"
                value={defaultLang}
                onChange={(e) => {
                  const next = e.target.value as "uz" | "ru" | "en";
                  // Regenerate starter prompt in the new language if user was using one
                  const currentStarter = getStarterPrompt(botType, defaultLang);
                  if (!systemPrompt.trim() || systemPrompt === currentStarter) {
                    setSystemPrompt(getStarterPrompt(botType, next));
                  }
                  setDefaultLang(next);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="uz">O'zbek</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
              <p className="text-[11px] text-muted-foreground">{t("default_language_hint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-chat-id">{t("admin_chat_id")}</Label>
              <Input
                id="admin-chat-id"
                type="text"
                inputMode="numeric"
                value={adminChatId}
                onChange={(e) =>
                  setAdminChatId(e.target.value.replace(/[^0-9-]/g, ""))
                }
                placeholder="e.g., 123456789"
                className="font-mono bg-muted/30"
              />
              <p className="text-[11px] text-muted-foreground">{t("admin_chat_id_hint")}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="prompt">{t("system_prompt")}</Label>
                <button
                  type="button"
                  onClick={() => setSystemPrompt(getStarterPrompt(botType, defaultLang))}
                  className="text-[11px] text-primary hover:underline"
                >
                  {t("use_starter_template")}
                </button>
              </div>
              <Textarea
                id="prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                required
                rows={6}
                placeholder={getStarterPrompt(botType, defaultLang)}
                className="font-mono text-sm resize-y bg-muted/30"
              />
              <p className="text-[11px] text-muted-foreground">{t("system_prompt_hint")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("features")}</CardTitle>
            <CardDescription>{t("features_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
              <div className="min-w-0 mr-3">
                <Label className="text-sm">{t("enable_products")}</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("enable_products_hint")}</p>
              </div>
              <input
                type="checkbox"
                checked={hasProducts}
                onChange={(e) => setHasProducts(e.target.checked)}
                className="size-4 shrink-0"
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
              <div className="min-w-0 mr-3">
                <Label className="text-sm">{t("enable_services")}</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("enable_services_hint")}</p>
              </div>
              <input
                type="checkbox"
                checked={hasServices}
                onChange={(e) => setHasServices(e.target.checked)}
                className="size-4 shrink-0"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin_credentials")}</CardTitle>
            <CardDescription>{t("admin_credentials_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-login">{t("admin_login")}</Label>
                <Input
                  id="admin-login"
                  type="text"
                  value={adminLogin}
                  onChange={(e) => setAdminLogin(e.target.value)}
                  placeholder="client_admin"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">{t("admin_password")}</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder={t("min_6_chars")}
                  minLength={6}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("admin_credentials_hint")}</p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="min-w-35">
            {saving ? (
              t("saving")
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {t("create_configuration")}
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
