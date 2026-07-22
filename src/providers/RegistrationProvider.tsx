"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RegisterEventPickerModal } from "@/components/RegisterEventPickerModal";
import { RegistrationModal } from "@/components/RegistrationModal";
import type { PublicEvent } from "@/lib/types/admin";

interface RegistrationContextValue {
  openRegistration: (eventId?: string) => void;
  closeRegistration: () => void;
}

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

async function fetchPublicEvents(): Promise<PublicEvent[]> {
  const res = await fetch("/api/events/public");
  if (!res.ok) return [];

  const data = await res.json();
  return data.events ?? [];
}

async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/session", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { authenticated?: boolean };
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [publicEvents, setPublicEvents] = useState<PublicEvent[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openRegistrationWithEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setPickerOpen(false);
    setRegistrationOpen(true);
  }, []);

  const openRegistration = useCallback(async (eventId?: string) => {
    if (await isAdminAuthenticated()) {
      return;
    }

    if (eventId) {
      openRegistrationWithEvent(eventId);
      return;
    }

    const events = await fetchPublicEvents();
    setPublicEvents(events);

    const openEvents = events.filter((event) => event.status === "open");

    if (openEvents.length === 1) {
      openRegistrationWithEvent(openEvents[0].id);
      return;
    }

    setPickerOpen(true);
  }, [openRegistrationWithEvent]);

  const closeRegistration = useCallback(() => {
    setRegistrationOpen(false);
    setSelectedEventId(null);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleSelectEvent = useCallback(
    (eventId: string) => {
      openRegistrationWithEvent(eventId);
    },
    [openRegistrationWithEvent]
  );

  useEffect(() => {
    const shouldOpen = searchParams.get("register") === "1";
    const eventId = searchParams.get("event");

    if (!shouldOpen) return;

    let cancelled = false;

    async function maybeOpen() {
      if (await isAdminAuthenticated()) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("register");
        params.delete("event");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        return;
      }

      if (cancelled) return;

      if (eventId) {
        openRegistrationWithEvent(eventId);
      } else {
        void openRegistration();
      }

      const params = new URLSearchParams(searchParams.toString());
      params.delete("register");
      params.delete("event");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    void maybeOpen();

    return () => {
      cancelled = true;
    };
  }, [searchParams, pathname, router, openRegistration, openRegistrationWithEvent]);

  return (
    <RegistrationContext.Provider value={{ openRegistration, closeRegistration }}>
      {children}
      {pickerOpen && (
        <RegisterEventPickerModal
          open={pickerOpen}
          events={publicEvents}
          onClose={closePicker}
          onSelectEvent={handleSelectEvent}
        />
      )}
      {registrationOpen && (
        <RegistrationModal
          open={registrationOpen}
          eventId={selectedEventId}
          onClose={closeRegistration}
        />
      )}
    </RegistrationContext.Provider>
  );
}

export function useRegistrationModal() {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error("useRegistrationModal must be used within RegistrationProvider");
  }
  return context;
}
