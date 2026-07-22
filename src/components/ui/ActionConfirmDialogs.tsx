"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SuccessDialog } from "@/components/ui/SuccessDialog";
import type { useConfirmAction } from "@/hooks/use-confirm-action";

type ConfirmHook = ReturnType<typeof useConfirmAction>;

export function ActionConfirmDialogs({ hook }: { hook: ConfirmHook }) {
  const {
    confirm,
    success,
    loading,
    confirmAction,
    cancelConfirm,
    dismissSuccess,
  } = hook;

  return (
    <>
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        tagline={confirm.tagline || undefined}
        confirmLabel={confirm.confirmLabel}
        variant={confirm.variant}
        loading={loading}
        onConfirm={confirmAction}
        onCancel={cancelConfirm}
      />
      <SuccessDialog
        open={success.open}
        title={success.title}
        message={success.message}
        onClose={dismissSuccess}
      />
    </>
  );
}
