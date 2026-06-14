"use client";

import { Moon, Monitor, Sun } from "lucide-react";
import { useThemeMode } from "@/components/theme-provider";
import styles from "./theme-switcher.module.css";

const modes = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon }
] as const;

export function ThemeSwitcher() {
  const { mode, setMode } = useThemeMode();

  return (
    <div className={styles.switcher} role="group" aria-label="主题模式">
      {modes.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            className={mode === item.value ? styles.active : styles.option}
            onClick={() => setMode(item.value)}
            title={item.label}
            type="button"
          >
            <Icon size={16} aria-hidden />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
