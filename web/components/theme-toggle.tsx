"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { CheckIcon, DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";

const OPTIONS = [
  { icon: <SunIcon />, label: "Light", value: "light" },
  { icon: <MoonIcon />, label: "Dark", value: "dark" },
  { icon: <DesktopIcon />, label: "System", value: "system" },
];

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      {/* The trigger icon follows the theme in CSS, so the server and client
          render the same markup. */}
      <DropdownMenuTrigger render={<SidebarMenuButton />}>
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
        <span>Theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40" side="top">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
            {option.icon}
            <span>{option.label}</span>
            {theme === option.value && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
