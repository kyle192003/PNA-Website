import { useEffect } from "react";
import { conference } from "@/lib/conference";

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;

    const previousTitle = document.title;
    document.title = `${title} | ${conference.siteName}`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
