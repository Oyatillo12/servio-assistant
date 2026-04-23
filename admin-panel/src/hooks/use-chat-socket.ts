import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/hooks/use-auth";

// VITE_API_URL usually ends in `/api` for HTTP calls; socket.io lives at the
// server root, so strip any trailing `/api` before appending the namespace.
const WS_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/api\/?$/, "");

/** Payload broadcast when a Telegram user or admin sends a message. */
export interface ChatMessageEvent {
  chatId: number;
  clientId: number;
  role: "user" | "assistant";
  message: string;
  at: string;
}

/** Payload broadcast when AI mode is toggled for a chat. */
export interface AiToggledEvent {
  chatId: number;
  clientId: number;
  isAiActive: boolean;
}

/** Payload broadcast when the AI scores a lead above the hot threshold. */
export interface HotLeadEvent {
  chatId: number;
  clientId: number;
  score: number;
  intent: string;
  bant: Record<string, unknown>;
  reply: string;
}

/** Payload broadcast on every score/BANT update from the AI. */
export interface ScoreUpdatedEvent {
  chatId: number;
  clientId: number;
  score: number;
  leadStatus: "cold" | "warm" | "hot" | "closed";
  intent: string;
  bant: Record<string, unknown>;
}

export interface UseChatSocketOptions {
  onMessage?: (event: ChatMessageEvent) => void;
  onAiToggled?: (event: AiToggledEvent) => void;
  onHotLead?: (event: HotLeadEvent) => void;
  onScoreUpdated?: (event: ScoreUpdatedEvent) => void;
}

/**
 * Connect to the backend WebSocket at `/ws/chat`.
 *
 * - Authenticates with the JWT from localStorage.
 * - Subscribes to `chat_message`, `chat_ai_toggled`, `new_hot_lead`, `lead_score_updated`.
 * - Auto-reconnects on disconnect.
 * - Re-creates the socket when the user logs in / logs out.
 * - Cleans up on unmount.
 */
export function useChatSocket(opts: UseChatSocketOptions = {}) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Stable refs for callbacks so socket listeners don't stale-close over old closures
  const onMsg = useRef(opts.onMessage);
  const onToggle = useRef(opts.onAiToggled);
  const onHot = useRef(opts.onHotLead);
  const onScore = useRef(opts.onScoreUpdated);
  onMsg.current = opts.onMessage;
  onToggle.current = opts.onAiToggled;
  onHot.current = opts.onHotLead;
  onScore.current = opts.onScoreUpdated;

  // Re-run when user changes (login/logout) to create/destroy the socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !user) {
      setConnected(false);
      return;
    }

    const socket = io(`${WS_URL}/ws/chat`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("chat_message", (data: ChatMessageEvent) => {
      onMsg.current?.(data);
    });

    socket.on("chat_ai_toggled", (data: AiToggledEvent) => {
      onToggle.current?.(data);
    });

    socket.on("new_hot_lead", (data: HotLeadEvent) => {
      onHot.current?.(data);
    });

    socket.on("lead_score_updated", (data: ScoreUpdatedEvent) => {
      onScore.current?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  const getSocket = useCallback(() => socketRef.current, []);

  return { connected, getSocket };
}
