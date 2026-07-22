"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type AdminSessionContextValue = {
  isAdmin: boolean;
  ready: boolean;
};

const AdminSessionContext = createContext<AdminSessionContextValue>({
  isAdmin: false,
  ready: false,
});

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAdminSession() {
      try {
        const res = await fetch("/api/admin/session", { cache: "no-store" });
        const data = (await res.json()) as { authenticated?: boolean };
        if (!cancelled) {
          setIsAdmin(res.ok && data.authenticated === true);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void checkAdminSession();

    function handleFocus() {
      void checkAdminSession();
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [pathname]);

  return (
    <AdminSessionContext.Provider value={{ isAdmin, ready }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  return useContext(AdminSessionContext);
}
