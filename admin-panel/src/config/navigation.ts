import { LayoutDashboard, Users, Bot, Shield, MessageCircle } from "lucide-react";
import type { AuthUser } from "@/api";
import type { TranslationKey } from "@/i18n/localeNames";

export interface NavItem {
  labelKey: TranslationKey;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  roles: Array<AuthUser["role"]>;
  dynamic?: boolean;
}

export const navigationItems: NavItem[] = [
  {
    labelKey: "nav_dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin"],
  },
  {
    labelKey: "nav_clients",
    label: "Clients",
    path: "/clients",
    icon: Users,
    roles: ["super_admin"],
  },
  {
    labelKey: "nav_users",
    label: "Users",
    path: "/users",
    icon: Shield,
    roles: ["super_admin"],
  },
  // Client admin: single entry that opens the tabbed detail view
  {
    labelKey: "nav_my_bot",
    label: "My Bot",
    path: "/clients/:clientId",
    icon: Bot,
    roles: ["client_admin"],
    dynamic: true,
  },
  {
    labelKey: "nav_live_chat",
    label: "Live Chat",
    path: "/live-chat",
    icon: MessageCircle,
    roles: ["super_admin", "client_admin"],
  },
];

export function getNavItems(
  user: AuthUser,
): Array<NavItem & { resolvedPath: string }> {
  return navigationItems
    .filter((item) => item.roles.includes(user.role))
    .map((item) => ({
      ...item,
      resolvedPath:
        item.dynamic && user.clientId
          ? item.path.replace(":clientId", String(user.clientId))
          : item.path,
    }));
}
