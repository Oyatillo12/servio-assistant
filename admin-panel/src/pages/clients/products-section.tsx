import { useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { api, type Client } from '@/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency';

import { CatalogCard } from './components/catalog-card';
import { CatalogFormModal, type CatalogFormData } from './components/catalog-form-modal';

interface Props {
  client: Client;
  onUpdate: () => void;
}

export function ProductsSection({ client, onUpdate }: Props) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogFormData | null>(null);

  const priceFormatter = (price: number) => formatPrice(price, client.currency);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: CatalogFormData) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleSave = async (data: CatalogFormData) => {
    if (data.id) {
      await api.products.update(data.id, {
        name: data.name,
        description: data.description || undefined,
        price: data.price,
      });
    } else {
      await api.products.add(client.id, {
        name: data.name,
        description: data.description || undefined,
        price: data.price,
      });
    }
    onUpdate();
  };

  const handleRemove = async (productId: number) => {
    if (!window.confirm(t('delete_product_confirm'))) return;
    try {
      await api.products.remove(productId);
      onUpdate();
      toast.success(t('product_removed'));
    } catch {
      toast.error(t('failed_remove_product'));
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Tag className="w-5 h-5 text-primary" />
              {t('products_title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t('products_manage_desc')}</CardDescription>
          </div>
          <Button onClick={handleOpenAdd} size="sm" className="hidden sm:flex">
            <Plus className="w-4 h-4 mr-2" />
            {t('add_product')}
          </Button>
          <Button onClick={handleOpenAdd} size="icon" className="sm:hidden shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {client.products.length > 0 ? (
            <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {client.products.map((p) => (
                <CatalogCard
                  key={p.id}
                  item={p}
                  currencyFormat={priceFormatter}
                  onEdit={(item) => handleOpenEdit({ ...item, price: item.price ?? undefined })}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground flex flex-col items-center">
              <Tag className="w-10 h-10 mb-4 opacity-50" />
              <p>{t('no_products')}</p>
              <Button onClick={handleOpenAdd} variant="outline" className="mt-4">
                {t('create_first_product')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <CatalogFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialData={editingItem}
        type="product"
        requirePrice={true}
        onSave={handleSave}
      />
    </>
  );
}
