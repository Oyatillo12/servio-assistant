import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import {
  UserCheck,
  Clock,
  Phone,
  CheckCircle,
  QrCode,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { api, type LeadData } from "@/api";
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
import { BotShareDialog } from "@/components/bot-share-dialog";
import type { ClientDetailContext } from "../clients/client-detail-layout";

const statusConfig = {
  new: { icon: Clock, color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "New" },
  contacted: { icon: Phone, color: "bg-yellow-500/10 text-yellow-600 border-yellow-200", label: "Contacted" },
  closed: { icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-200", label: "Closed" },
} as const;

export function LeadsPage() {
  const { id } = useParams();
  const clientId = Number(id);
  const { t } = useTranslation();
  const { client } = useOutletContext<ClientDetailContext>();

  const [leads, setLeads] = useState<LeadData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.leads
      .byClient(clientId)
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [clientId]);

  const updateStatus = async (leadId: number, status: string) => {
    await api.leads.updateStatus(leadId, status);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status } : l))
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("leads_title")}
        description={t("leads_desc")}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 font-mono text-sm">
              {leads.length} {t("leads_total")}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={leads.length === 0}
              onClick={() =>
                api.leads
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
          ) : leads.length === 0 ? (
            <div className="text-center py-16 sm:py-24 px-6 text-muted-foreground">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/5 text-primary/50 mb-4">
                <UserCheck size={32} />
              </div>
              <p className="font-medium text-foreground">{t("no_leads")}</p>
              <p className="text-sm mt-1 max-w-md mx-auto">
                {t("no_leads_hint")}
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
                {leads.map((lead) => {
                  const cfg = statusConfig[lead.status as keyof typeof statusConfig] ?? statusConfig.new;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={lead.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-muted-foreground">
                            #{lead.id} · {new Date(lead.createdAt).toLocaleDateString()}
                          </div>
                          <div className="font-medium mt-0.5 truncate">{lead.name}</div>
                          <div className="font-mono text-sm text-muted-foreground mt-0.5">
                            {lead.phone}
                          </div>
                        </div>
                        <Badge variant="outline" className={cfg.color}>
                          <StatusIcon className="w-3.5 h-3.5 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>
                      {lead.notes && (
                        <p className="text-sm text-muted-foreground">{lead.notes}</p>
                      )}
                      {lead.status === "new" && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            variant="outline"
                            className="text-yellow-600 hover:text-yellow-700 h-10"
                            onClick={() => updateStatus(lead.id, "contacted")}
                          >
                            <Phone className="w-4 h-4 mr-1.5" />
                            {t("leads_contacted")}
                          </Button>
                          <Button
                            variant="outline"
                            className="text-green-600 hover:text-green-700 h-10"
                            onClick={() => updateStatus(lead.id, "closed")}
                          >
                            <CheckCircle className="w-4 h-4 mr-1.5" />
                            {t("leads_closed")}
                          </Button>
                        </div>
                      )}
                      {lead.status === "contacted" && (
                        <Button
                          variant="outline"
                          className="w-full text-green-600 hover:text-green-700 h-10"
                          onClick={() => updateStatus(lead.id, "closed")}
                        >
                          <CheckCircle className="w-4 h-4 mr-1.5" />
                          {t("leads_closed")}
                        </Button>
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
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("leads_phone")}</TableHead>
                      <TableHead>{t("leads_notes")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("leads_date")}</TableHead>
                      <TableHead className="text-right">{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => {
                      const cfg = statusConfig[lead.status as keyof typeof statusConfig] ?? statusConfig.new;
                      const StatusIcon = cfg.icon;

                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="font-mono text-muted-foreground">
                            {lead.id}
                          </TableCell>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {lead.phone}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-50 truncate">
                            {lead.notes || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cfg.color}>
                              <StatusIcon className="w-3.5 h-3.5 mr-1" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {lead.status === "new" && (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-yellow-600 hover:text-yellow-700"
                                  onClick={() => updateStatus(lead.id, "contacted")}
                                >
                                  <Phone className="w-3.5 h-3.5 mr-1" />
                                  {t("leads_contacted")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => updateStatus(lead.id, "closed")}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                  {t("leads_closed")}
                                </Button>
                              </div>
                            )}
                            {lead.status === "contacted" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => updateStatus(lead.id, "closed")}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                {t("leads_closed")}
                              </Button>
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
