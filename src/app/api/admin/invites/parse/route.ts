import { NextResponse } from "next/server";
import { parseSpecialInviteFile } from "@/lib/special-invite-import";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please choose a file to import." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseSpecialInviteFile({
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No invite rows were found. Use columns First Name, Email, and Role (Committee or Guest Speaker).",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      rows,
      count: rows.length,
      message: `Imported ${rows.length} row${rows.length === 1 ? "" : "s"} for review. Nothing has been sent yet.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not read that file. Try Excel (.xlsx), CSV, or PDF.",
      },
      { status: 400 }
    );
  }
}
