import { useEffect, useState } from "react";
import { Brain, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { api, type Client } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AI_MODELS,
  DEFAULT_MODELS,
  PROVIDER_LABELS,
  type AiProviderType,
} from "@/lib/ai-providers";

interface Props {
  client: Client;
  onUpdated: () => void;
}

export function AiProviderSection({ client, onUpdated }: Props) {
  const { t } = useTranslation();

  const [provider, setProvider] = useState<AiProviderType>(
    client.aiProvider ?? "gemini",
  );
  const [model, setModel] = useState<string>(
    client.aiModel ?? DEFAULT_MODELS[client.aiProvider ?? "gemini"],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProvider(client.aiProvider ?? "gemini");
    setModel(client.aiModel ?? DEFAULT_MODELS[client.aiProvider ?? "gemini"]);
  }, [client]);

  const onProviderChange = (next: AiProviderType) => {
    setProvider(next);
    // Reset model to the provider's default when the provider changes,
    // so we never leave an incompatible model selected.
    setModel(DEFAULT_MODELS[next]);
  };

  const dirty = provider !== client.aiProvider || model !== client.aiModel;

  const save = async () => {
    setSaving(true);
    try {
      await api.clients.update(client.id, {
        aiProvider: provider,
        aiModel: model,
      });
      toast.success(t("ai_provider_saved"));
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed_save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-primary" />
          {t("ai_provider_title")}
        </CardTitle>
        <CardDescription>{t("ai_provider_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">{t("ai_provider")}</Label>
            <select
              id="ai-provider"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as AiProviderType)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {(Object.keys(AI_MODELS) as AiProviderType[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {t("ai_provider_hint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-model">{t("ai_model")}</Label>
            <select
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            >
              {AI_MODELS[provider].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {t("ai_model_hint")}
            </p>
          </div>
        </div>

        <Button onClick={save} disabled={saving || !dirty}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? t("saving") : t("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
