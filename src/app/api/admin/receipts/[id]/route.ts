import { NextResponse } from "next/server";
import { getRegistrationById } from "@/lib/registrations";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readResolvedFile, resolveReceiptFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Registration id is required." }, { status: 400 });
  }

  const registration = await getRegistrationById(id.trim());
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const file = await resolveReceiptFile(registration.id, registration.receiptUrl);
  if (!file) {
    return NextResponse.json({ error: "Receipt file not found." }, { status: 404 });
  }

  const data = await readResolvedFile(file);
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
