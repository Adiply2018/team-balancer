import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "./ui/button";

interface ThemeSwitcherProps {
  onClick?: () => void;
}

const ThemeSwitcher = ({ onClick }: ThemeSwitcherProps) => {
  const [theme, setTheme] = useState("light");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") || "light";
    setTheme(storedTheme);
    document.documentElement.classList.toggle("dark", storedTheme === "dark");
    setIsMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark");

    // オプショナルなonClickコールバックを呼び出す
    onClick?.();
  };

  if (!isMounted) {
    return null;
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      <Sun
        className={`absolute w-5 h-5 ${theme === "dark" ? "opacity-0" : "opacity-100"}`}
      />
      <Moon
        className={`absolute w-5 h-5 ${theme === "light" ? "opacity-0" : "opacity-100"}`}
      />
    </Button>
  );
};

export default ThemeSwitcher;
