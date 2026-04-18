import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';

import { api } from '@/api';

export interface CatalogFormData {
  id?: number;
  name: string;
  description: string;
  price?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: CatalogFormData | null;
  type: 'product' | 'service';
  requirePrice: boolean;
  onSave: (data: CatalogFormData) => Promise<void>;
}

export function CatalogFormModal({
  open,
  onOpenChange,
  initialData,
  type,
  requirePrice,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [keywords, setKeywords] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description);
        setPrice(initialData.price != null ? String(initialData.price) : '');
      } else {
        setName('');
        setDescription('');
        setPrice('');
      }
      setKeywords('');
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requirePrice && !price.trim()) {
      toast.error(t('price_required'));
      return;
    }
    
    setSaving(true);
    try {
      await onSave({
        id: initialData?.id,
        name,
        description,
        price: price ? Number(price) : undefined,
      });
      onOpenChange(false);
      toast.success(type === 'product' ? t('product_saved') : t('service_saved'));
    } catch (error) {
      toast.error(t('failed_save_type', { type }));
    } finally {
      setSaving(false);
    }
  };

  const generateAI = async () => {
    if (!name.trim()) {
      toast.error(t('enter_name_first'));
      return;
    }
    if (description.trim() && !window.confirm(t('overwrite_desc_confirm'))) {
      return;
    }

    setGenerating(true);
    try {
      const res = await api.ai.generateDescription({
        name,
        type,
        keywords: keywords.trim() || undefined,
      });
      setDescription(res.description);
      toast.success(t('desc_generated'));
    } catch (error) {
      toast.error(t('failed_generate_desc'));
    } finally {
      setGenerating(false);
    }
  };

  const title = initialData ? t('edit_type', { type }) : t('add_new_type', { type });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="capitalize">{title}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'product' ? t('eg_product') : t('eg_service')}
                required
              />
            </div>

            {(!requirePrice || type === 'product') && (
              <div className="space-y-2">
                <Label htmlFor="price">
                  {requirePrice ? t('price') : t('price_optional')}
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required={requirePrice}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label htmlFor="description">{t('desc_ai_writer')}</Label>
              </div>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('desc_placeholder')}
                rows={3}
              />
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder={t('keywords_placeholder')}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="text-xs h-8 flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 whitespace-nowrap bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                  onClick={generateAI}
                  disabled={generating || !name}
                >
                  {generating ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                  )}
                  {t('auto_write')}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 mt-4 sm:mt-0">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" className="flex-1 sm:flex-none" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
