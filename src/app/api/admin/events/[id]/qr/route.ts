import { NextResponse } from "next/server";
import { getEventById, setEventQrCode, updateEvent } from "@/lib/events";
import { saveQrCode } from "@/lib/uploads";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const highlight = formData.get("showQrInRegistration");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "QR image file is required." }, { status: 400 });
    }

    const qrCodeUrl = await saveQrCode(id, file);
    const updated = await setEventQrCode(id, qrCodeUrl);

    if (highlight !== null) {
      await updateEvent(id, {
        showQrInRegistration: highlight === "true" || highlight === "1",
      });
    } else {
      await updateEvent(id, { showQrInRegistration: true });
    }

    return NextResponse.json({ event: updated, qrCodeUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload QR code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
