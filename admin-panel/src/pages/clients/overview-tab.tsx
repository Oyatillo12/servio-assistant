import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  MessageCircle,
  ShoppingCart,
  UserCheck,
  Flame,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { api, type DashboardStats } from "@/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/currency";
import type { ClientDetailContext } from "./client-detail-layout";

/**
 * Client-scoped "at a glance" view. First thing both SUPER_ADMIN (when
 * viewing a client) and CLIENT_ADMIN (on their one client) see.
 *
 * Keeps things boring on purpose: today's activity + a few recent rows.
 * No charts yet — real counters are more useful than fake trend lines
 * until we actually have trend data.
 */
export function OverviewTab() {
  const { client } = useOutletContext<ClientDetailContext>();
  const { t } = useTranslation();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.analytics
      .dashboard(client.id)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [client.id]);

  const isOrderBot = client.type === "order";
  const conversionLabel = isOrderBot ? t("orders") : t("leads");
  const conversionToday = isOrderBot
    ? stats?.ordersToday ?? 0
    : stats?.leadsToday ?? 0;
  const conversionTotal = isOrderBot
    ? stats?.totalOrders ?? 0
    : stats?.totalLeads ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          loading={loading}
          icon={MessageCircle}
          label={t("overview_conversations_today")}
          value={stats?.conversationsToday ?? 0}
          sub={t("overview_total_x", { n: stats?.totalConversations ?? 0 })}
          tone="blue"
        />
        <StatCard
          loading={loading}
          icon={TrendingUp}
          label={t("overview_messages_today")}
          value={stats?.messagesToday ?? 0}
          sub={t("overview_total_x", { n: stats?.totalMessages ?? 0 })}
          tone="slate"
        />
        <StatCard
          loading={loading}
          icon={isOrderBot ? ShoppingCart : UserCheck}
          label={t("overview_today_x", { label: conversionLabel })}
          value={conversionToday}
          sub={t("overview_total_x", { n: conversionTotal })}
          tone="green"
        />
        <StatCard
          loading={loading}
          icon={Flame}
          label={t("overview_hot_leads")}
          value={stats?.hotLeadsCount ?? 0}
          sub={t("overview_score_over_80")}
          tone="red"
          pulse={(stats?.hotLeadsCount ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isOrderBot ? (
          <RecentOrders stats={stats} loading={loading} currency={client.currency} />
        ) : (
          <RecentLeads stats={stats} loading={loading} />
        )}
        <RecentHot stats={stats} loading={loading} />
      </div>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────

const TONES = {
  blue: "bg-blue-500/10 text-blue-600",
  green: "bg-green-500/10 text-green-600",
  red: "bg-red-500/10 text-red-600",
  slate: "bg-muted text-muted-foreground",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  loading,
  pulse,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  sub?: string;
  tone: keyof typeof TONES;
  loading: boolean;
  pulse?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            {label}
          </span>
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center ${TONES[tone]} ${pulse ? "animate-pulse" : ""}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        )}
        {sub && !loading && (
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Recent rows ──────────────────────────────────────────────

function RecentOrders({
  stats,
  loading,
  currency,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  currency: string;
}) {
  const { t } = useTranslation();
  const orders = stats?.recentOrders ?? [];
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-3">{t("recent_orders")}</h3>
        {loading ? (
          <SkeletonRows />
        ) : orders.length === 0 ? (
          <EmptyRow label={t("no_orders")} />
        ) : (
          <ul className="divide-y">
            {orders.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    #{o.id} · {o.phone}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono">
                    {formatPrice(
                      o.items.reduce(
                        (s, i) =>
                          s + (i.price != null ? Number(i.price) * i.quantity : 0),
                        0,
                      ),
                      currency,
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    {o.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentLeads({
  stats,
  loading,
}: {
  stats: DashboardStats | null;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const leads = stats?.recentLeads ?? [];
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-3">{t("recent_leads")}</h3>
        {loading ? (
          <SkeletonRows />
        ) : leads.length === 0 ? (
          <EmptyRow label={t("no_leads")} />
        ) : (
          <ul className="divide-y">
            {leads.map((l) => (
              <li key={l.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{l.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {l.phone}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </div>
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    {l.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentHot({
  stats,
  loading,
}: {
  stats: DashboardStats | null;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const count = stats?.hotLeadsCount ?? 0;
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-red-500" />
          {t("overview_hot_leads")}
        </h3>
        {loading ? (
          <SkeletonRows />
        ) : count === 0 ? (
          <EmptyRow label={t("overview_no_hot_leads")} />
        ) : (
          <div className="text-sm text-muted-foreground">
            {t("overview_hot_leads_description", { n: count })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="text-sm text-muted-foreground py-4 text-center">{label}</div>
  );
}
