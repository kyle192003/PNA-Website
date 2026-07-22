import type { EventSpeakerInput } from "@/lib/types/admin";

export async function parseSpeakerRequest(
  request: Request
): Promise<{ input: EventSpeakerInput; file: File | null }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const uploadedFile =
      file instanceof File && file.size > 0 ? file : null;

    return {
      input: {
        name: String(formData.get("name") ?? ""),
        title: String(formData.get("title") ?? ""),
        organization: String(formData.get("organization") ?? ""),
      },
      file: uploadedFile,
    };
  }

  const body = (await request.json()) as EventSpeakerInput;
  return { input: body, file: null };
}
