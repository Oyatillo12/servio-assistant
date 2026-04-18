import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { api, type Client, type BotConfig } from "@/api";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useTranslation } from "react-i18next";

const DEFAULT_ICONS: Record<string, string> = {
  products: "🛍",
  services: "🛠",
  order: "📦",
  contact: "📞",
  language: "🌐",
  aiChat: "🤖",
  about: "ℹ️",
  prices: "💰",
};

const ORDER_MENU_KEYS = [
  "products",
  "services",
  "order",
  "aiChat",
  "contact",
  "language",
] as const;

const LEAD_MENU_KEYS = ["about", "prices", "contact", "language"] as const;

function parseBotConfig(raw: string | null): BotConfig {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function BotConfigPage() {
  const { id } = useParams();
  const { t } = useTranslation();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bot config state
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [menuButtons, setMenuButtons] = useState<Record<string, boolean>>({});
  const [buttonIcons, setButtonIcons] = useState<Record<string, string>>({
    ...DEFAULT_ICONS,
  });
  const [contactPhone, setContactPhone] = useState("");
  const [contactWebsite, setContactWebsite] = useState("");

  const menuKeys =
    client?.type === "lead"
      ? LEAD_MENU_KEYS
      : ORDER_MENU_KEYS;

  useEffect(() => {
    if (id) {
      api.clients
        .get(Number(id))
        .then((c) => {
          setClient(c);
          const config = parseBotConfig(c.botConfig);
          setWelcomeMessage(config.welcomeMessage ?? "");
          const keys = c.type === "lead" ? LEAD_MENU_KEYS : ORDER_MENU_KEYS;
          const buttons: Record<string, boolean> = {};
          const icons: Record<string, string> = {};
          for (const k of keys) {
            const cfgBtns = config.menuButtons as
              | Record<string, boolean | undefined>
              | undefined;
            const cfgIcons = config.buttonIcons as
              | Record<string, string | undefined>
              | undefined;
            buttons[k] = cfgBtns?.[k] !== false;
            icons[k] = cfgIcons?.[k] ?? DEFAULT_ICONS[k] ?? "";
          }
          setMenuButtons(buttons);
          setButtonIcons(icons);
          setContactPhone(config.contactPhone ?? "");
          setContactWebsite(config.contactWebsite ?? "");
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const botConfig: BotConfig = {
        welcomeMessage: welcomeMessage || undefined,
        menuButtons,
        buttonIcons,
        contactPhone: contactPhone || undefined,
        contactWebsite: contactWebsite || undefined,
      };
      await api.clients.update(Number(id), { botConfig: botConfig as any });
      toast.success(t("bot_config_saved"));
    } catch (err) {
      toast.error(t("failed_save_bot_config"));
    } finally {
      setSaving(false);
    }
  };

  const toggleButton = (key: string) => {
    setMenuButtons((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setIcon = (key: string, icon: string) => {
    setButtonIcons((prev) => ({ ...prev, [key]: icon }));
  };

  const labelForKey = (key: string) => {
    const map: Record<string, string> = {
      products: t("btn_products"),
      services: t("btn_services"),
      order: t("btn_order"),
      contact: t("btn_contact"),
      language: t("btn_language"),
      aiChat: t("btn_ai_chat"),
      about: t("btn_about"),
      prices: t("btn_prices"),
    };
    return map[key] ?? key;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("bot_config_title")} />
        <FormSkeleton />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={t("bot_config_title")}
        description={t("bot_config_desc")}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Welcome Message */}
        <Card>
          <CardHeader>
            <CardTitle>{t("welcome_message")}</CardTitle>
            <CardDescription>{t("welcome_message_hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder={t("welcome_message_placeholder")}
              rows={4}
              className="font-mono text-sm resize-y bg-muted/30"
            />
          </CardContent>
        </Card>

        {/* Menu Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>{t("menu_buttons")}</CardTitle>
            <CardDescription>{t("menu_buttons_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {menuKeys.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{buttonIcons[key]}</span>
                  <span className="text-sm font-medium">
                    {labelForKey(key)}
                  </span>
                </div>
                <Switch
                  checked={menuButtons[key]}
                  onCheckedChange={() => toggleButton(key)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Button Icons */}
        <Card>
          <CardHeader>
            <CardTitle>{t("button_icons")}</CardTitle>
            <CardDescription>{t("button_icons_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {menuKeys.map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {labelForKey(key)}
                  </Label>
                  <Input
                    value={buttonIcons[key] ?? ""}
                    onChange={(e) => setIcon(key, e.target.value)}
                    className="text-center text-lg w-full"
                    maxLength={4}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t("contact_phone").replace(" Phone", "")} &{" "}
              {t("contact_website").replace(" Website", "")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("contact_phone")}</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder={t("contact_phone_placeholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("contact_website")}</Label>
                <Input
                  value={contactWebsite}
                  onChange={(e) => setContactWebsite(e.target.value)}
                  placeholder={t("contact_website_placeholder")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ?
              t("saving")
            : <>
                <Save className="w-4 h-4 mr-2" />
                {t("save")}
              </>
            }
          </Button>
        </div>
      </form>
    </div>
  );
}
