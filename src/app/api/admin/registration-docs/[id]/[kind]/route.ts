import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { getRegistrationById } from "@/lib/registrations";
import { requireAdminSession } from "@/lib/security/require-admin";
import {
  resolveRegistrationDocument,
  type RegistrationDocKind,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";

const KINDS: RegistrationDocKind[] = ["pnaId", "prcId", "bir2303", "bir2307", "seniorPwdId"];

type RouteParams = { params: Promise<{ id: string; kind: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id, kind } = await params;
  if (!id?.trim() || !KINDS.includes(kind as RegistrationDocKind)) {
    return NextResponse.json({ error: "Invalid document request." }, { status: 400 });
  }

  const registration = await getRegistrationById(id.trim());
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const storedRef =
    kind === "pnaId"
      ? registration.pnaIdUrl
      : kind === "prcId"
        ? registration.prcIdUrl
        : kind === "bir2303"
          ? registration.bir2303Url
          : kind === "bir2307"
            ? registration.bir2307Url
            : registration.seniorPwdIdUrl;

  const file = await resolveRegistrationDocument(
    registration.id,
    kind as RegistrationDocKind,
    storedRef
  );
  if (!file) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const data = await fs.readFile(file.absolutePath);
  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
