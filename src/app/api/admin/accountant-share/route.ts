import { NextResponse } from "next/server";
import {
  createAccountantShareLink,
  getAccountantShareLink,
  parseEmailList,
  updateAccountantShareSettings,
} from "@/lib/accountant-share";
import {
  ACCOUNTANT_SHARE_MAX_EXPIRY_DAYS,
  ACCOUNTANT_SHARE_MIN_EXPIRY_DAYS,
} from "@/lib/accountant-share-token";
import { sendAccountantShareNow } from "@/lib/accountant-weekly-send";
import { requireAdminSession } from "@/lib/security/require-admin";
import { booleanField, readJsonBody, stringField } from "@/lib/security/safe-input";
import { getEmailValidationError } from "@/lib/form-validation";

export const dynamic = "force-dynamic";

function numberField(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function validateEmails(emails: string[]): string | null {
  if (!emails.length) return null;
  for (const email of emails) {
    const error = getEmailValidationError(email, "Accounting email");
    if (error) return error;
  }
  return null;
}

function parseWeeklySend(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const data = raw as Record<string, unknown>;
  return {
    enabled: booleanField(data.enabled),
    dayOfWeek: numberField(data.dayOfWeek),
    hour: numberField(data.hour),
  };
}

/** Accept YYYY-MM-DD or full ISO; normalize to end-of-day Asia/Manila when date-only. */
function parseExpiresAt(raw: unknown): string | undefined {
  const value = stringField(raw)?.trim();
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const endOfDay = Date.parse(`${value}T23:59:59+08:00`);
    if (!Number.isFinite(endOfDay) || endOfDay <= Date.now()) return undefined;
    return new Date(endOfDay).toISOString();
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= Date.now()) return undefined;
  return new Date(parsed).toISOString();
}

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const result = await getAccountantShareLink();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const notifyEmails =
      parsed.data.notifyEmails !== undefined || parsed.data.notifyEmail !== undefined
        ? parseEmailList(parsed.data.notifyEmails ?? parsed.data.notifyEmail)
        : undefined;
    if (notifyEmails) {
      const emailError = validateEmails(notifyEmails);
      if (emailError) {
        return NextResponse.json({ error: emailError }, { status: 400 });
      }
    }

    const expiryDays = numberField(parsed.data.expiryDays);
    if (expiryDays !== undefined) {
      if (
        expiryDays < ACCOUNTANT_SHARE_MIN_EXPIRY_DAYS ||
        expiryDays > ACCOUNTANT_SHARE_MAX_EXPIRY_DAYS
      ) {
        return NextResponse.json(
          {
            error: `Link expiry must be between ${ACCOUNTANT_SHARE_MIN_EXPIRY_DAYS} and ${ACCOUNTANT_SHARE_MAX_EXPIRY_DAYS} days.`,
          },
          { status: 400 }
        );
      }
    }

    const expiresAt = parseExpiresAt(parsed.data.expiresAt);
    if (parsed.data.expiresAt !== undefined && !expiresAt) {
      return NextResponse.json(
        { error: "Pick a future expiry date on the calendar (up to 30 days ahead)." },
        { status: 400 }
      );
    }

    const weeklySend = parseWeeklySend(parsed.data.weeklySend);
    const result = await updateAccountantShareSettings({
      notifyEmails,
      expiryDays,
      expiresAt,
      weeklySend,
    });

    return NextResponse.json({
      ...result,
      emailed: false,
      message: "Accounting link settings saved. No email was sent.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const parsed = await readJsonBody(request).catch(() => null);
    const data = parsed && parsed.ok ? parsed.data : {};

    const action = stringField(data.action)?.trim().toLowerCase() || "create";
    const notifyEmails =
      data.notifyEmails !== undefined || data.notifyEmail !== undefined
        ? parseEmailList(data.notifyEmails ?? data.notifyEmail)
        : undefined;
    if (notifyEmails) {
      const emailError = validateEmails(notifyEmails);
      if (emailError) {
        return NextResponse.json({ error: emailError }, { status: 400 });
      }
    }

    const expiryDays = numberField(data.expiryDays);
    if (expiryDays !== undefined) {
      if (
        expiryDays < ACCOUNTANT_SHARE_MIN_EXPIRY_DAYS ||
        expiryDays > ACCOUNTANT_SHARE_MAX_EXPIRY_DAYS
      ) {
        return NextResponse.json(
          {
            error: `Link expiry must be between ${ACCOUNTANT_SHARE_MIN_EXPIRY_DAYS} and ${ACCOUNTANT_SHARE_MAX_EXPIRY_DAYS} days.`,
          },
          { status: 400 }
        );
      }
    }

    const expiresAt = parseExpiresAt(data.expiresAt);
    if (data.expiresAt !== undefined && data.expiresAt !== null && data.expiresAt !== "" && !expiresAt) {
      return NextResponse.json(
        { error: "Pick a future expiry date on the calendar (up to 30 days ahead)." },
        { status: 400 }
      );
    }

    const weeklySend = parseWeeklySend(data.weeklySend);
    const sendEmail = booleanField(data.sendEmail) === true;
    const createNewLink = booleanField(data.createNewLink) === true;

    if (action === "send" || sendEmail) {
      const sent = await sendAccountantShareNow({
        createNewLink,
        notifyEmails,
        expiryDays,
        expiresAt,
        weeklySend,
      });
      if (!sent.ok) {
        return NextResponse.json(
          {
            error: sent.error ?? "Could not send the accounting email.",
            ...sent.share,
            pendingCount: sent.pendingCount,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ...sent.share,
        pendingCount: sent.pendingCount,
        emailed: true,
        renewed: sent.renewed === true,
        message: sent.renewed
          ? `Previous link had expired, so a new review link was created and emailed to ${sent.share.notifyEmails.join(", ")}. The email includes the expiry date.`
          : `Accounting review link emailed to ${sent.share.notifyEmails.join(", ")}. The email includes the expiry date.`,
      });
    }

    const result = await createAccountantShareLink({
      notifyEmails,
      expiryDays,
      expiresAt,
      weeklySend,
      reuseActiveLink: !createNewLink,
    });

    return NextResponse.json({
      ...result,
      emailed: false,
      message: `Accountant review link created. It stays valid until ${result.expiresAt ? new Date(result.expiresAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" }) : `${result.expiryDays} days`}.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
