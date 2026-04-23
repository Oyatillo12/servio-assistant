import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  label?: string;
  className?: string;
  /** If provided, renders the button when no SPA history exists and navigates here on click. */
  fallbackTo?: string;
}

export function BackButton({ label, className, fallbackTo }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const hasHistory = location.key !== "default";

  if (!hasHistory && !fallbackTo) return null;

  const handleClick = () => {
    if (hasHistory) navigate(-1);
    else if (fallbackTo) navigate(fallbackTo);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`text-muted-foreground -ml-2 ${className ?? ""}`}
      onClick={handleClick}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {label ?? t("back")}
    </Button>
  );
}
