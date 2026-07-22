"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useRegistrationModal } from "@/providers/RegistrationProvider";

export function RegisterRedirect() {
  const router = useRouter();
  const { openRegistration } = useRegistrationModal();
  const { isAdmin, ready } = useAdminSession();

  useEffect(() => {
    if (!ready) return;

    if (isAdmin) {
      router.replace("/admin", { scroll: false });
      return;
    }

    void openRegistration();
    router.replace("/", { scroll: false });
  }, [isAdmin, openRegistration, ready, router]);

  return null;
}
