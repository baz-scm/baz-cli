import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { AppConfig, getAppConfig } from "./app-mode.js";

const AppModeContext = createContext<AppConfig | null>(null);

interface AppModeProviderProps {
  children: ReactNode;
}

export const AppModeProvider: React.FC<AppModeProviderProps> = ({
  children,
}) => {
  const config = useMemo(() => getAppConfig(), []);

  return (
    <AppModeContext.Provider value={config}>{children}</AppModeContext.Provider>
  );
};

export const useAppMode = (): AppConfig => {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error("useAppMode must be used within an AppModeProvider");
  }
  return context;
};
