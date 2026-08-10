import { NextResponse } from "next/server";
import { emailsMatch } from "@/lib/security/email";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { getRegistrationByReference, updateRegistrationPayment } from "@/lib/registrations";
import { saveRegistrationDocument } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit(`register-docs:${ip}`, 20, 60_000);
    if (!limited.ok) {
      return rateLimitResponse(limited.retryAfterSeconds);
    }

    const formData = await request.formData();
    const referenceNumber = formData.get("referenceNumber")?.toString().trim().toUpperCase() ?? "";
    const email = formData.get("email")?.toString().trim() ?? "";

    if (!referenceNumber || !email) {
      return NextResponse.json(
        { error: "Reference number and email are required." },
        { status: 400 }
      );
    }

    const registration = await getRegistrationByReference(referenceNumber);
    if (!registration || !emailsMatch(registration.email, email)) {
      return NextResponse.json(
        { error: "No registration matched that reference number and email." },
        { status: 404 }
      );
    }

    const updates: {
      pnaIdUrl?: string | null;
      prcIdUrl?: string | null;
      bir2303Url?: string | null;
      bir2307Url?: string | null;
      seniorPwdIdUrl?: string | null;
    } = {};

    const pnaId = formData.get("pnaId");
    const prcId = formData.get("prcId");
    const bir2303 = formData.get("bir2303");
    const bir2307 = formData.get("bir2307");
    const seniorPwdId = formData.get("seniorPwdId");

    if (pnaId instanceof File && pnaId.size > 0) {
      updates.pnaIdUrl = await saveRegistrationDocument(registration.id, "pnaId", pnaId, {
        imagesOnly: true,
      });
    }
    if (prcId instanceof File && prcId.size > 0) {
      updates.prcIdUrl = await saveRegistrationDocument(registration.id, "prcId", prcId, {
        imagesOnly: true,
      });
    }
    if (bir2303 instanceof File && bir2303.size > 0) {
      updates.bir2303Url = await saveRegistrationDocument(registration.id, "bir2303", bir2303);
    }
    if (bir2307 instanceof File && bir2307.size > 0) {
      updates.bir2307Url = await saveRegistrationDocument(registration.id, "bir2307", bir2307);
    }
    if (seniorPwdId instanceof File && seniorPwdId.size > 0) {
      updates.seniorPwdIdUrl = await saveRegistrationDocument(
        registration.id,
        "seniorPwdId",
        seniorPwdId,
        { imagesOnly: true }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No documents were uploaded." }, { status: 400 });
    }

    await updateRegistrationPayment(registration.id, updates);
    return NextResponse.json({ message: "Documents uploaded." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload documents.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
