import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/page-header";
import { ProductsSection } from "./products-section";
import type { ClientDetailContext } from "./client-detail-layout";

export function ProductsPage() {
  const { client, reload } = useOutletContext<ClientDetailContext>();
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={t("products_title")} description={t("products_desc")} />
      <ProductsSection client={client} onUpdate={reload} />
    </div>
  );
}
