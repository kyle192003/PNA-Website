import type { EventSpeakerInput } from "@/lib/types/admin";
import { readJsonBody } from "@/lib/security/safe-input";

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

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  return {
    input: {
      name: typeof parsed.data.name === "string" ? parsed.data.name : "",
      title: typeof parsed.data.title === "string" ? parsed.data.title : "",
      organization: typeof parsed.data.organization === "string" ? parsed.data.organization : "",
    },
    file: null,
  };
}
