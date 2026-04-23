import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, Printer, Share2, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface BotShareCardProps {
  /** Full deep-link URL, e.g. https://t.me/MyBot?start=demo-abc */
  url: string;
  /** Client name used as brand label on-card and in printouts */
  clientName: string;
  /** Bot username (without @) for display */
  botHandle: string;
}

const BRAND_COLOR = "#0088cc"; // Telegram blue

export function BotShareCard({ url, clientName, botHandle: _botHandle }: BotShareCardProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);

  const getCanvas = (): HTMLCanvasElement | null =>
    canvasRef.current?.querySelector("canvas") ?? null;

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast.success(t("bot_link_copied"));
  };

  const downloadPng = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${slugify(clientName)}-bot-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const printQr = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank", "width=520,height=640");
    if (!win) {
      toast.error(t("popup_blocked"));
      return;
    }
    win.document.write(`<!doctype html>
<html>
<head>
<title>${escapeHtml(clientName)} — Bot QR</title>
<style>
  @page { margin: 16mm; }
  body {
    font-family: ui-sans-serif, system-ui, sans-serif;
    display: flex; flex-direction: column; align-items: center;
    padding: 32px; color: #111;
  }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
  img { width: 320px; height: 320px; border: 1px solid #eee; padding: 12px; border-radius: 12px; }
  .link { margin-top: 20px; font-family: ui-monospace, monospace; font-size: 13px; color: #333; word-break: break-all; text-align: center; max-width: 360px; }
  .handle { color: ${BRAND_COLOR}; font-weight: 600; margin-top: 4px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(clientName)}</h1>
  <div class="sub">${t("scan_to_chat")}</div>
  <img src="${dataUrl}" alt="QR" />
  <script>window.onload = () => { window.focus(); window.print(); };</script>
</body>
</html>`);
    win.document.close();
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: clientName,
          text: t("share_bot_text", { name: clientName }),
          url,
        });
      } catch {
        // user cancelled — no toast
      }
    } else {
      await copyLink();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center">
        <div
          ref={canvasRef}
          className="p-4 rounded-2xl bg-white ring-1 ring-border shadow-sm"
        >
          <QRCodeCanvas
            value={url}
            size={224}
            level="H"
            marginSize={1}
            fgColor={BRAND_COLOR}
            bgColor="#ffffff"
          />
        </div>
        <div className="mt-3 text-center">
          <div className="font-semibold tracking-tight">{clientName}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t("scan_to_chat")}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
          <Send className="w-4 h-4 text-[color:var(--brand)] shrink-0" style={{ color: BRAND_COLOR }} />
          <div className="font-mono text-xs sm:text-sm truncate flex-1">{url}</div>
          <Button size="sm" variant="ghost" onClick={copyLink} className="h-7 px-2">
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Button variant="outline" onClick={downloadPng} className="h-10">
          <Download className="w-4 h-4 mr-2" />
          {t("download_qr")}
        </Button>
        <Button variant="outline" onClick={printQr} className="h-10">
          <Printer className="w-4 h-4 mr-2" />
          {t("print_qr")}
        </Button>
        <Button onClick={share} className="h-10 col-span-2 sm:col-span-1">
          <Share2 className="w-4 h-4 mr-2" />
          {t("share")}
        </Button>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "bot";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
