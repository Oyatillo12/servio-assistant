import { useEffect, useState } from "react";
import { Users, Bot, MessageSquare, Zap, ShoppingCart, UserCheck, Clock, CheckCircle, XCircle, Phone } from "lucide-react";
import { api, type DashboardStats } from "@/api";
import { PageHeader } from "@/components/page-header";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { StatCard } from "./stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const orderStatusConfig = {
  pending: { icon: Clock, color: "bg-yellow-500/10 text-yellow-600 border-yellow-200", label: "Pending" },
  confirmed: { icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-200", label: "Confirmed" },
  cancelled: { icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-200", label: "Cancelled" },
} as const;

const leadStatusConfig = {
  new: { icon: Clock, color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "New" },
  contacted: { icon: Phone, color: "bg-yellow-500/10 text-yellow-600 border-yellow-200", label: "Contacted" },
  closed: { icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-200", label: "Closed" },
} as const;


export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.analytics.dashboard().then(setStats);
  }, []);

  if (!stats) return <DashboardSkeleton />;

  return (
    <div className="animate-page-enter">
      <PageHeader
        title="Dashboard"
        description="Overview of your platform's performance and activity."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="animate-fade-up" style={{ animationDelay: "0.0s" }}>
          <StatCard
            title="Total Clients"
            value={stats.totalClients.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
            iconClassName="bg-blue-500/10 text-blue-500"
          />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <StatCard
            title="Total Messages"
            value={stats.totalMessages.toLocaleString()}
            icon={<MessageSquare className="w-5 h-5" />}
            iconClassName="bg-emerald-500/10 text-emerald-500"
          />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <StatCard
            title="Messages Today"
            value={stats.messagesToday.toLocaleString()}
            icon={<Zap className="w-5 h-5" />}
            iconClassName="bg-orange-500/10 text-orange-500"
          />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <StatCard
            title="Total Orders"
            value={stats.totalOrders.toLocaleString()}
            icon={<ShoppingCart className="w-5 h-5" />}
            iconClassName="bg-violet-500/10 text-violet-500"
          />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "0.4s" }}>
          <StatCard
            title="Total Leads"
            value={stats.totalLeads.toLocaleString()}
            icon={<UserCheck className="w-5 h-5" />}
            iconClassName="bg-pink-500/10 text-pink-500"
          />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "0.5s" }}>
          <StatCard
            title="Conversations"
            value={stats.totalConversations.toLocaleString()}
            icon={<Bot className="w-5 h-5" />}
            iconClassName="bg-cyan-500/10 text-cyan-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-up" style={{ animationDelay: "0.6s" }}>
        
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-violet-500" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats.recentOrders || stats.recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                No recent orders.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Items</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentOrders.map((order) => {
                      const cfg = orderStatusConfig[order.status as keyof typeof orderStatusConfig] ?? orderStatusConfig.pending;
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium text-sm">
                            {order.items?.map(i => `${i.productName} (x${i.quantity})`).join(', ') || 'No items'}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">
                            {order.phone}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={cfg.color}>
                              {cfg.label}
                            </Badge>
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

        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-pink-500" />
              Recent Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats.recentLeads || stats.recentLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                No recent leads.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentLeads.map((lead) => {
                      const cfg = leadStatusConfig[lead.status as keyof typeof leadStatusConfig] ?? leadStatusConfig.new;
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium text-sm">
                            {lead.name}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">
                            {lead.phone}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={cfg.color}>
                              {cfg.label}
                            </Badge>
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

      {/* Activity Table */}
      <div className="mt-8 animate-fade-up" style={{ animationDelay: "0.7s" }}>
        <Card>
          <CardHeader>
            <CardTitle>Activity by Client</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ?
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                No activity recorded yet.
              </div>
            : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead className="text-right">Messages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentActivity.map((activity) => (
                    <TableRow key={activity.clientId}>
                      <TableCell className="font-medium">
                        {activity.clientName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {activity.messageCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
