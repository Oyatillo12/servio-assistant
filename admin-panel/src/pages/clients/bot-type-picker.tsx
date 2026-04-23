import { ShoppingCart, UserCheck, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface BotTypePickerProps {
  value: "order" | "lead";
  onChange: (value: "order" | "lead") => void;
}

/**
 * Visual picker for bot type. Shows the value proposition of each flow
 * at a glance (who it's for + what the customer journey looks like).
 */
export function BotTypePicker({ value, onChange }: BotTypePickerProps) {
  const { t } = useTranslation();

  const options = [
    {
      key: "order" as const,
      icon: ShoppingCart,
      title: t("bot_type_order"),
      description: t("bot_type_order_desc"),
      flow: [
        t("flow_step_products"),
        t("flow_step_cart"),
        t("flow_step_phone"),
        t("flow_step_confirm"),
      ],
      accent: "text-violet-600",
      ring: "ring-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      key: "lead" as const,
      icon: UserCheck,
      title: t("bot_type_lead"),
      description: t("bot_type_lead_desc"),
      flow: [
        t("flow_step_ai_chat"),
        t("flow_step_name"),
        t("flow_step_phone"),
        t("flow_step_saved"),
      ],
      accent: "text-pink-600",
      ring: "ring-pink-500",
      bg: "bg-pink-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              "text-left p-4 rounded-lg border-2 transition-all relative",
              selected
                ? `${opt.ring} ring-2 border-transparent bg-background shadow-sm`
                : "border-border hover:border-muted-foreground/30 bg-muted/20",
            )}
          >
            {selected && (
              <div className="absolute top-3 right-3">
                <div className={cn("rounded-full p-1", opt.bg)}>
                  <Check className={cn("w-3 h-3", opt.accent)} />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-2 rounded-md", opt.bg)}>
                <Icon className={cn("w-4 h-4", opt.accent)} />
              </div>
              <h3 className="font-semibold text-sm">{opt.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {opt.description}
            </p>
            <div className="flex items-center flex-wrap gap-1 text-[11px] text-muted-foreground">
              {opt.flow.map((step, i) => (
                <span key={i} className="inline-flex items-center">
                  <span className="px-1.5 py-0.5 bg-muted rounded">{step}</span>
                  {i < opt.flow.length - 1 && <span className="mx-1">→</span>}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
