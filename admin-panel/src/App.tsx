import { useCallback, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { LoginPage } from "@/pages/auth/login-page";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { ClientsPage } from "@/pages/clients/clients-page";
import { ClientEditPage } from "@/pages/clients/client-edit-page";
import { ClientDetailLayout } from "@/pages/clients/client-detail-layout";
import { GeneralTab } from "@/pages/clients/general-tab";
import { OverviewTab } from "@/pages/clients/overview-tab";
import { ProductsPage } from "@/pages/clients/products-page";
import { ServicesPage } from "@/pages/clients/services-page";
import { BotConfigPage } from "@/pages/clients/bot-config-page";
import { ChatHistoryPage } from "@/pages/chat/chat-history-page";
import { LiveChatPage } from "@/pages/chat/live-chat-page";
import { OrdersPage } from "@/pages/orders/orders-page";
import { LeadsPage } from "@/pages/leads/leads-page";
import { UsersPage } from "@/pages/users/users-page";
import { useChatSocket, type HotLeadEvent } from "@/hooks/use-chat-socket";
import { api } from "@/api";

/** Play a short notification beep using the Web Audio API (no file needed). */
function playAlertBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // AudioContext not available (e.g. SSR) — silent fallback
  }
}

export function App() {
  const { user, loading, isClientAdmin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lastAlertRef = useRef(0);

  // Take over: navigate to live chat + disable AI
  const handleTakeOver = useCallback(
    async (chatId: number) => {
      try {
        await api.chats.toggleAi(chatId, false);
      } catch {
        // best-effort
      }
      navigate(`/live-chat?chatId=${chatId}`);
    },
    [navigate],
  );

  // Hot-lead toast — fires for all authenticated admins with sound + persistent alert
  useChatSocket({
    onHotLead: (ev: HotLeadEvent) => {
      // Debounce: max 1 alert per chat per 30 seconds
      const now = Date.now();
      if (now - lastAlertRef.current < 5000) return;
      lastAlertRef.current = now;

      playAlertBeep();

      const bantPreview = ev.bant
        ? Object.entries(ev.bant)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")
        : "";

      toast.error(
        `🔥 Hot Lead! Chat #${ev.chatId} — Score: ${ev.score} — Intent: ${ev.intent.toUpperCase()}${bantPreview ? `\n📋 ${bantPreview}` : ""}`,
        {
          duration: 30000,
          action: {
            label: `⚡ ${t("live_chat_take_over", { defaultValue: "Take Over" })}`,
            onClick: () => void handleTakeOver(ev.chatId),
          },
        },
      );
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">{t("loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const defaultRoute = isClientAdmin ? `/clients/${user.clientId}` : "/dashboard";

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/live-chat" element={<LiveChatPage />} />

        {/* Super admin only */}
        {!isClientAdmin && (
          <>
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/new" element={<ClientEditPage />} />
            <Route path="/users" element={<UsersPage />} />
          </>
        )}

        {/* Client admin guard */}
        {isClientAdmin && (
          <Route
            path="/clients"
            element={<Navigate to={`/clients/${user.clientId}`} replace />}
          />
        )}

        {/* Nested client-detail routes with tabbed layout.
            Overview is the default landing; General moved to /general. */}
        <Route path="/clients/:id" element={<ClientDetailLayout />}>
          <Route index element={<OverviewTab />} />
          <Route path="general" element={<GeneralTab />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="bot-config" element={<BotConfigPage />} />
          <Route path="chat" element={<ChatHistoryPage />} />
        </Route>

        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </AppLayout>
  );
}
