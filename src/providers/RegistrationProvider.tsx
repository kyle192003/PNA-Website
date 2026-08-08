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
import { Modal } from "@/components/ui/Modal";
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
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openRegistrationWithEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setPickerOpen(false);
    setBlockedMessage(null);
    setRegistrationOpen(true);
  }, []);

  const showRegistrationUnavailable = useCallback((message: string) => {
    setRegistrationOpen(false);
    setPickerOpen(false);
    setSelectedEventId(null);
    setBlockedMessage(message);
  }, []);

  const resolveOpenEventId = useCallback(
    async (eventId: string): Promise<string | null> => {
      const events = await fetchPublicEvents();
      setPublicEvents(events);
      const match = events.find((event) => event.id === eventId);
      if (!match) {
        showRegistrationUnavailable(
          "This event is not available for registration. It may be closed or the link may be outdated."
        );
        return null;
      }
      if (match.status !== "open") {
        showRegistrationUnavailable(
          "Registration for this event is not open yet. Please check back once the secretariat opens registration."
        );
        return null;
      }
      return match.id;
    },
    [showRegistrationUnavailable]
  );

  const openRegistration = useCallback(
    async (eventId?: string) => {
      if (await isAdminAuthenticated()) {
        return;
      }

      if (eventId) {
        const openId = await resolveOpenEventId(eventId);
        if (openId) openRegistrationWithEvent(openId);
        return;
      }

      const events = await fetchPublicEvents();
      setPublicEvents(events);

      const openEvents = events.filter((event) => event.status === "open");

      if (openEvents.length === 0) {
        showRegistrationUnavailable(
          "No events are open for registration at the moment. Please check back soon."
        );
        return;
      }

      if (openEvents.length === 1) {
        openRegistrationWithEvent(openEvents[0].id);
        return;
      }

      setBlockedMessage(null);
      setPickerOpen(true);
    },
    [openRegistrationWithEvent, resolveOpenEventId, showRegistrationUnavailable]
  );

  const closeRegistration = useCallback(() => {
    setRegistrationOpen(false);
    setSelectedEventId(null);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleSelectEvent = useCallback(
    (eventId: string) => {
      void (async () => {
        const openId = await resolveOpenEventId(eventId);
        if (openId) openRegistrationWithEvent(openId);
      })();
    },
    [openRegistrationWithEvent, resolveOpenEventId]
  );

  useEffect(() => {
    const shouldOpen = searchParams.get("register") === "1";
    const eventId = searchParams.get("event")?.trim() || null;

    if (!shouldOpen) return;

    let cancelled = false;

    async function maybeOpen() {
      if (await isAdminAuthenticated()) {
        if (cancelled) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete("register");
        params.delete("event");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        return;
      }

      if (cancelled) return;

      if (eventId) {
        const openId = await resolveOpenEventId(eventId);
        if (cancelled) return;
        if (openId) openRegistrationWithEvent(openId);
      } else {
        await openRegistration();
        if (cancelled) return;
      }

      if (cancelled) return;

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
  }, [
    searchParams,
    pathname,
    router,
    openRegistration,
    openRegistrationWithEvent,
    resolveOpenEventId,
  ]);

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
      {blockedMessage ? (
        <Modal
          open
          onClose={() => setBlockedMessage(null)}
          title="Registration unavailable"
          contentClassName="p-4 sm:p-6"
        >
          <p className="mb-4 text-sm text-muted">{blockedMessage}</p>
          <button
            type="button"
            className="btn-primary w-100"
            onClick={() => setBlockedMessage(null)}
          >
            Close
          </button>
        </Modal>
      ) : null}
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
