import { NextResponse } from "next/server";
import { getCertificateTemplate, saveCertificateTemplate } from "@/lib/certificate-template";
import { saveCertificateTemplateFile } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const eventIdRaw = formData.get("eventId");
    const eventId =
      typeof eventIdRaw === "string" && eventIdRaw.trim() ? eventIdRaw.trim() : null;

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Certificate template file is required." }, { status: 400 });
    }

    const saved = await saveCertificateTemplateFile(file, eventId);
    const current = await getCertificateTemplate(eventId);
    const template = await saveCertificateTemplate(
      {
        ...current,
        fileType: saved.fileType,
        imageUrl: saved.fileUrl,
      },
      eventId
    );

    return NextResponse.json({
      template,
      eventId,
      fileUrl: saved.fileUrl,
      fileType: saved.fileType,
      imageUrl: saved.fileUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload certificate template.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
