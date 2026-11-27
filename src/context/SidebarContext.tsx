import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface SidebarContextValue {
  readonly isOpen: boolean;
  readonly openSidebar: () => void;
  readonly closeSidebar: () => void;
  readonly toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const SidebarProvider: React.FC<PropsWithChildren> = ({children}) => {
  const [isOpen, setIsOpen] = useState(false);

  const openSidebar = useCallback(() => setIsOpen(true), []);
  const closeSidebar = useCallback(() => setIsOpen(false), []);
  const toggleSidebar = useCallback(() => setIsOpen(prev => !prev), []);

  const value = useMemo(
    () => ({isOpen, openSidebar, closeSidebar, toggleSidebar}),
    [isOpen, openSidebar, closeSidebar, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }
  return ctx;
}
