import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { useAuth } from "@/hooks/use-auth";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { PromptPreview } from "./prompt-preview";
import { getStarterPrompt } from "./prompt-templates";
import { BotTokenSection } from "./bot-token-section";
import { AiProviderSection } from "./ai-provider-section";
import type { ClientDetailContext } from "./client-detail-layout";

export function GeneralTab() {
  const { client, reload } = useOutletContext<ClientDetailContext>();
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();

  const [name, setName] = useState(client.name);
  const [slug, setSlug] = useState(client.slug);
  const [systemPrompt, setSystemPrompt] = useState(client.systemPrompt);
  const [isActive, setIsActive] = useState(client.isActive);
  const [hasProducts, setHasProducts] = useState(client.hasProducts);
  const [hasServices, setHasServices] = useState(client.hasServices);
  const [botType, setBotType] = useState<"order" | "lead">(client.type);
  const [defaultLang, setDefaultLang] = useState<"uz" | "ru" | "en">(
    client.defaultLang,
  );
  const [currency, setCurrency] = useState<"UZS" | "USD" | "RUB">(
    client.currency || "USD",
  );
  const [adminChatId, setAdminChatId] = useState<string>(
    client.adminChatId != null ? String(client.adminChatId) : "",
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(client.name);
    setSlug(client.slug);
    setSystemPrompt(client.systemPrompt);
    setIsActive(client.isActive);
    setHasProducts(client.hasProducts);
    setHasServices(client.hasServices);
    setBotType(client.type);
    setDefaultLang(client.defaultLang);
    setCurrency(client.currency || "USD");
    setAdminChatId(client.adminChatId != null ? String(client.adminChatId) : "");
  }, [client]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const adminChatIdNum = adminChatId.trim()
        ? Number(adminChatId.trim())
        : null;
      if (adminChatId.trim() && (!Number.isFinite(adminChatIdNum) || adminChatIdNum === 0)) {
        toast.error(t("invalid_admin_chat_id"));
        setSaving(false);
        return;
      }

      await api.clients.update(client.id, {
        name,
        systemPrompt,
        adminChatId: adminChatIdNum,
        ...(isSuperAdmin && {
          slug,
          isActive,
          hasProducts,
          hasServices,
          type: botType,
          defaultLang,
          currency,
        }),
      });
      toast.success(t("settings_saved"));
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed_save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("core_settings")}</CardTitle>
          <CardDescription>{t("core_settings_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`grid grid-cols-1 gap-4 ${isSuperAdmin ? "sm:grid-cols-2" : ""}`}>
            <div className="space-y-2">
              <Label htmlFor="name">{t("client_name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {isSuperAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="slug">{t("bot_slug")}</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  pattern="[a-z0-9\-]+"
                  title={t("slug_hint")}
                  className="font-mono bg-muted/30"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("telegram_entry")}{" "}
                  <span className="font-mono text-foreground">
                    t.me/YourBot?start={slug || "..."}
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t("bot_slug")}</Label>
                <div className="h-9 px-3 flex items-center rounded-md border bg-muted/30 font-mono text-sm text-muted-foreground">
                  {slug}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("telegram_entry")}{" "}
                  <span className="font-mono text-foreground">
                    t.me/YourBot?start={slug || "..."}
                  </span>
                </p>
              </div>
            )}
          </div>

          {isSuperAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bot-type">{t("bot_type")}</Label>
                <select
                  id="bot-type"
                  value={botType}
                  onChange={(e) => setBotType(e.target.value as "order" | "lead")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="order">{t("bot_type_order")}</option>
                  <option value="lead">{t("bot_type_lead")}</option>
                </select>
                <p className="text-[11px] text-muted-foreground">{t("bot_type_hint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-lang">{t("default_language")}</Label>
                <select
                  id="default-lang"
                  value={defaultLang}
                  onChange={(e) => setDefaultLang(e.target.value as "uz" | "ru" | "en")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="uz">O'zbek</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
                <p className="text-[11px] text-muted-foreground">{t("default_language_hint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t("currency")}</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "UZS" | "USD" | "RUB")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="USD">USD ($)</option>
                  <option value="UZS">UZS (so'm)</option>
                  <option value="RUB">RUB (₽)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">{t("currency_hint")}</p>
              </div>
            </div>
          )}

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
            <p className="text-[11px] text-muted-foreground">
              {t("admin_chat_id_hint")}
            </p>
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
              className="font-mono text-sm resize-y bg-muted/30"
            />
            <p className="text-[11px] text-muted-foreground">{t("system_prompt_hint")}</p>
          </div>

          <PromptPreview systemPrompt={systemPrompt} client={client} />

          {isSuperAdmin && (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div>
                <Label className="text-base">{t("active_status")}</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("active_status_hint")}</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{t("features")}</CardTitle>
            <CardDescription>{t("features_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div>
                <Label className="text-base">{t("enable_products")}</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("enable_products_hint")}</p>
              </div>
              <Switch checked={hasProducts} onCheckedChange={setHasProducts} />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div>
                <Label className="text-base">{t("enable_services")}</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("enable_services_hint")}</p>
              </div>
              <Switch checked={hasServices} onCheckedChange={setHasServices} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving} className="min-w-35">
          {saving ? (
            t("saving")
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {t("save")}
            </>
          )}
        </Button>
      </div>
    </form>

      <AiProviderSection client={client} onUpdated={reload} />
      <BotTokenSection client={client} onUpdated={reload} />
    </div>
  );
}
