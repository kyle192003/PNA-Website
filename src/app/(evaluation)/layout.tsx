import { Suspense } from "react";
import { Header } from "@/components/Header";
import { AdminSessionProvider } from "@/providers/AdminSessionProvider";
import { RegistrationProvider } from "@/providers/RegistrationProvider";

export default function EvaluationLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminSessionProvider>
        <RegistrationProvider>
          <div className="evaluation-layout">
            <Header hideCtas forceSolid brandOnly />
            <main className="evaluation-layout-main">{children}</main>
          </div>
        </RegistrationProvider>
      </AdminSessionProvider>
    </Suspense>
  );
}
