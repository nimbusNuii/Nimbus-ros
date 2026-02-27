import { MAX_BASE64_IMAGE_BYTES, dataUrlByteSize } from "@/lib/image-data-url";

const DEFAULT_MAX_SIDE = 360;
const DEFAULT_MIN_SIDE = 72;
const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Cannot read image file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot load image"));
    image.src = source;
  });
}

type OptimizeSquareImageOptions = {
  maxBytes?: number;
  maxSide?: number;
  minSide?: number;
};

export async function optimizeSquareImageFile(file: File, options?: OptimizeSquareImageOptions) {
  const maxBytes = options?.maxBytes || MAX_BASE64_IMAGE_BYTES;
  const maxSide = options?.maxSide || DEFAULT_MAX_SIDE;
  const minSide = options?.minSide || DEFAULT_MIN_SIDE;
  const src = await readFileAsDataUrl(file);
  const image = await loadImage(src);

  const cropSize = Math.min(image.width, image.height);
  const sourceX = Math.max(0, Math.floor((image.width - cropSize) / 2));
  const sourceY = Math.max(0, Math.floor((image.height - cropSize) / 2));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot process image");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  let side = Math.min(maxSide, cropSize);
  while (side >= minSide) {
    canvas.width = side;
    canvas.height = side;
    context.clearRect(0, 0, side, side);
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, side, side);

    for (const quality of QUALITY_STEPS) {
      const output = canvas.toDataURL("image/jpeg", quality);
      const bytes = dataUrlByteSize(output);
      if (bytes <= maxBytes) {
        return {
          dataUrl: output,
          bytes,
          width: side,
          height: side
        };
      }
    }

    side = Math.floor(side * 0.85);
  }

  throw new Error(`Cannot compress image <= ${Math.ceil(maxBytes / 1024)}KB. กรุณาใช้รูปที่เรียบง่ายขึ้น`);
}
