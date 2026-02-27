"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  getCenteredSquareCrop,
  optimizeSquareImageDataUrl,
  readImageFileForCrop,
  type SquareCrop
} from "@/lib/client-image-upload";

type ImageCropModalProps = {
  open: boolean;
  file: File | null;
  title: string;
  description?: string;
  onCancel: () => void;
  onApply: (payload: { dataUrl: string; info: string }) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ImageCropModal({ open, file, title, description, onCancel, onApply }: ImageCropModalProps) {
  const [source, setSource] = useState("");
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [crop, setCrop] = useState<SquareCrop | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [displayWidth, setDisplayWidth] = useState(0);
  const [displayHeight, setDisplayHeight] = useState(0);
  const [dragState, setDragState] = useState<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    size: number;
  } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const displayCrop = useMemo(() => {
    if (!crop || !imageWidth || !imageHeight || !displayWidth || !displayHeight) return null;
    const scaleX = displayWidth / imageWidth;
    const scaleY = displayHeight / imageHeight;
    return {
      left: crop.x * scaleX,
      top: crop.y * scaleY,
      width: crop.size * scaleX,
      height: crop.size * scaleY
    };
  }, [crop, displayHeight, displayWidth, imageHeight, imageWidth]);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setPreviewDataUrl("");
    setZoomPercent(100);
    setDisplayWidth(0);
    setDisplayHeight(0);
    setDragState(null);

    void readImageFileForCrop(file)
      .then((payload) => {
        if (cancelled) return;
        setSource(payload.source);
        setImageWidth(payload.width);
        setImageHeight(payload.height);
        setCrop(getCenteredSquareCrop(payload.width, payload.height));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Cannot load image");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file, open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      const target = imageRef.current;
      if (!target) return;
      setDisplayWidth(target.clientWidth);
      setDisplayHeight(target.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  useEffect(() => {
    if (!source || !crop) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const side = 220;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = side;
      canvas.height = side;
      context.clearRect(0, 0, side, side);
      context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, side, side);
      setPreviewDataUrl(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => {
      if (!cancelled) setPreviewDataUrl("");
    };
    image.src = source;
    return () => {
      cancelled = true;
    };
  }, [crop, source]);

  function setZoom(nextZoom: number) {
    if (!crop || !imageWidth || !imageHeight) return;
    const safeZoom = clamp(nextZoom, 100, 300);
    const minSide = Math.min(imageWidth, imageHeight);
    const nextSize = Math.max(1, Math.floor(minSide / (safeZoom / 100)));
    const centerX = crop.x + crop.size / 2;
    const centerY = crop.y + crop.size / 2;
    const maxX = Math.max(0, imageWidth - nextSize);
    const maxY = Math.max(0, imageHeight - nextSize);
    setZoomPercent(safeZoom);
    setCrop({
      x: clamp(Math.round(centerX - nextSize / 2), 0, maxX),
      y: clamp(Math.round(centerY - nextSize / 2), 0, maxY),
      size: nextSize
    });
  }

  function onCropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!crop) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: crop.x,
      startY: crop.y,
      size: crop.size
    });
  }

  function onCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (!displayWidth || !displayHeight || !imageWidth || !imageHeight) return;
    const sourcePerDisplayX = imageWidth / displayWidth;
    const sourcePerDisplayY = imageHeight / displayHeight;
    const deltaX = (event.clientX - dragState.startClientX) * sourcePerDisplayX;
    const deltaY = (event.clientY - dragState.startClientY) * sourcePerDisplayY;
    const maxX = Math.max(0, imageWidth - dragState.size);
    const maxY = Math.max(0, imageHeight - dragState.size);
    setCrop({
      x: clamp(Math.round(dragState.startX + deltaX), 0, maxX),
      y: clamp(Math.round(dragState.startY + deltaY), 0, maxY),
      size: dragState.size
    });
  }

  function onCropPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
  }

  async function applyCrop() {
    if (!source || !crop) return;
    setApplying(true);
    setError("");
    try {
      const resized = await optimizeSquareImageDataUrl(source, crop);
      const sizeKb = (resized.bytes / 1024).toFixed(1);
      onApply({
        dataUrl: resized.dataUrl,
        info: `รูป 1:1 ${resized.width}x${resized.height} ~${sizeKb} KB`
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot process image");
    } finally {
      setApplying(false);
    }
  }

  if (!open || !file) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="modal-panel w-full max-w-3xl">
        <div className="modal-header">
          <div>
            <h3 className="m-0 text-lg font-semibold">{title}</h3>
            <p className="m-0 mt-1 text-sm text-[var(--muted)]">{description || "ปรับตำแหน่งครอป แล้วบันทึกรูป"}</p>
          </div>
          <button type="button" className="secondary" onClick={onCancel}>
            ปิด
          </button>
        </div>

        {loading ? <p className="text-sm text-[var(--muted)]">กำลังโหลดรูป...</p> : null}

        {!loading && source ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                  ต้นฉบับ {imageWidth}x{imageHeight} | ลากกรอบสี่เหลี่ยมเพื่อเลือกตำแหน่ง
                </p>
                <div className="relative mx-auto inline-block max-w-full rounded-lg border border-[var(--line)] bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={source}
                    alt="Crop source"
                    className="block max-h-[320px] w-auto max-w-full rounded-lg object-contain"
                    onLoad={(event) => {
                      setDisplayWidth(event.currentTarget.clientWidth);
                      setDisplayHeight(event.currentTarget.clientHeight);
                    }}
                  />
                  {displayCrop ? (
                    <div
                      className={`absolute rounded border-2 border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] ${
                        dragState ? "cursor-grabbing" : "cursor-grab"
                      }`}
                      style={{
                        left: `calc(0.5rem + ${displayCrop.left}px)`,
                        top: `calc(0.5rem + ${displayCrop.top}px)`,
                        width: `${displayCrop.width}px`,
                        height: `${displayCrop.height}px`
                      }}
                      onPointerDown={onCropPointerDown}
                      onPointerMove={onCropPointerMove}
                      onPointerUp={onCropPointerEnd}
                      onPointerCancel={onCropPointerEnd}
                    />
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <div>
                  <label htmlFor="cropZoom">ขยายกรอบครอป ({zoomPercent}%)</label>
                  <input
                    id="cropZoom"
                    type="range"
                    min={100}
                    max={300}
                    value={zoomPercent}
                    onChange={(event) => setZoom(Number(event.target.value))}
                  />
                </div>
              </div>
            </div>

            <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
              <p className="m-0 text-sm font-semibold text-[var(--text)]">พรีวิวหลังครอป</p>
              <div className="mt-2 grid place-items-center rounded-lg border border-[var(--line)] bg-white p-2">
                {previewDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewDataUrl} alt="Crop preview" className="h-[180px] w-[180px] rounded-lg object-cover" />
                ) : (
                  <p className="text-xs text-[var(--muted)]">ไม่มีตัวอย่าง</p>
                )}
              </div>
              <p className="mb-0 mt-2 text-xs text-[var(--muted)]">ระบบจะบีบภาพสุดท้ายไม่เกิน 10KB อัตโนมัติ</p>
            </aside>
          </div>
        ) : null}

        {error ? <p className="m-0 mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="secondary" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="button" disabled={loading || applying || !source || !crop} onClick={() => void applyCrop()}>
            {applying ? "กำลังครอป..." : "ยืนยันครอป"}
          </button>
        </div>
      </div>
    </div>
  );
}
