import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

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

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.clients
      .list()
      .then(setClients)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this client and all associated data?",
      )
    )
      return;
    try {
      await api.clients.remove(id);
      toast.success("Client deleted successfully");
      load();
    } catch {
      toast.error("Failed to delete client");
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Clients" />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="animate-page-enter">
      <PageHeader
        title="Clients"
        description="Manage all AI bot instances and their configuration."
        actions={
          <Button asChild>
            <Link to="/clients/new">
              <Plus className="w-4 h-4 mr-2" />
              New Client
            </Link>
          </Button>
        }
      />

      {clients.length === 0 ?
        <div className="text-center py-24 border-2 border-dashed rounded-xl bg-card">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <Bot size={32} />
          </div>
          <h3 className="text-lg font-medium mb-1">No clients yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Get started by creating your first AI bot client configuration.
          </p>
          <Button asChild>
            <Link to="/clients/new">Create Client</Link>
          </Button>
        </div>
      : <div className="rounded-xl border bg-card overflow-hidden">
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Client Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Products</TableHead>
                  <TableHead className="text-center">Services</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                          c.isActive ?
                            "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          : ""
                        }
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 ">
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
                          <TooltipContent>View Chats</TooltipContent>
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
                          <TooltipContent>Edit</TooltipContent>
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
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      }
    </div>
  );
}

// Need to import Bot here as it was missing from the empty state icon
import { Bot } from "lucide-react";
import { BOT_URL } from "@/config";
