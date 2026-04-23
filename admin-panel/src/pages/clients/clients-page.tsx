import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  ExternalLink,
  Bot,
  ShoppingCart,
  UserCheck,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { api, type Client } from "@/api";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOT_URL } from "@/config";

type Lang = "uz" | "ru" | "en";

export function ClientsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = () => {
    api.clients
      .list()
      .then(setClients)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    if (!confirm(t("delete_client_confirm"))) return;
    try {
      await api.clients.remove(id);
      toast.success(t("client_deleted"));
      load();
    } catch {
      toast.error(t("failed_delete"));
    }
  };

  const handleCreateDemo = async (type: "order" | "lead") => {
    setSeeding(true);
    try {
      const currentLang = (i18n.language as Lang) || "en";
      const lang: Lang = ["uz", "ru", "en"].includes(currentLang)
        ? currentLang
        : "en";
      const created = await api.clients.createDemo(type, lang);
      toast.success(t("demo_created", { name: created.name }));
      navigate(`/clients/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed_save"));
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("clients_title")} />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="animate-page-enter">
      <PageHeader
        title={t("clients_title")}
        description={t("clients_description")}
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={seeding}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t("create_demo")}
                  <ChevronDown className="w-3 h-3 ml-1.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleCreateDemo("order")}>
                  <ShoppingCart className="w-4 h-4 mr-2 text-violet-500" />
                  <div>
                    <p className="text-sm font-medium">{t("demo_restaurant")}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("demo_restaurant_hint")}
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateDemo("lead")}>
                  <UserCheck className="w-4 h-4 mr-2 text-pink-500" />
                  <div>
                    <p className="text-sm font-medium">{t("demo_clinic")}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("demo_clinic_hint")}
                    </p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <Link to="/clients/new">
                <Plus className="w-4 h-4 mr-2" />
                {t("new_client")}
              </Link>
            </Button>
          </div>
        }
      />

      {clients.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed rounded-xl bg-card">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <Bot size={32} />
          </div>
          <h3 className="text-lg font-medium mb-1">{t("no_clients")}</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {t("no_clients_desc")}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleCreateDemo("order")}
              disabled={seeding}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t("try_demo")}
            </Button>
            <Button asChild>
              <Link to="/clients/new">{t("create_client")}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <TooltipProvider delayDuration={200}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>{t("client_name_col")}</TableHead>
                    <TableHead>{t("bot_type")}</TableHead>
                    <TableHead>{t("slug")}</TableHead>
                    <TableHead className="text-center">
                      {t("products_count")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("services_count")}
                    </TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.id} className="group">
                      <TableCell className="font-medium">
                        <Link
                          to={`/clients/${c.id}`}
                          className="hover:text-primary hover:underline transition-colors"
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {c.type === "lead" ? (
                          <Badge
                            variant="outline"
                            className="bg-pink-500/10 text-pink-600 border-pink-200"
                          >
                            <UserCheck className="w-3 h-3 mr-1" />
                            {t("bot_type_lead_short")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-violet-500/10 text-violet-600 border-violet-200"
                          >
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            {t("bot_type_order_short")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-mono bg-muted/50 px-2 py-1 rounded w-fit text-muted-foreground">
                          {c.slug}
                          <a
                            href={`${BOT_URL}?start=${c.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">
                        {c.products?.length || 0}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">
                        {c.services?.length || 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.isActive ? "default" : "secondary"}
                          className={
                            c.isActive
                              ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                              : ""
                          }
                        >
                          {c.isActive ? t("active") : t("inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                asChild
                              >
                                <Link to={`/clients/${c.id}/chat`}>
                                  <MessageSquare className="w-4 h-4" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("view_chats")}</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                asChild
                              >
                                <Link to={`/clients/${c.id}`}>
                                  <Pencil className="w-4 h-4" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("edit")}</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(c.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("delete")}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
