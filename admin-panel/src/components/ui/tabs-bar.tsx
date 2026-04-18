import { NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface TabBarItem {
  to: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** When true, only match exact path (useful for index tab) */
  end?: boolean;
}

interface TabsBarProps {
  items: TabBarItem[];
  className?: string;
}

/**
 * Horizontal scrollable tab bar for sub-navigation inside a detail page.
 * Mobile-friendly: scrolls horizontally when tabs overflow.
 */
export function TabsBar({ items, className }: TabsBarProps) {
  return (
    <div
      className={cn(
        "border-b sticky top-0 bg-background z-10 -mx-6 px-6",
        className,
      )}
    >
      <nav className="flex gap-1 overflow-x-auto scrollbar-thin">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
              )
            }
          >
            {item.icon && <item.icon className="w-4 h-4" />}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
