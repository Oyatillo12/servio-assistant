import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/page-header";
import { ServicesSection } from "./services-section";
import type { ClientDetailContext } from "./client-detail-layout";

export function ServicesPage() {
  const { client, reload } = useOutletContext<ClientDetailContext>();
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={t("services_title")} description={t("services_desc")} />
      <ServicesSection client={client} onUpdate={reload} />
    </div>
  );
}
