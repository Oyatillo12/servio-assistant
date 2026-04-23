import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bot,
  CircleDot,
  MessageCircle,
  Send,
  User,
  Wifi,
  WifiOff,
  Zap,
  Search,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flame,
  Filter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api, type ChatMessage, type LiveSession } from "@/api";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useChatSocket,
  type ChatMessageEvent,
  type AiToggledEvent,
  type ScoreUpdatedEvent,
} from "@/hooks/use-chat-socket";

// ── Helpers ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  cold: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  warm: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  hot: "bg-red-500/15 text-red-600 border-red-500/30",
  closed: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
};

const STATUS_DOT: Record<string, string> = {
  cold: "bg-blue-500",
  warm: "bg-amber-500",
  hot: "bg-red-500",
  closed: "bg-zinc-400",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-red-500";
  if (score >= 40) return "text-amber-500";
  return "text-blue-500";
};

const SCORE_BAR_BG = (score: number) => {
  if (score >= 80) return "bg-red-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-blue-500";
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── BANT Display Component ────────────────────────────────

function BantPanel({
  metadata,
  score,
  intent,
  leadStatus,
}: {
  metadata: Record<string, unknown> | null;
  score: number;
  intent?: string;
  leadStatus: string;
}) {
  const bantFields = [
    { key: "budget", label: "Budget", icon: "💰" },
    { key: "authority", label: "Authority", icon: "👤" },
    { key: "need", label: "Need", icon: "🎯" },
    { key: "timeline", label: "Timeline", icon: "📅" },
  ];

  return (
    <div className="space-y-3">
      {/* Score bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Lead Score</span>
          <span className={`font-bold tabular-nums ${SCORE_COLOR(score)}`}>
            {score}/100
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${SCORE_BAR_BG(score)}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      </div>

      {/* Status + Intent */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[leadStatus] ?? STATUS_COLORS.cold}`}
        >
          {leadStatus.toUpperCase()}
        </Badge>
        {intent && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Intent: {intent}
          </Badge>
        )}
      </div>

      {/* BANT pills */}
      <div className="grid grid-cols-2 gap-1.5">
        {bantFields.map(({ key, label, icon }) => {
          const value = metadata?.[key];
          const hasValue = value !== undefined && value !== null && value !== "";
          return (
            <div
              key={key}
              className={`px-2 py-1.5 rounded-md text-[11px] border transition-colors ${
                hasValue
                  ? "bg-primary/5 border-primary/20 text-foreground"
                  : "bg-muted/30 border-transparent text-muted-foreground"
              }`}
            >
              <span className="mr-1">{icon}</span>
              <span className="font-medium">{label}:</span>{" "}
              <span className="truncate">
                {hasValue ? String(value) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      {metadata?.notes != null && String(metadata.notes) !== "" && (
        <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-md px-2 py-1.5 border border-transparent">
          📝 {String(metadata.notes)}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export function LiveChatPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(
    searchParams.get("chatId") ? Number(searchParams.get("chatId")) : null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showBant, setShowBant] = useState(true);
  const [hotOnly, setHotOnly] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Load sessions ────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.chats.list();
      setSessions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // ── Load messages when session selected ──────────────────

  useEffect(() => {
    if (selectedChatId == null) return;
    setMsgsLoading(true);
    api.chats
      .messages(selectedChatId)
      .then(setMessages)
      .finally(() => setMsgsLoading(false));
  }, [selectedChatId]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ── WebSocket ────────────────────────────────────────────

  const handleWsMessage = useCallback(
    (ev: ChatMessageEvent) => {
      // Update session list timestamp
      setSessions((prev) =>
        prev
          .map((s) =>
            s.chatId === ev.chatId
              ? { ...s, lastMessageAt: ev.at }
              : s,
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt).getTime() -
              new Date(a.lastMessageAt).getTime(),
          ),
      );

      // Append to messages if viewing this chat
      if (ev.chatId === selectedChatId) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            chatId: ev.chatId,
            clientId: ev.clientId,
            role: ev.role,
            message: ev.message,
            createdAt: ev.at,
          },
        ]);
      }
    },
    [selectedChatId],
  );

  const handleWsToggle = useCallback((ev: AiToggledEvent) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.chatId === ev.chatId ? { ...s, isAiActive: ev.isAiActive } : s,
      ),
    );
  }, []);

  /** Live score/BANT updates from the AI pipeline */
  const handleWsScoreUpdated = useCallback((ev: ScoreUpdatedEvent) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.chatId === ev.chatId
          ? {
              ...s,
              score: ev.score,
              leadStatus: ev.leadStatus,
              metadata: ev.bant,
            }
          : s,
      ),
    );
  }, []);

  const { connected } = useChatSocket({
    onMessage: handleWsMessage,
    onAiToggled: handleWsToggle,
    onScoreUpdated: handleWsScoreUpdated,
  });

  // ── Actions ──────────────────────────────────────────────

  const selectedSession = sessions.find((s) => s.chatId === selectedChatId);

  const handleToggleAi = async () => {
    if (!selectedSession) return;
    try {
      await api.chats.toggleAi(
        selectedSession.chatId,
        !selectedSession.isAiActive,
      );
      // Optimistic update (WS will confirm)
      setSessions((prev) =>
        prev.map((s) =>
          s.chatId === selectedSession.chatId
            ? { ...s, isAiActive: !s.isAiActive }
            : s,
        ),
      );
    } catch {
      toast.error(t("live_chat_toggle_failed"));
    }
  };

  const handleSend = async () => {
    if (!selectedSession || !text.trim()) return;
    setSending(true);
    try {
      await api.chats.sendMessage(selectedSession.chatId, text.trim());
      setText("");
    } catch {
      toast.error(t("live_chat_send_failed"));
    } finally {
      setSending(false);
    }
  };

  const handleSelectChat = (chatId: number) => {
    setSelectedChatId(chatId);
    setSearchParams({ chatId: String(chatId) });
  };

  // ── Filter & Sort ─────────────────────────────────────────

  const filtered = sessions
    .filter((s) => {
      if (hotOnly && s.leadStatus !== "hot") return false;
      if (search === "") return true;
      return (
        String(s.chatId).includes(search) ||
        s.leadStatus.includes(search.toLowerCase())
      );
    })
    .sort((a, b) => {
      // Hot leads always sorted first
      const aHot = a.leadStatus === "hot" ? 1 : 0;
      const bHot = b.leadStatus === "hot" ? 1 : 0;
      if (aHot !== bHot) return bHot - aHot;
      // Then by score (higher first)
      if (a.score !== b.score) return b.score - a.score;
      // Then by most-recent activity
      return (
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
      );
    });

  // ── Mobile: if a chat is selected, show only the detail ───

  const showList = isMobile ? selectedChatId == null : true;
  const showDetail = isMobile ? selectedChatId != null : true;

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="animate-page-enter h-[calc(100vh-4rem)]">
      <PageHeader
        title={t("live_chat_title")}
        description={t("live_chat_desc")}
        actions={
          <Badge
            variant="outline"
            className={`gap-1.5 text-xs px-2.5 py-1 ${connected ? "text-emerald-600 border-emerald-500/40" : "text-muted-foreground"}`}
          >
            {connected ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {connected ? "Live" : "Offline"}
          </Badge>
        }
      />

      <div className="flex gap-4 h-[calc(100%-5rem)]">
        {/* ── Left: Session list ────────────────────────── */}
        {showList && (
          <Card className="w-full md:w-80 lg:w-96 shrink-0 flex flex-col overflow-hidden">
            {/* Search + Filter */}
            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="live-chat-search"
                  placeholder={t("live_chat_search")}
                  className="pl-9 h-9 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                id="hot-filter-toggle"
                variant={hotOnly ? "default" : "outline"}
                size="sm"
                className="w-full h-7 text-xs gap-1.5"
                onClick={() => setHotOnly(!hotOnly)}
              >
                <Flame className={`w-3 h-3 ${hotOnly ? "text-white" : "text-red-500"}`} />
                {hotOnly ? "Showing Hot Only" : "Show Hot Only"}
                <Filter className="w-3 h-3 ml-auto" />
              </Button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
                  <MessageCircle className="w-10 h-10 opacity-30" />
                  <p className="text-sm text-center">
                    {t("live_chat_no_sessions")}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filtered.map((s) => {
                    const active = s.chatId === selectedChatId;
                    const isHot = s.leadStatus === "hot";
                    return (
                      <button
                        key={s.chatId}
                        id={`session-${s.chatId}`}
                        onClick={() => handleSelectChat(s.chatId)}
                        className={`
                          w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150
                          hover:bg-accent/60 group cursor-pointer
                          ${active ? "bg-accent ring-1 ring-primary/20" : ""}
                          ${isHot ? "border-l-2 border-l-red-500" : ""}
                        `}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${STATUS_DOT[s.leadStatus] ?? STATUS_DOT.cold} ${isHot ? "animate-pulse" : ""}`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                Chat #{s.chatId}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {timeAgo(s.lastMessageAt)}
                                {!s.isAiActive && (
                                  <span className="ml-1.5 text-amber-600 font-medium">
                                    • {t("live_chat_ai_off")}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[s.leadStatus] ?? STATUS_COLORS.cold}`}
                            >
                              {t(`lead_status_${s.leadStatus}`)}
                            </Badge>
                            {s.score > 0 && (
                              <span className={`text-[10px] font-mono font-bold ${SCORE_COLOR(s.score)}`}>
                                ⚡ {s.score}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Right: Chat detail ────────────────────────── */}
        {showDetail && (
          <Card className="flex-1 flex flex-col overflow-hidden min-w-0">
            {selectedSession ? (
              <>
                {/* Header */}
                <div className="px-4 py-3 border-b shrink-0 bg-card/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {isMobile && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 -ml-1"
                          onClick={() => {
                            setSelectedChatId(null);
                            setSearchParams({});
                          }}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </Button>
                      )}
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          Chat #{selectedSession.chatId}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[selectedSession.leadStatus]}`}
                          >
                            {t(`lead_status_${selectedSession.leadStatus}`)}
                          </Badge>
                          {selectedSession.score > 0 && (
                            <span className={`text-[11px] font-mono font-bold flex items-center gap-1 ${SCORE_COLOR(selectedSession.score)}`}>
                              <Zap className="w-3 h-3" />
                              {selectedSession.score}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* BANT toggle */}
                      <Button
                        id="bant-toggle"
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1 h-7 hidden sm:flex"
                        onClick={() => setShowBant(!showBant)}
                      >
                        {showBant ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        BANT
                      </Button>

                      {/* AI toggle */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {selectedSession.isAiActive
                            ? t("live_chat_ai_on")
                            : t("live_chat_ai_off")}
                        </span>
                        <Switch
                          id="ai-toggle"
                          checked={selectedSession.isAiActive}
                          onCheckedChange={() => void handleToggleAi()}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hot lead take-over banner */}
                  {selectedSession.isAiActive && selectedSession.score > 80 && (
                    <div className="mt-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-600">
                      <Flame className="w-4 h-4 shrink-0 animate-pulse" />
                      <span className="flex-1 font-medium">
                        🔥 AI is handling this hot lead — Click to take over manually
                      </span>
                      <Button
                        id="take-over-btn"
                        size="sm"
                        variant="destructive"
                        className="h-6 text-[11px] px-2"
                        onClick={() => void handleToggleAi()}
                      >
                        Take Over
                      </Button>
                    </div>
                  )}

                  {/* BANT Panel (collapsible) */}
                  {showBant && (
                    <div className="mt-3 pt-3 border-t">
                      <BantPanel
                        metadata={selectedSession.metadata}
                        score={selectedSession.score}
                        leadStatus={selectedSession.leadStatus}
                      />
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
                >
                  {msgsLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}
                        >
                          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                          <Skeleton className="h-16 w-[60%] rounded-2xl" />
                        </div>
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                      <MessageCircle className="w-10 h-10 opacity-20" />
                      <p className="text-sm">{t("no_messages")}</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isBot = m.role === "assistant";
                      // Hide synthetic start messages from display
                      if (
                        m.role === "user" &&
                        m.message.startsWith("[User just opened")
                      ) {
                        return null;
                      }
                      return (
                        <div
                          key={m.id}
                          className={`flex gap-3 w-full ${!isBot ? "flex-row-reverse" : ""}`}
                        >
                          <div
                            className={`flex shrink-0 items-center justify-center w-8 h-8 rounded-full ${
                              isBot
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isBot ? (
                              <Bot size={14} />
                            ) : (
                              <User size={14} />
                            )}
                          </div>
                          <div
                            className={`flex flex-col ${!isBot ? "items-end" : "items-start"} max-w-[75%]`}
                          >
                            <div
                              className={`
                                px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed
                                ${isBot ? "bg-muted/50 rounded-tl-none" : "bg-primary text-primary-foreground rounded-tr-none"}
                              `}
                            >
                              {m.message}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-1 px-1">
                              {new Date(m.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input */}
                <div className="p-3 border-t bg-card/80 backdrop-blur-sm shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      id="live-chat-input"
                      placeholder={t("live_chat_send_placeholder")}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={sending}
                      className="flex-1"
                      autoComplete="off"
                    />
                    <Button
                      id="live-chat-send"
                      type="submit"
                      size="icon"
                      disabled={!text.trim() || sending}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              /* Empty detail */
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center">
                  <CircleDot className="w-8 h-8 opacity-30" />
                </div>
                <p className="text-sm">{t("live_chat_select")}</p>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
