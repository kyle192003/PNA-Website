import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export type ExportLogo = {
  png: Buffer;
  width: number;
  height: number;
};

export async function loadPnaLogo(size = 256): Promise<ExportLogo | null> {
  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "images",
      "pna-official-logo.png"
    );
    const source = await fs.readFile(logoPath);
    const png = await sharp(source)
      .resize(size, size, { fit: "contain" })
      .png()
      .toBuffer();

    return { png, width: size, height: size };
  } catch (error) {
    console.warn("[export] Could not load PNA logo:", error);
    return null;
  }
}
