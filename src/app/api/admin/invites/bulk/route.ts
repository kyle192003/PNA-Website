import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { isMailConfigured } from "@/lib/mail";
import { sendSpecialInviteEmail } from "@/lib/mail-templates";
import { getEmailValidationError } from "@/lib/form-validation";
import {
  buildSpecialInviteUrl,
  createSpecialInvite,
  markSpecialInviteSent,
} from "@/lib/special-invites";
import type { SpecialRole } from "@/lib/types/admin";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody } from "@/lib/security/safe-input";

type BulkInviteInput = {
  firstName?: unknown;
  email?: unknown;
  specialRole?: unknown;
  note?: unknown;
};

function parseRole(value: unknown): SpecialRole | null {
  return value === "committee" || value === "speaker" ? value : null;
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.data;

  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  const invites = Array.isArray(body.invites) ? (body.invites as BulkInviteInput[]) : [];

  if (!eventId) {
    return NextResponse.json({ error: "Please select an event." }, { status: 400 });
  }
  if (invites.length === 0) {
    return NextResponse.json({ error: "Add at least one invite to send." }, { status: 400 });
  }
  if (invites.length > 300) {
    return NextResponse.json(
      { error: "Please send at most 300 invites at a time." },
      { status: 400 }
    );
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.status === "finished") {
    return NextResponse.json(
      { error: "Finished events cannot receive new special invites." },
      { status: 400 }
    );
  }

  const mailConfigured = isMailConfigured();
  const results: Array<{
    index: number;
    email: string;
    firstName: string;
    ok: boolean;
    mailSent: boolean;
    error?: string;
    inviteId?: string;
  }> = [];

  for (let index = 0; index < invites.length; index += 1) {
    const row = invites[index] ?? {};
    const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
    const firstName = typeof row.firstName === "string" ? row.firstName.trim() : "";
    const note = typeof row.note === "string" ? row.note.trim() : "";
    const specialRole = parseRole(row.specialRole);

    const emailError = getEmailValidationError(email);
    if (emailError || !firstName || !specialRole) {
      results.push({
        index,
        email,
        firstName,
        ok: false,
        mailSent: false,
        error:
          emailError ||
          (!firstName ? "First name is required." : null) ||
          "Please choose Committee or Guest Speaker.",
      });
      continue;
    }

    try {
      let invite = await createSpecialInvite({
        email,
        firstName,
        specialRole,
        eventId,
        note,
      });
      const inviteUrl = buildSpecialInviteUrl(invite.token);
      let mailSent = false;
      let mailError: string | undefined;

      if (!mailConfigured) {
        mailError = "Email is not configured. Invite was created; copy the link manually.";
      } else {
        const mail = await sendSpecialInviteEmail({
          to: invite.email,
          firstName: invite.firstName,
          specialRole: invite.specialRole,
          eventTitle: event.title,
          inviteUrl,
          note: invite.note || undefined,
        });
        mailSent = mail.ok;
        mailError = mail.ok ? undefined : mail.error || "Failed to send invite email.";
        if (mail.ok) {
          invite = (await markSpecialInviteSent(invite.id)) ?? invite;
        }
      }

      results.push({
        index,
        email,
        firstName,
        ok: true,
        mailSent,
        error: mailError,
        inviteId: invite.id,
      });
    } catch (error) {
      results.push({
        index,
        email,
        firstName,
        ok: false,
        mailSent: false,
        error: error instanceof Error ? error.message : "Could not create invite.",
      });
    }
  }

  const created = results.filter((row) => row.ok).length;
  const mailed = results.filter((row) => row.mailSent).length;
  const failed = results.filter((row) => !row.ok).length;

  return NextResponse.json({
    results,
    summary: {
      total: invites.length,
      created,
      mailed,
      failed,
    },
    message:
      failed > 0
        ? `Created ${created} invite${created === 1 ? "" : "s"} (${mailed} emailed). ${failed} need attention.`
        : `Created ${created} invite${created === 1 ? "" : "s"} and emailed ${mailed}.`,
  });
}
