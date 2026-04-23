import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BotShareCard } from "@/components/bot-share-card";
import { BOT_URL } from "@/config/constants";

interface BotShareDialogProps {
  slug: string;
  clientName: string;
  /** Dedicated bot @username — when set, share that bot directly instead of the general one. */
  botUsername?: string | null;
  children: ReactNode;
}

export function BotShareDialog({
  slug,
  clientName,
  botUsername,
  children,
}: BotShareDialogProps) {
  const { t } = useTranslation();

  const { url, botHandle } = botUsername
    ? { url: `https://t.me/${botUsername}`, botHandle: botUsername }
    : {
        url: `${BOT_URL}?start=${slug}`,
        botHandle: BOT_URL.replace(/^https?:\/\/t\.me\//, ""),
      };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md lg:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("share_bot")}</DialogTitle>
          <DialogDescription>{t("share_bot_desc")}</DialogDescription>
        </DialogHeader>
        <BotShareCard url={url} clientName={clientName} botHandle={botHandle} />
      </DialogContent>
    </Dialog>
  );
}
