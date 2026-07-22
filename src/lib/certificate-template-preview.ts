"use client";

type PdfJsModule = typeof import("pdfjs-dist");

let workerConfigured = false;

async function getPdfJs(): Promise<PdfJsModule> {
  const pdfjs = await import("pdfjs-dist");

  if (!workerConfigured && typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    workerConfigured = true;
  }

  return pdfjs;
}

export async function renderPdfPageToDataUrl(
  source: string | ArrayBuffer,
  pageNumber = 1,
  scale = 1.5
): Promise<string> {
  const pdfjs = await getPdfJs();
  const loadingTask =
    typeof source === "string"
      ? pdfjs.getDocument({ url: source })
      : pdfjs.getDocument({ data: source });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create canvas for PDF preview.");
  }

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/png");
}

export async function renderCertificateTemplatePreview(
  fileUrl: string,
  fileType: "image" | "pdf"
): Promise<string> {
  if (fileType === "image") {
    return fileUrl;
  }

  return renderPdfPageToDataUrl(fileUrl);
}
