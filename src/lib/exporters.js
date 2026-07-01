import { getPaperSize } from "./schematic";

const DPI = 300;

export function downloadTextFile(content, filename, type) {
  const blob = new Blob([content], { type });
  downloadBlob(blob, filename);
}

export async function downloadPng(svg, orientation, filename = "haptic-map-schematic.png") {
  const paper = getPaperSize(orientation);
  const canvas = await svgToCanvas(svg, paper, DPI);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  downloadBlob(blob, filename);
}

export async function downloadPdf(svg, orientation, filename = "haptic-map-schematic-a4.pdf") {
  const paper = getPaperSize(orientation);
  const canvas = await svgToCanvas(svg, paper, 220);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
  const jpegBytes = base64ToBytes(dataUrl.split(",")[1]);
  const blob = createSingleImagePdf(jpegBytes, canvas.width, canvas.height, paper);
  downloadBlob(blob, filename);
}

async function svgToCanvas(svg, paper, dpi) {
  const pxPerMm = dpi / 25.4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(paper.width * pxPerMm);
  canvas.height = Math.round(paper.height * pxPerMm);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const image = new Image();
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Could not render SVG for export."));
      image.src = url;
    });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }

  return canvas;
}

function createSingleImagePdf(jpegBytes, imageWidth, imageHeight, paperMm) {
  const pageWidth = mmToPt(paperMm.width);
  const pageHeight = mmToPt(paperMm.height);
  const chunks = [];
  const offsets = [0];
  let size = 0;

  const addBytes = (bytes) => {
    chunks.push(bytes);
    size += bytes.length;
  };
  const addAscii = (text) => addBytes(new TextEncoder().encode(text));
  const addObject = (id, body) => {
    offsets[id] = size;
    addAscii(`${id} 0 obj\n${body}\nendobj\n`);
  };

  addAscii("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  );

  offsets[4] = size;
  addAscii(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  addBytes(jpegBytes);
  addAscii("\nendstream\nendobj\n");

  const stream = `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ`;
  addObject(5, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

  const xrefOffset = size;
  addAscii(`xref\n0 6\n0000000000 65535 f \n`);
  for (let id = 1; id <= 5; id += 1) {
    addAscii(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  addAscii(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  if (!blob) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function mmToPt(value) {
  return (value / 25.4) * 72;
}
