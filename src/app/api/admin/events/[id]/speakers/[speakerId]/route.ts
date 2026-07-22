import { NextResponse } from "next/server";
import { deleteEventSpeaker, getEventById, updateEventSpeaker } from "@/lib/events";
import { parseSpeakerRequest } from "@/lib/speaker-request";
import { deleteUploadedFile, saveSpeakerPhoto } from "@/lib/uploads";

interface RouteParams {
  params: Promise<{ id: string; speakerId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id, speakerId } = await params;
    const { input, file } = await parseSpeakerRequest(request);
    let event = await updateEventSpeaker(id, speakerId, input);

    if (!event) {
      return NextResponse.json({ error: "Speaker not found." }, { status: 404 });
    }

    if (file) {
      const current = (await getEventById(id))?.speakers.find(
        (speaker) => speaker.id === speakerId
      );
      if (current?.imageUrl) {
        await deleteUploadedFile(current.imageUrl);
      }

      const imageUrl = await saveSpeakerPhoto(id, speakerId, file);
      event = (await updateEventSpeaker(id, speakerId, { imageUrl })) ?? event;
    }

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update speaker.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, speakerId } = await params;
  const event = await deleteEventSpeaker(id, speakerId);

  if (!event) {
    return NextResponse.json({ error: "Speaker not found." }, { status: 404 });
  }

  return NextResponse.json({ event });
}
