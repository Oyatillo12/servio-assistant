import { localeNames, localeFlags, type Locale } from "@/i18n/localeNames";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import i18n from "@/i18n";

const locales: Locale[] = ["en", "ru", "uz"];

export function LanguageSwitcher() {
  const locale = (i18n.language as Locale) || "en";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs">
            {localeFlags[locale]} {localeNames[locale]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => i18n.changeLanguage(l)}
            className={l === locale ? "bg-accent" : ""}
          >
            <span className="mr-2">{localeFlags[l]}</span>
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
