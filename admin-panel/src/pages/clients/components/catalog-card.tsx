import { Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CatalogItem {
  id: number;
  name: string;
  description: string;
  price?: number | null;
  isActive: boolean;
}

interface Props {
  item: CatalogItem;
  currencyFormat?: (price: number) => string;
  onEdit: (item: CatalogItem) => void;
  onRemove: (id: number) => void;
}

export function CatalogCard({ item, currencyFormat, onEdit, onRemove }: Props) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-row items-center justify-between p-3 overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex flex-row items-center gap-3 overflow-hidden">
        {/* Placeholder Avatar */}
        <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
          {item.name.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm truncate">
              {item.name}
            </h4>
            {item.price != null && currencyFormat && (
              <span className="shrink-0 bg-secondary text-secondary-foreground font-mono px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">
                {currencyFormat(item.price)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {item.description || <span className="italic opacity-50">{t('no_description')}</span>}
          </p>
        </div>
      </div>
      
      <div className="pl-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuItem onClick={() => onEdit(item)} className="cursor-pointer">
              <Edit className="w-4 h-4 mr-2 text-muted-foreground" />
              {t('edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRemove(item.id)} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              {t('remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
