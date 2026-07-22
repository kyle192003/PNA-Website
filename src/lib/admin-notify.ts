import { conference } from "@/lib/conference";
import { isMailConfigured } from "@/lib/mail";
import { sendAdminInquiryNotification } from "@/lib/mail-templates";

export type InquiryNotifyPayload = {
  name: string;
  email: string;
  mobile: string;
  message: string;
  inquiryId?: string;
  createdAt?: string;
};

async function notifyAdminViaWeb3Forms(
  payload: InquiryNotifyPayload
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY?.trim();
  if (!accessKey) {
    return { ok: false, skipped: true, error: "WEB3FORMS_ACCESS_KEY is not set." };
  }

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `New PNA inquiry from ${payload.name}`,
        from_name: "PNA Website Inquiries",
        replyto: payload.email,
        email: payload.email,
        name: payload.name,
        phone: payload.mobile,
        message: [
          `A new contact inquiry was submitted on the PNA website.`,
          "",
          `Name: ${payload.name}`,
          `Email: ${payload.email}`,
          `Mobile: ${payload.mobile}`,
          payload.inquiryId ? `Inquiry ID: ${payload.inquiryId}` : null,
          payload.createdAt ? `Submitted: ${payload.createdAt}` : null,
          "",
          "Message:",
          payload.message,
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    });

    const raw = await response.text();
    let data: { success?: boolean; message?: string } | null = null;
    try {
      data = JSON.parse(raw) as { success?: boolean; message?: string };
    } catch {
      const preview = raw.slice(0, 120).replace(/\s+/g, " ");
      return {
        ok: false,
        error: `Web3Forms returned a non-JSON response (${response.status}): ${preview}`,
      };
    }

    if (!response.ok || data?.success === false) {
      const error = data?.message || `Web3Forms request failed (${response.status}).`;
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to notify admin via Web3Forms.";
    return { ok: false, error: message };
  }
}

/**
 * Sends an admin inquiry alert. Uses SMTP when configured (recommended), then
 * falls back to Web3Forms if SMTP is unavailable.
 */
export async function notifyAdminOfInquiry(
  payload: InquiryNotifyPayload
): Promise<{ ok: boolean; skipped?: boolean; error?: string; channel?: "smtp" | "web3forms" }> {
  if (isMailConfigured()) {
    const smtpResult = await sendAdminInquiryNotification(payload);
    if (smtpResult.ok) {
      return { ok: true, channel: "smtp" };
    }
    console.error("[admin-notify] SMTP inquiry alert failed:", smtpResult.error);
  }

  const web3Result = await notifyAdminViaWeb3Forms(payload);
  if (web3Result.ok) {
    return { ok: true, channel: "web3forms" };
  }

  if (web3Result.skipped && !isMailConfigured()) {
    console.warn(
      `[admin-notify] No delivery channel configured. Set SMTP_HOST/SMTP_FROM or WEB3FORMS_ACCESS_KEY. Default admin email: ${conference.contact.email}`
    );
    return { ok: false, skipped: true, error: "No inquiry notification channel is configured." };
  }

  const error = web3Result.error || "Failed to send inquiry notification.";
  console.error("[admin-notify] inquiry alert failed:", error);
  return { ok: false, error };
}
