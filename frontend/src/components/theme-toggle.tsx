import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ThemeSwitcher = () => {
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
  };

  if (!isMounted) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors duration-200"
            aria-label="テーマの切り替え"
          >
            <div className="relative w-6 h-6">
              <Sun
                className={`absolute top-0 left-0 transition-all duration-500 w-6 h-6 ${
                  theme === "dark"
                    ? "opacity-0 rotate-180"
                    : "opacity-100 rotate-0"
                }`}
              />
              <Moon
                className={`absolute top-0 left-0 transition-all duration-500 w-6 h-6 ${
                  theme === "dark"
                    ? "opacity-100 rotate-0"
                    : "opacity-0 -rotate-180"
                }`}
              />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{theme === "light" ? "ダーク" : "ライト"}モードに切り替え</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ThemeSwitcher;
