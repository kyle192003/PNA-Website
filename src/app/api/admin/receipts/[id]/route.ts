import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { getRegistrationById } from "@/lib/registrations";
import { resolveReceiptFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
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
