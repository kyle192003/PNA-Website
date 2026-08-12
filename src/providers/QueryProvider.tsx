"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { isPublicRqDevtoolsEnabled } from "@/lib/security/public-env";

const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then((mod) => ({
      default: mod.ReactQueryDevtools,
    })),
  { ssr: false }
);

const showDevtools =
  process.env.NODE_ENV === "development" && isPublicRqDevtoolsEnabled();

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showDevtools && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
