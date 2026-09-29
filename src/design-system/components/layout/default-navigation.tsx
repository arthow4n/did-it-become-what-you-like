import type { ReactNode } from "react";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Plus,
  Sparkles,
} from "lucide-react";
import { AppNavigation } from "./app-navigation.tsx";

export type AppNavigationIconSet = {
  expenses?: ReactNode;
  manual?: ReactNode;
  scan?: ReactNode;
  organize?: ReactNode;
  settings?: ReactNode;
};

export type DefaultNavigationProps = {
  selected?: string;
  onSelect?: (id: string) => void;
  icons?: AppNavigationIconSet;
};

export function DefaultNavigation(
  { selected = "expenses", onSelect, icons = {} }: DefaultNavigationProps,
) {
  return (
    <AppNavigation
      items={[
        {
          id: "expenses",
          label: "Expenses",
          icon: icons.expenses ?? <CircleCheck />,
          selected: selected === "expenses",
        },
        {
          id: "manual",
          label: "Manual",
          icon: icons.manual ?? <Plus />,
          selected: selected === "manual",
        },
        {
          id: "scan",
          label: "Scan",
          icon: icons.scan ?? <Sparkles />,
          selected: selected === "scan",
        },
        {
          id: "organize",
          label: "Organize",
          icon: icons.organize ?? <ChevronRight />,
          selected: selected === "organize",
        },
        {
          id: "settings",
          label: "Settings",
          icon: icons.settings ?? <CircleAlert />,
          selected: selected === "settings",
        },
      ]}
      onSelect={onSelect}
    />
  );
}
