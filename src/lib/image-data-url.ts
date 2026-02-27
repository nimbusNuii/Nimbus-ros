const DATA_URL_IMAGE_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i;

export const MAX_BASE64_IMAGE_BYTES = 10 * 1024;

export function dataUrlByteSize(dataUrl: string) {
  const parts = dataUrl.split(",", 2);
  if (parts.length !== 2) return 0;
  const base64 = parts[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

type NormalizeImageOptions = {
  allowHttp?: boolean;
  maxBytes?: number;
};

export function normalizeImageValue(raw?: string | null, options?: NormalizeImageOptions) {
  const value = raw?.trim() || "";
  if (!value) return null;

  const allowHttp = options?.allowHttp !== false;
  const maxBytes = options?.maxBytes || MAX_BASE64_IMAGE_BYTES;

  if (value.startsWith("data:image/")) {
    if (!DATA_URL_IMAGE_PATTERN.test(value)) {
      throw new Error("Invalid base64 image");
    }

    if (dataUrlByteSize(value) > maxBytes) {
      throw new Error(`Image must be <= ${Math.ceil(maxBytes / 1024)}KB`);
    }

    return value;
  }

  if (allowHttp && (value.startsWith("http://") || value.startsWith("https://"))) {
    return value;
  }

  throw new Error("Unsupported image format");
}
