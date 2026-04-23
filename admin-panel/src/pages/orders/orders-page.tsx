import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  QrCode,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { api, type OrderData } from "@/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/currency";
import { BotShareDialog } from "@/components/bot-share-dialog";
import type { ClientDetailContext } from "../clients/client-detail-layout";

const statusConfig = {
  pending: { icon: Clock, color: "bg-yellow-500/10 text-yellow-600 border-yellow-200", label: "Pending" },
  confirmed: { icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-200", label: "Confirmed" },
  cancelled: { icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-200", label: "Cancelled" },
} as const;

export function OrdersPage() {
  const { id } = useParams();
  const clientId = Number(id);
  const { t } = useTranslation();
  const { client } = useOutletContext<ClientDetailContext>();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.orders
      .byClient(clientId)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [clientId]);

  const updateStatus = async (orderId: number, status: string) => {
    await api.orders.updateStatus(orderId, status);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("orders_title")}
        description={t("orders_desc")}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 font-mono text-sm">
              {orders.length} {t("orders_total")}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={orders.length === 0}
              onClick={() =>
                api.orders
                  .exportCsv(clientId)
                  .catch((e: unknown) =>
                    toast.error(e instanceof Error ? e.message : t("failed_save")),
                  )
              }
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("export_csv")}</span>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 sm:py-24 px-6 text-muted-foreground">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/5 text-primary/50 mb-4">
                <ShoppingCart size={32} />
              </div>
              <p className="font-medium text-foreground">{t("no_orders")}</p>
              <p className="text-sm mt-1 max-w-md mx-auto">
                {t("no_orders_hint")}
              </p>
              <BotShareDialog slug={client.slug} clientName={client.name} botUsername={client.botUsername}>
                <Button variant="outline" className="mt-4">
                  <QrCode className="w-4 h-4 mr-2" />
                  {t("share_bot")}
                </Button>
              </BotShareDialog>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="md:hidden divide-y">
                {orders.map((order) => {
                  const cfg = statusConfig[order.status as keyof typeof statusConfig] ?? statusConfig.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={order.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-muted-foreground">
                            #{order.id} · {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                          <div className="font-mono text-sm mt-0.5">{order.phone}</div>
                          {order.address && (
                            <div className="text-xs text-muted-foreground mt-0.5">{order.address}</div>
                          )}
                        </div>
                        <Badge variant="outline" className={cfg.color}>
                          <StatusIcon className="w-3.5 h-3.5 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{item.productName}</span>
                            <span className="text-muted-foreground shrink-0">x{item.quantity}</span>
                            {item.price != null && (
                              <span className="text-muted-foreground ml-auto shrink-0">
                                {formatPrice(item.price, client.currency)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {order.status === "pending" && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            variant="outline"
                            className="text-green-600 hover:text-green-700 h-10"
                            onClick={() => updateStatus(order.id, "confirmed")}
                          >
                            <CheckCircle className="w-4 h-4 mr-1.5" />
                            {t("orders_confirm")}
                          </Button>
                          <Button
                            variant="outline"
                            className="text-red-600 hover:text-red-700 h-10"
                            onClick={() => updateStatus(order.id, "cancelled")}
                          >
                            <XCircle className="w-4 h-4 mr-1.5" />
                            {t("cancel")}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>{t("orders_items")}</TableHead>
                      <TableHead>{t("orders_phone")}</TableHead>
                      <TableHead>{t("orders_address")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("orders_date")}</TableHead>
                      <TableHead className="text-right">{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const cfg = statusConfig[order.status as keyof typeof statusConfig] ?? statusConfig.pending;
                      const StatusIcon = cfg.icon;

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-muted-foreground">
                            {order.id}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {order.items.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="font-medium">{item.productName}</span>
                                  <span className="text-muted-foreground">x{item.quantity}</span>
                                  {item.price != null && (
                                    <span className="text-muted-foreground">
                                      {formatPrice(item.price, client.currency)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {order.phone}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {order.address || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cfg.color}>
                              <StatusIcon className="w-3.5 h-3.5 mr-1" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {order.status === "pending" && (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => updateStatus(order.id, "confirmed")}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                  {t("orders_confirm")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => updateStatus(order.id, "cancelled")}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  {t("cancel")}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
