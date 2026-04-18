import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bot, User, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { api, type ChatMessage } from '@/api';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function ChatHistoryPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const clientId = Number(id);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.analytics.messages(clientId, page)
      .then((res) => {
        setMessages(res.data);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [clientId, page]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={t("chat_history_title")}
        description={t("chat_history_desc")}
        actions={
          <Badge variant="outline" className="px-3 py-1 font-mono text-sm">
            {total}
          </Badge>
        }
      />

      <Card>
        <CardContent className="p-0">
           {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`flex gap-4 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <Skeleton className={`h-20 w-[60%] rounded-2xl ${i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'}`} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-24 border-b border-dashed text-muted-foreground">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/5 text-primary/50 mb-4">
                <MessageSquare size={32} />
              </div>
              <p>No chat history available.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 p-6">
              {messages.map((m) => {
                const isBot = m.role === 'assistant';
                return (
                  <div key={m.id} className={`flex gap-4 w-full ${!isBot ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex shrink-0 items-center justify-center w-8 h-8 rounded-full ${isBot ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {isBot ? <Bot size={16} /> : <User size={16} />}
                    </div>
                    <div className={`flex flex-col ${!isBot ? 'items-end' : 'items-start'} max-w-[80%]`}>
                      <div className={`
                        px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words
                        ${isBot ? 'bg-muted/50 rounded-tl-none text-foreground' : 'bg-primary text-primary-foreground rounded-tr-none'}
                      `}>
                        {m.message}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 px-1">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {isBot ? 'AI Assistant' : `User (${m.chatId})`}
                        </span>
                        <span className="text-[10px] text-muted-foreground opacity-50">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between bg-muted/20">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
