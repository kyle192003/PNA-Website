import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SitePageMotion } from "@/components/motion/SitePageMotion";
import { AdminSessionProvider } from "@/providers/AdminSessionProvider";
import { RegistrationProvider } from "@/providers/RegistrationProvider";
import { EventOverviewProvider } from "@/providers/EventOverviewProvider";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminSessionProvider>
        <RegistrationProvider>
          <EventOverviewProvider>
            <LoadingScreen />
            <Header />
            <main className="flex-grow-1">
              <SitePageMotion>{children}</SitePageMotion>
            </main>
            <Footer />
          </EventOverviewProvider>
        </RegistrationProvider>
      </AdminSessionProvider>
    </Suspense>
  );
}
