import { NextResponse } from "next/server";
import { addEventSpeaker, updateEventSpeaker } from "@/lib/events";
import { parseSpeakerRequest } from "@/lib/speaker-request";
import { requireAdminSession } from "@/lib/security/require-admin";
import { saveSpeakerPhoto } from "@/lib/uploads";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const { input, file } = await parseSpeakerRequest(request);
    let event = await addEventSpeaker(id, input);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (file) {
      const speaker = event.speakers.at(-1);
      if (speaker) {
        const imageUrl = await saveSpeakerPhoto(id, speaker.id, file);
        event = (await updateEventSpeaker(id, speaker.id, { imageUrl })) ?? event;
      }
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add speaker.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
