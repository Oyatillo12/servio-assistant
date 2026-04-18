import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShoppingCart, Package, Clock, CheckCircle, XCircle } from "lucide-react";
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
import { useTranslation } from "react-i18next";

const statusConfig = {
  pending: { icon: Clock, color: "bg-yellow-500/10 text-yellow-600 border-yellow-200", label: "Pending" },
  confirmed: { icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-200", label: "Confirmed" },
  cancelled: { icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-200", label: "Cancelled" },
} as const;

export function OrdersPage() {
  const { id } = useParams();
  const clientId = Number(id);
  const { t } = useTranslation();

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
          <Badge variant="outline" className="px-3 py-1 font-mono text-sm">
            {orders.length} {t("orders_total")}
          </Badge>
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
            <div className="text-center py-24 text-muted-foreground">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/5 text-primary/50 mb-4">
                <ShoppingCart size={32} />
              </div>
              <p>{t("no_orders")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                                <span className="text-muted-foreground">${item.price}</span>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
