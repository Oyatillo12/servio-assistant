import { useState } from "react";
import { Bot, CheckCircle2, Unplug, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { api, type Client } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  client: Client;
  onUpdated: () => void;
}

export function BotTokenSection({ client, onUpdated }: Props) {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.clients.update(client.id, { botToken: trimmed });
      toast.success(t("dedicated_bot_connected"));
      setToken("");
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dedicated_bot_failed"));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(t("dedicated_bot_disconnect_confirm"))) return;
    setBusy(true);
    try {
      await api.clients.update(client.id, { botToken: null });
      toast.success(t("dedicated_bot_disconnected"));
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed_save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="w-5 h-5 text-primary" />
          {t("dedicated_bot_title")}
        </CardTitle>
        <CardDescription>{t("dedicated_bot_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {client.botUsername ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-green-500/5 border-green-500/20">
            <div className="flex items-start gap-3 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {t("dedicated_bot_active")}
                </div>
                <a
                  href={`https://t.me/${client.botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-sm mt-0.5"
                >
                  <LinkIcon className="w-3 h-3" />@{client.botUsername}
                </a>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={disconnect}
              disabled={busy}
              className="text-destructive hover:text-destructive"
            >
              <Unplug className="w-4 h-4 mr-2" />
              {t("disconnect")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-4 border rounded-lg bg-muted/20 text-sm space-y-1">
              <div className="font-medium">{t("dedicated_bot_general_active")}</div>
              <p className="text-muted-foreground text-xs">
                {t("dedicated_bot_general_hint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot-token">{t("bot_token")}</Label>
              <Input
                id="bot-token"
                type="password"
                autoComplete="off"
                placeholder="123456:ABC-DEF..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("bot_token_hint")}
              </p>
            </div>
            <Button onClick={connect} disabled={busy || !token.trim()}>
              <Bot className="w-4 h-4 mr-2" />
              {busy ? t("dedicated_bot_connecting") : t("dedicated_bot_connect")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
