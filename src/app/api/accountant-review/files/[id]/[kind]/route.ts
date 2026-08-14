import { NextResponse } from "next/server";
import { getRegistrationById } from "@/lib/registrations";
import {
  readResolvedFile,
  resolveReceiptFile,
  resolveRegistrationDocument,
  type RegistrationDocKind,
} from "@/lib/uploads";
import { authorizeAccountantToken, tokenFromSearch } from "@/lib/accountant-share";

export const dynamic = "force-dynamic";

const DOC_KINDS: RegistrationDocKind[] = ["pnaId", "prcId", "bir2303", "bir2307", "seniorPwdId"];

type RouteParams = { params: Promise<{ id: string; kind: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await authorizeAccountantToken(tokenFromSearch(request));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, kind } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Participant id is required." }, { status: 400 });
  }

  const registration = await getRegistrationById(id.trim());
  if (!registration) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  const file =
    kind === "receipt"
      ? await resolveReceiptFile(registration.id, registration.receiptUrl)
      : DOC_KINDS.includes(kind as RegistrationDocKind)
        ? await resolveRegistrationDocument(
            registration.id,
            kind as RegistrationDocKind,
            kind === "pnaId"
              ? registration.pnaIdUrl
              : kind === "prcId"
                ? registration.prcIdUrl
                : kind === "bir2303"
                  ? registration.bir2303Url
                  : kind === "bir2307"
                    ? registration.bir2307Url
                    : registration.seniorPwdIdUrl
          )
        : null;

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
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
