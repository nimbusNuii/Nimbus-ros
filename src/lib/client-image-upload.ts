import { MAX_BASE64_IMAGE_BYTES, dataUrlByteSize } from "@/lib/image-data-url";

const DEFAULT_MAX_SIDE = 360;
const DEFAULT_MIN_SIDE = 72;
const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26];

export type SquareCrop = {
  x: number;
  y: number;
  size: number;
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSquareCrop(crop: SquareCrop, imageWidth: number, imageHeight: number) {
  const maxSize = Math.min(imageWidth, imageHeight);
  const size = clamp(Math.floor(crop.size), 1, maxSize);
  const x = clamp(Math.floor(crop.x), 0, Math.max(0, imageWidth - size));
  const y = clamp(Math.floor(crop.y), 0, Math.max(0, imageHeight - size));
  return { x, y, size };
}

export function getCenteredSquareCrop(imageWidth: number, imageHeight: number): SquareCrop {
  const size = Math.min(imageWidth, imageHeight);
  return {
    x: Math.max(0, Math.floor((imageWidth - size) / 2)),
    y: Math.max(0, Math.floor((imageHeight - size) / 2)),
    size
  };
}

export async function readImageFileForCrop(file: File) {
  const src = await readFileAsDataUrl(file);
  const image = await loadImage(src);
  return {
    source: src,
    width: image.width,
    height: image.height
  };
}

export async function optimizeSquareImageDataUrl(
  source: string,
  crop: SquareCrop,
  options?: OptimizeSquareImageOptions
) {
  const maxBytes = options?.maxBytes || MAX_BASE64_IMAGE_BYTES;
  const maxSide = options?.maxSide || DEFAULT_MAX_SIDE;
  const minSide = options?.minSide || DEFAULT_MIN_SIDE;
  const image = await loadImage(source);
  const normalized = normalizeSquareCrop(crop, image.width, image.height);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot process image");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  let side = Math.min(maxSide, normalized.size);
  while (side >= minSide) {
    canvas.width = side;
    canvas.height = side;
    context.clearRect(0, 0, side, side);
    context.drawImage(image, normalized.x, normalized.y, normalized.size, normalized.size, 0, 0, side, side);

    for (const quality of QUALITY_STEPS) {
      const output = canvas.toDataURL("image/jpeg", quality);
      const bytes = dataUrlByteSize(output);
      if (bytes <= maxBytes) {
        return {
          dataUrl: output,
          bytes,
          width: side,
          height: side,
          crop: normalized
        };
      }
    }

    side = Math.floor(side * 0.85);
  }

  throw new Error(`Cannot compress image <= ${Math.ceil(maxBytes / 1024)}KB. กรุณาใช้รูปที่เรียบง่ายขึ้น`);
}

export async function optimizeSquareImageFile(file: File, options?: OptimizeSquareImageOptions, crop?: SquareCrop) {
  const payload = await readImageFileForCrop(file);
  const safeCrop = crop ? normalizeSquareCrop(crop, payload.width, payload.height) : getCenteredSquareCrop(payload.width, payload.height);
  return optimizeSquareImageDataUrl(payload.source, safeCrop, options);
}
