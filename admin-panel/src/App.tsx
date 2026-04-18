import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { useTranslation } from "react-i18next";

import { LoginPage } from "@/pages/auth/login-page";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { ClientsPage } from "@/pages/clients/clients-page";
import { ClientEditPage } from "@/pages/clients/client-edit-page";
import { ClientDetailLayout } from "@/pages/clients/client-detail-layout";
import { GeneralTab } from "@/pages/clients/general-tab";
import { ProductsPage } from "@/pages/clients/products-page";
import { ServicesPage } from "@/pages/clients/services-page";
import { BotConfigPage } from "@/pages/clients/bot-config-page";
import { ChatHistoryPage } from "@/pages/chat/chat-history-page";
import { OrdersPage } from "@/pages/orders/orders-page";
import { LeadsPage } from "@/pages/leads/leads-page";
import { UsersPage } from "@/pages/users/users-page";

export function App() {
  const { user, loading, isClientAdmin } = useAuth();
  const { t } = useTranslation();

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

        {/* Nested client-detail routes with tabbed layout */}
        <Route path="/clients/:id" element={<ClientDetailLayout />}>
          <Route index element={<GeneralTab />} />
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
