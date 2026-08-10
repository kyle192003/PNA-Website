"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MessageDialog, SuccessDialog } from "@/components/ui/MessageDialog";
import type { useConfirmAction } from "@/hooks/use-confirm-action";

type ConfirmHook = ReturnType<typeof useConfirmAction>;

export function ActionConfirmDialogs({ hook }: { hook: ConfirmHook }) {
  const {
    confirm,
    success,
    error,
    loading,
    confirmAction,
    cancelConfirm,
    dismissSuccess,
    dismissError,
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
      <MessageDialog
        open={error.open}
        title={error.title}
        message={error.message}
        variant="error"
        closeLabel="Close"
        onClose={dismissError}
      />
    </>
  );
}
