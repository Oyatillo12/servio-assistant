import { useEffect, useState } from "react";
import { useParams, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Settings2,
  ShoppingBag,
  Wrench,
  ShoppingCart,
  UserCheck,
  Sliders,
  MessageSquare,
  QrCode,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { api, type Client } from "@/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsBar, type TabBarItem } from "@/components/ui/tabs-bar";
import { FormSkeleton } from "@/components/loading-skeleton";
import { BackButton } from "@/components/back-button";
import { BotShareDialog } from "@/components/bot-share-dialog";

export interface ClientDetailContext {
  client: Client;
  reload: () => void;
}

export function ClientDetailLayout() {
  const { id } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) return;
    api.clients
      .get(Number(id))
      .then(setClient)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <FormSkeleton />
      </div>
    );
  }

  if (!client) return null;

  const basePath = `/clients/${id}`;

  const tabs: TabBarItem[] = [
    {
      to: basePath,
      end: true,
      label: t("tab_overview"),
      icon: LayoutDashboard,
    },
    {
      to: `${basePath}/general`,
      label: t("tab_general"),
      icon: Settings2,
    },
  ];

  if (client.hasProducts) {
    tabs.push({
      to: `${basePath}/products`,
      label: t("nav_products"),
      icon: ShoppingBag,
    });
  }
  if (client.hasServices) {
    tabs.push({
      to: `${basePath}/services`,
      label: t("nav_services"),
      icon: Wrench,
    });
  }

  // Orders for order-type, Leads for lead-type
  if (client.type === "order") {
    tabs.push({
      to: `${basePath}/orders`,
      label: t("nav_orders"),
      icon: ShoppingCart,
    });
  } else {
    tabs.push({
      to: `${basePath}/leads`,
      label: t("nav_leads"),
      icon: UserCheck,
    });
  }

  tabs.push(
    {
      to: `${basePath}/bot-config`,
      label: t("tab_settings"),
      icon: Sliders,
    },
    {
      to: `${basePath}/chat`,
      label: t("tab_chat"),
      icon: MessageSquare,
    },
  );

  // Derive current tab for mobile label
  const current =
    [...tabs]
      .reverse()
      .find((t) =>
        t.end ? location.pathname === t.to : location.pathname.startsWith(t.to),
      ) ?? tabs[0];

  const typeBadge =
    client.type === "lead" ? (
      <Badge variant="outline" className="text-[10px]">
        {t("bot_type_lead")}
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px]">
        {t("bot_type_order")}
      </Badge>
    );

  return (
    <div className="animate-page-enter pb-12">
      {/* Header */}
      <div className="mb-4">
        <BackButton
          className="mb-3"
          fallbackTo={isSuperAdmin ? "/clients" : undefined}
          label={isSuperAdmin ? t("nav_clients") : undefined}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">
              {client.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground font-mono">
                {client.slug}
              </span>
              {typeBadge}
              {!client.isActive && (
                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                  {t("inactive")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="text-xs text-muted-foreground sm:hidden">
              {current?.icon && <current.icon className="inline w-3.5 h-3.5 mr-1" />}
              <span>{current?.label}</span>
            </div>
            <BotShareDialog slug={client.slug} clientName={client.name} botUsername={client.botUsername}>
              <Button variant="outline" size="sm" className="shrink-0">
                <QrCode className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t("share_bot")}</span>
              </Button>
            </BotShareDialog>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabsBar items={tabs} className="mb-6" />

      {/* Tab content */}
      <Outlet context={{ client, reload: load } satisfies ClientDetailContext} />
    </div>
  );
}
