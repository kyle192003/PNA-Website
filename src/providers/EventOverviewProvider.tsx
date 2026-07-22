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
import type { PublicEvent } from "@/lib/types/admin";
import { EventOverviewModal } from "@/components/EventOverviewModal";
import { useRegistrationModal } from "@/providers/RegistrationProvider";

interface EventOverviewContextValue {
  openEventOverview: (event: PublicEvent) => void;
  closeEventOverview: () => void;
}

const EventOverviewContext = createContext<EventOverviewContextValue | null>(null);

export function EventOverviewProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const { openRegistration } = useRegistrationModal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const closeEventOverview = useCallback(() => {
    setOpen(false);
    setEvent(null);
  }, []);

  const openEventOverview = useCallback((nextEvent: PublicEvent) => {
    setEvent(nextEvent);
    setOpen(true);
  }, []);

  const handleRegisterNow = useCallback(
    (eventId: string) => {
      closeEventOverview();
      openRegistration(eventId);
    },
    [closeEventOverview, openRegistration]
  );

  useEffect(() => {
    const overviewId = searchParams.get("overview");
    if (!overviewId) return;

    let cancelled = false;

    async function loadEvent() {
      try {
        const res = await fetch(`/api/events/${overviewId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { event: PublicEvent };
        if (!cancelled) {
          setEvent(data.event);
          setOpen(true);
        }
      } catch {
        // Ignore fetch errors for invalid overview links.
      } finally {
        if (!cancelled) {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("overview");
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        }
      }
    }

    void loadEvent();

    return () => {
      cancelled = true;
    };
  }, [searchParams, pathname, router]);

  return (
    <EventOverviewContext.Provider value={{ openEventOverview, closeEventOverview }}>
      {children}
      <EventOverviewModal
        open={open}
        event={event}
        onClose={closeEventOverview}
        onRegisterNow={handleRegisterNow}
      />
    </EventOverviewContext.Provider>
  );
}

export function useEventOverview() {
  const context = useContext(EventOverviewContext);
  if (!context) {
    throw new Error("useEventOverview must be used within EventOverviewProvider");
  }
  return context;
}
