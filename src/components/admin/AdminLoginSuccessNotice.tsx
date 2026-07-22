"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SuccessDialog } from "@/components/ui/SuccessDialog";

export function AdminLoginSuccessNotice() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("loggedIn") !== "1") return;

    setOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("loggedIn");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  return (
    <SuccessDialog
      open={open}
      title="Successfully logged in"
      message="Welcome to the admin dashboard."
      closeLabel="Continue"
      onClose={() => setOpen(false)}
    />
  );
}
