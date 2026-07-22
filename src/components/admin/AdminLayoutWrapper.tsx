"use client";

import { Suspense, type ReactNode } from "react";
import { AdminPageMotion } from "@/components/motion/AdminPageMotion";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminLoginSuccessNotice } from "@/components/admin/AdminLoginSuccessNotice";

export function AdminLayoutWrapper({
  children,
  newInquiryCount = 0,
  underReviewCount = 0,
}: {
  children: React.ReactNode;
  newInquiryCount?: number;
  underReviewCount?: number;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminLoginSuccessNotice />
      </Suspense>
      <AdminShell initialNewInquiryCount={newInquiryCount} initialUnderReviewCount={underReviewCount}>
        <AdminPageMotion>{children}</AdminPageMotion>
      </AdminShell>
    </>
  );
}