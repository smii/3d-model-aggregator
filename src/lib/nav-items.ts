import { Search, Heart, Bell, RefreshCw, Settings } from "lucide-react";

const allNavItems = [
  { href: "/", label: "Search", icon: Search },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/saved-searches", label: "Saved Searches", icon: Bell },
  { href: "/sync", label: "Account Sync", icon: RefreshCw, gmail: true },
  { href: "/settings", label: "Settings", icon: Settings, gmail: true },
];

export function getNavItems(hideGmailFeatures: boolean) {
  return hideGmailFeatures
    ? allNavItems.filter((item) => !item.gmail)
    : allNavItems;
}
