"use client";

import { useCallback, useRef, useState } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  tagline?: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
  loadingMessage?: string;
  successTitle?: string;
  successMessage?: string;
  showSuccess?: boolean;
  onSuccessClose?: () => void;
  /** Return a string to override the success dialog message. */
  action: () => Promise<void | string>;
}

const initialConfirmState = {
  open: false,
  title: "",
  message: "",
  tagline: "",
  confirmLabel: "Yes, continue",
  variant: "default" as "default" | "danger",
  loadingMessage: "Processing...",
  successTitle: "",
  successMessage: "",
  showSuccess: true,
  action: null as (() => Promise<void | string>) | null,
};

const initialSuccessState = {
  open: false,
  title: "",
  message: "",
};

export function useConfirmAction() {
  const [confirm, setConfirm] = useState(initialConfirmState);
  const [success, setSuccess] = useState(initialSuccessState);
  const [loading, setLoading] = useState(false);
  const onSuccessCloseRef = useRef<(() => void) | null>(null);

  const requestConfirm = useCallback((options: ConfirmOptions) => {
    onSuccessCloseRef.current = options.onSuccessClose ?? null;
    setConfirm({
      open: true,
      title: options.title,
      message: options.message,
      tagline: options.tagline ?? "",
      confirmLabel: options.confirmLabel ?? "Yes, continue",
      variant: options.variant ?? "default",
      loadingMessage: options.loadingMessage ?? "Processing...",
      successTitle: options.successTitle ?? "Success",
      successMessage: options.successMessage ?? "Completed successfully.",
      showSuccess: options.showSuccess !== false,
      action: options.action,
    });
  }, []);

  const cancelConfirm = useCallback(() => {
    if (loading) return;
    onSuccessCloseRef.current = null;
    setConfirm(initialConfirmState);
  }, [loading]);

  const dismissSuccess = useCallback(() => {
    setSuccess(initialSuccessState);
    const onSuccessClose = onSuccessCloseRef.current;
    onSuccessCloseRef.current = null;
    onSuccessClose?.();
  }, []);

  const confirmAction = useCallback(async () => {
    if (!confirm.action || loading) return;

    const { action, successTitle, successMessage, showSuccess } = confirm;

    setLoading(true);
    try {
      const result = await action();
      setConfirm(initialConfirmState);
      if (showSuccess) {
        setSuccess({
          open: true,
          title: successTitle,
          message:
            typeof result === "string" && result.trim() ? result.trim() : successMessage,
        });
      }
    } catch {
      // Leave the confirm dialog open so the caller can show an inline error and retry.
    } finally {
      setLoading(false);
    }
  }, [confirm, loading]);

  return {
    confirm,
    success,
    loading,
    loadingMessage: confirm.loadingMessage,
    requestConfirm,
    cancelConfirm,
    dismissSuccess,
    confirmAction,
  };
}
