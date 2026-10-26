"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
type Theme = "light" | "dark";
export default function ThemeControl() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("elares-beauty-theme");
    } catch {}
    const initial: Theme =
      saved === "dark" ||
      (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    document.documentElement.dataset.theme = initial;
    setTheme(initial);
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("elares-beauty-theme", next);
    } catch {}
  }
  return (
    <button
      type="button"
      className="theme-control"
      onClick={toggle}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      <span>{theme === "dark" ? "Claro" : "Escuro"}</span>
    </button>
  );
}
