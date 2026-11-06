import {
  Search,
  Heart,
  Bell,
  RefreshCw,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages/en";

interface NavItem {
  href: string;
  /** English fallback, shown when `labelKey` is not set. */
  label: string;
  /** i18n message key; Sidebar and MobileNav translate it with `useT()`. */
  labelKey?: MessageKey;
  icon: LucideIcon;
  gmail?: boolean;
}

const allNavItems: NavItem[] = [
  { href: "/", label: "Search", labelKey: "nav.search", icon: Search },
  {
    href: "/favorites",
    label: "Favorites",
    labelKey: "nav.favorites",
    icon: Heart,
  },
  {
    href: "/saved-searches",
    label: "Saved Searches",
    labelKey: "nav.savedSearches",
    icon: Bell,
  },
  {
    href: "/sync",
    label: "Account Sync",
    labelKey: "nav.accountSync",
    icon: RefreshCw,
    gmail: true,
  },
  {
    href: "/settings",
    label: "Settings",
    labelKey: "nav.settings",
    icon: Settings,
    gmail: true,
  },
];

export function getNavItems(hideGmailFeatures: boolean) {
  return hideGmailFeatures
    ? allNavItems.filter((item) => !item.gmail)
    : allNavItems;
}
