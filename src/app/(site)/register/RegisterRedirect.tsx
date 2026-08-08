"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useRegistrationModal } from "@/providers/RegistrationProvider";

function RegisterRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openRegistration } = useRegistrationModal();
  const { isAdmin, ready } = useAdminSession();

  useEffect(() => {
    if (!ready) return;

    if (isAdmin) {
      router.replace("/admin", { scroll: false });
      return;
    }

    const eventId =
      searchParams.get("event")?.trim() ||
      searchParams.get("eventId")?.trim() ||
      "";

    // Prefer the canonical deep-link so RegistrationProvider owns open + cleanup.
    if (eventId) {
      router.replace(`/?register=1&event=${encodeURIComponent(eventId)}`, {
        scroll: false,
      });
      return;
    }

    void openRegistration();
    router.replace("/", { scroll: false });
  }, [isAdmin, openRegistration, ready, router, searchParams]);

  return null;
}

export function RegisterRedirect() {
  return (
    <Suspense fallback={null}>
      <RegisterRedirectInner />
    </Suspense>
  );
}
