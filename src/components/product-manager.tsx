"use client";

import { ChangeEvent, FormEvent, useCallback, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  categoryId: string | null;
  category: string | null;
  imageUrl: string | null;
  price: number;
  cost: number;
  stockQty: number;
  isActive: boolean;
};

type ProductCategory = {
  id: string;
  name: string;
};

type ProductManagerProps = {
  initialProducts: Product[];
  initialCategories: ProductCategory[];
  currency: string;
};

const IMAGE_MAX_SIDE = 720;
const TARGET_DATA_URL_LENGTH = 320_000;
const MIN_QUALITY = 0.55;

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

async function resizeImageFile(file: File) {
  const src = await readFileAsDataUrl(file);
  const image = await loadImage(src);
  const ratio = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot process image");

  ctx.drawImage(image, 0, 0, width, height);
  let quality = 0.82;
  let output = canvas.toDataURL("image/jpeg", quality);
  while (output.length > TARGET_DATA_URL_LENGTH && quality > MIN_QUALITY) {
    quality -= 0.08;
    output = canvas.toDataURL("image/jpeg", quality);
  }

  return output;
}

export function ProductManager({ initialProducts, initialCategories, currency }: ProductManagerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [categories] = useState(initialCategories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [stockAdjust, setStockAdjust] = useState<Record<string, number>>({});
  const [imageData, setImageData] = useState("");
  const [imageInfo, setImageInfo] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const reloadProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as Product[];
      setProducts(data);
    } catch {
      // keep current state if refresh fails
    }
  }, []);

  useRealtime((event) => {
    if (
      event.type === "product.updated" ||
      event.type === "stock.updated" ||
      event.type === "order.created" ||
      event.type === "order.updated"
    ) {
      void reloadProducts();
    }
  });

  async function onImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setImageData("");
      setImageInfo("");
      return;
    }

    setProcessingImage(true);
    setError("");
    try {
      const resized = await resizeImageFile(file);
      const sizeKb = Math.round((resized.length * 0.75) / 1024);
      setImageData(resized);
      setImageInfo(`ไฟล์ถูกย่อและแปลงแล้ว ~${sizeKb} KB`);
    } catch (err) {
      setImageData("");
      setImageInfo("");
      setError(err instanceof Error ? err.message : "Cannot process image");
    } finally {
      setProcessingImage(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: form.get("sku"),
          name: form.get("name"),
          categoryId: form.get("categoryId"),
          imageData,
          price: Number(form.get("price")),
          cost: Number(form.get("cost")),
          stockQty: Number(form.get("stockQty"))
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Cannot create product");
      }

      setProducts((prev) => [data, ...prev]);
      event.currentTarget.reset();
      setImageData("");
      setImageInfo("");
      setFileInputKey((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create product");
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock(productId: string) {
    const deltaQty = Math.trunc(stockAdjust[productId] || 0);
    if (!deltaQty) return;

    setAdjustingId(productId);
    setError("");

    try {
      const response = await fetch(`/api/products/${productId}/stock`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deltaQty,
          reason: deltaQty > 0 ? "RESTOCK" : "ADJUST"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Cannot adjust stock");
      }

      setProducts((prev) =>
        prev.map((product) => (product.id === productId ? { ...product, stockQty: data.stockQty } : product))
      );
      setStockAdjust((prev) => ({ ...prev, [productId]: 0 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot adjust stock");
    } finally {
      setAdjustingId(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">เพิ่มสินค้า</h2>
        <form onSubmit={onSubmit} className="space-y-2">
          <div className="field">
            <label htmlFor="sku">SKU</label>
            <input id="sku" name="sku" />
          </div>
          <div className="field">
            <label htmlFor="name">ชื่อสินค้า *</label>
            <input id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="categoryId">หมวดหมู่</label>
            <select id="categoryId" name="categoryId" defaultValue="">
              <option value="">ไม่ระบุหมวดหมู่</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <p className="mb-0 mt-1 text-xs text-[var(--muted)]">
              จัดการหมวดหมู่เพิ่มเติมได้ที่เมนู Manage &gt; Categories
            </p>
          </div>
          <div className="field">
            <label htmlFor="imageFile">รูปสินค้า (ไฟล์)</label>
            <input
              key={fileInputKey}
              id="imageFile"
              type="file"
              accept="image/*"
              onChange={onImageFileChange}
              disabled={processingImage}
            />
            <p className="mb-0 mt-1 text-xs text-[var(--muted)]">
              ระบบจะย่อรูปอัตโนมัติและเก็บเป็น base64 เพื่อให้ใช้งานเร็วขึ้น
            </p>
          </div>
          {imageData ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
              <p className="mb-2 text-xs text-[var(--muted)]">{imageInfo}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageData} alt="Preview" className="h-28 w-full rounded-lg object-cover" />
              <button
                type="button"
                className="secondary mt-2"
                onClick={() => {
                  setImageData("");
                  setImageInfo("");
                  setFileInputKey((prev) => prev + 1);
                }}
              >
                ลบรูป
              </button>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="price">ราคาขาย *</label>
            <input id="price" name="price" type="number" min={0} step="0.01" required />
          </div>
          <div className="field">
            <label htmlFor="cost">ต้นทุนต่อหน่วย *</label>
            <input id="cost" name="cost" type="number" min={0} step="0.01" required />
          </div>
          <div className="field">
            <label htmlFor="stockQty">สต็อกเริ่มต้น *</label>
            <input id="stockQty" name="stockQty" type="number" min={0} step={1} defaultValue={0} required />
          </div>
          <button disabled={saving || processingImage}>
            {saving ? "กำลังบันทึก..." : processingImage ? "กำลังย่อรูป..." : "บันทึกสินค้า"}
          </button>
        </form>
        {error ? <p className="mt-2 text-red-600">{error}</p> : null}
      </section>

      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">รายการสินค้า</h2>
        <div className="overflow-x-auto">
          <table className="table min-w-[880px]">
            <thead>
              <tr>
                <th>รูป</th>
                <th>ชื่อ</th>
                <th>หมวดหมู่</th>
                <th>ราคา</th>
                <th>ต้นทุน</th>
                <th>สต็อก</th>
                <th>ปรับสต็อก</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-12 w-12 rounded-md border border-[var(--line)] object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-md border border-dashed border-[var(--line)] text-[10px] text-[var(--muted)]">
                        No Img
                      </div>
                    )}
                  </td>
                  <td>{product.name}</td>
                  <td>{product.category || "-"}</td>
                  <td>{formatCurrency(product.price, currency)}</td>
                  <td>{formatCurrency(product.cost, currency)}</td>
                  <td>{product.stockQty}</td>
                  <td>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step={1}
                        value={stockAdjust[product.id] || 0}
                        onChange={(event) =>
                          setStockAdjust((prev) => ({
                            ...prev,
                            [product.id]: Math.trunc(Number(event.target.value))
                          }))
                        }
                        className="w-20"
                      />
                      <button
                        type="button"
                        className="secondary"
                        disabled={adjustingId === product.id}
                        onClick={() => adjustStock(product.id)}
                      >
                        {adjustingId === product.id ? "..." : "บันทึก"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
