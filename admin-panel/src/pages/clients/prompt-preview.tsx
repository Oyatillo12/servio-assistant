import { Eye, Terminal } from 'lucide-react';
import type { Client } from '@/api';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface Props {
  systemPrompt: string;
  client: Client | null;
}

export function PromptPreview({ systemPrompt, client }: Props) {
  const buildPreview = () => {
    let prompt = systemPrompt;
    prompt += '\n\nIMPORTANT: Always respond in English. Keep responses concise and suitable for Telegram chat (under 300 words).';

    const products = client?.products.filter((p) => p.isActive) ?? [];
    if (products.length > 0) {
      prompt += '\n\nOur products:\n';
      prompt += products.map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ''}${p.price != null ? ` ($${p.price})` : ''}`).join('\n');
    }

    const services = client?.services.filter((s) => s.isActive) ?? [];
    if (services.length > 0) {
      prompt += '\n\nOur services:\n';
      prompt += services.map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n');
    }

    return prompt;
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-fit text-muted-foreground" type="button">
          <Eye className="w-4 h-4 mr-2" />
          Preview Compiled Prompt
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Compiled System Prompt
          </SheetTitle>
          <SheetDescription>
            This is the exact prompt that is sent to the AI model on every request, including dynamically injected catalogs.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 mt-6 rounded-md overflow-hidden bg-zinc-950 p-4 border relative">
          <div className="absolute top-0 right-0 py-1 px-2.5 bg-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-wider rounded-bl">
            Raw payload
          </div>
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-tight h-full overflow-y-auto">
            {buildPreview() || <span className="text-zinc-600 italic">No prompt provided yet.</span>}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  );
}
