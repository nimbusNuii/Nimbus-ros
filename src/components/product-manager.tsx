"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";
import { PaginationControls } from "@/components/pagination-controls";
import { ImageCropModal } from "@/components/image-crop-modal";

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
  sortOrder?: number;
};

type ProductManagerProps = {
  initialProducts: Product[];
  initialCategories: ProductCategory[];
  currency: string;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  initialQuery: string;
  initialSort: ProductSort;
};

type ProductSort =
  | "category_name"
  | "name_asc"
  | "name_desc"
  | "stock_asc"
  | "stock_desc"
  | "price_asc"
  | "price_desc";

type EditProductForm = {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  price: string;
  cost: string;
  stockQty: string;
  isActive: boolean;
};

export function ProductManager({
  initialProducts,
  initialCategories,
  currency,
  currentPage,
  pageSize,
  totalItems,
  initialQuery,
  initialSort
}: ProductManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState("");
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [addCategoryName, setAddCategoryName] = useState("");
  const [addCategorySortOrder, setAddCategorySortOrder] = useState(0);
  const [addCategorySaving, setAddCategorySaving] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState("");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [stockAdjust, setStockAdjust] = useState<Record<string, number>>({});
  const [imageData, setImageData] = useState("");
  const [imageInfo, setImageInfo] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [cropAddImageFile, setCropAddImageFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState<EditProductForm | null>(null);
  const [editImageData, setEditImageData] = useState("");
  const [editImageInfo, setEditImageInfo] = useState("");
  const [editFileInputKey, setEditFileInputKey] = useState(0);
  const [processingEditImage, setProcessingEditImage] = useState(false);
  const [cropEditImageFile, setCropEditImageFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [sortInput, setSortInput] = useState<ProductSort>(initialSort);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setQueryInput(initialQuery);
    setSortInput(initialSort);
  }, [initialQuery, initialSort]);

  function goPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    const safePage = Math.max(1, Math.trunc(nextPage));
    if (safePage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(safePage));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    const q = queryInput.trim();
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    if (sortInput === "category_name") {
      params.delete("sort");
    } else {
      params.set("sort", sortInput);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    setQueryInput("");
    setSortInput("category_name");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("sort");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function sortCategories(list: ProductCategory[]) {
    return [...list].sort((a, b) => {
      const sortA = a.sortOrder ?? 0;
      const sortB = b.sortOrder ?? 0;
      if (sortA !== sortB) return sortA - sortB;
      return a.name.localeCompare(b.name, "th");
    });
  }

  function openAddModal() {
    setError("");
    setImageData("");
    setImageInfo("");
    setAddCategoryId("");
    setFileInputKey((prev) => prev + 1);
    setAddModalOpen(true);
  }

  function closeAddModal() {
    setAddModalOpen(false);
    setAddCategoryModalOpen(false);
    setAddCategoryError("");
    setCropAddImageFile(null);
    setProcessingImage(false);
  }

  const reloadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("page", String(currentPage));
      const q = searchParams.get("q");
      const sort = searchParams.get("sort");
      if (q) params.set("q", q);
      if (sort) params.set("sort", sort);

      const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as Product[];
      setProducts(data);
    } catch {
      // keep current state if refresh fails
    }
  }, [currentPage, pageSize, searchParams]);

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
      setCropAddImageFile(null);
      setProcessingImage(false);
      return;
    }

    setError("");
    setProcessingImage(true);
    setCropAddImageFile(file);
  }

  function openEdit(product: Product) {
    setEditError("");
    setEditForm({
      id: product.id,
      sku: product.sku || "",
      name: product.name,
      categoryId: product.categoryId || "",
      price: String(product.price),
      cost: String(product.cost),
      stockQty: String(product.stockQty),
      isActive: product.isActive
    });
    setEditImageData(product.imageUrl || "");
    setEditImageInfo(product.imageUrl ? "ใช้รูปเดิม" : "");
    setEditFileInputKey((prev) => prev + 1);
  }

  function closeEdit() {
    setEditForm(null);
    setEditImageData("");
    setEditImageInfo("");
    setEditError("");
    setCropEditImageFile(null);
    setProcessingEditImage(false);
    setSavingEdit(false);
  }

  async function onEditImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setCropEditImageFile(null);
      setProcessingEditImage(false);
      return;
    }

    setEditError("");
    setProcessingEditImage(true);
    setCropEditImageFile(file);
  }

  async function onSubmitAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addCategorySaving) return;
    const name = addCategoryName.trim();
    if (!name) {
      setAddCategoryError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    setAddCategorySaving(true);
    setAddCategoryError("");
    try {
      const response = await fetch("/api/product-categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          sortOrder: addCategorySortOrder,
          isActive: true
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Cannot create category");
      }

      setCategories((prev) =>
        sortCategories([
          ...prev,
          {
            id: data.id,
            name: data.name,
            sortOrder: data.sortOrder
          }
        ])
      );
      setAddCategoryId(data.id);
      setAddCategoryName("");
      setAddCategorySortOrder(0);
      setAddCategoryModalOpen(false);
    } catch (err) {
      setAddCategoryError(err instanceof Error ? err.message : "Cannot create category");
    } finally {
      setAddCategorySaving(false);
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
          categoryId: addCategoryId || null,
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

      setProducts((prev) => [data, ...prev].slice(0, pageSize));
      goPage(1);
      router.refresh();
      event.currentTarget.reset();
      setImageData("");
      setImageInfo("");
      setAddCategoryId("");
      setFileInputKey((prev) => prev + 1);
      setAddModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create product");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm || savingEdit) return;

    setSavingEdit(true);
    setEditError("");
    setError("");
    try {
      const response = await fetch(`/api/products/${editForm.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: editForm.sku,
          name: editForm.name,
          categoryId: editForm.categoryId || null,
          imageData: editImageData,
          price: Number(editForm.price),
          cost: Number(editForm.cost),
          stockQty: Number(editForm.stockQty),
          isActive: editForm.isActive
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Cannot update product");
      }

      setProducts((prev) => prev.map((product) => (product.id === data.id ? data : product)));
      closeEdit();
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Cannot update product");
    } finally {
      setSavingEdit(false);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.2 }}>รายการสินค้า</h1>
          <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>{totalItems} รายการทั้งหมด</p>
        </div>
        <button type="button" onClick={openAddModal} style={{ whiteSpace: "nowrap" }}>
          + เพิ่มสินค้า
        </button>
      </div>

      {/* ── Filter bar ── */}
      <form
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
        onSubmit={(event) => { event.preventDefault(); applyFilters(); }}
      >
        <input
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="ค้นหาชื่อ / SKU / หมวดหมู่"
          style={{ flex: 1, minWidth: 160 }}
        />
        <select value={sortInput} onChange={(event) => setSortInput(event.target.value as ProductSort)} style={{ width: 200 }}>
          <option value="category_name">หมวดหมู่ + ชื่อ</option>
          <option value="name_asc">ชื่อ A–Z</option>
          <option value="name_desc">ชื่อ Z–A</option>
          <option value="stock_asc">สต็อกน้อย → มาก</option>
          <option value="stock_desc">สต็อกมาก → น้อย</option>
          <option value="price_asc">ราคาต่ำ → สูง</option>
          <option value="price_desc">ราคาสูง → ต่ำ</option>
        </select>
        <button type="submit">ค้นหา</button>
        <button type="button" className="secondary" onClick={resetFilters}>ล้าง</button>
      </form>

      {/* ── Error ── */}
      {error ? <p style={{ margin: 0, fontSize: "0.8rem", color: "#ef4444" }}>{error}</p> : null}

      {/* ── Mobile: list ── */}
      <div className="flex flex-col lg:hidden" style={{ gap: 8 }}>
        {products.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>ไม่พบสินค้า</div>
        ) : products.map((product) => (
          <div key={product.id} style={{ border: "1px solid var(--line)", borderRadius: 10, background: "#fff", overflow: "hidden", opacity: product.isActive ? 1 : 0.6 }}>
            {/* Top: image + info + edit button */}
            <div style={{ display: "flex", gap: 10, padding: "10px 12px", alignItems: "flex-start" }}>
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt={product.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, border: "1.5px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", color: "var(--muted)", flexShrink: 0 }}>–</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{product.name}</p>
                  <button type="button" className="secondary" onClick={() => openEdit(product)} style={{ fontSize: "0.7rem", padding: "3px 10px", flexShrink: 0 }}>
                    แก้ไข
                  </button>
                </div>
                {(product.category || product.sku) && (
                  <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "var(--muted)" }}>
                    {[product.category, product.sku ? `SKU: ${product.sku}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, fontSize: "0.75rem" }}>
                  <span style={{ color: "var(--muted)" }}>ราคา <span style={{ color: "var(--text)", fontWeight: 600 }}>{formatCurrency(product.price, currency)}</span></span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "var(--muted)" }}>สต็อก</span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: product.stockQty <= 5 ? "#ef4444" : product.stockQty <= 10 ? "#d97706" : "var(--text)" }}>{product.stockQty}</span>
                  </span>
                  {!product.isActive && <span style={{ fontSize: "0.62rem", background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "1px 7px", fontWeight: 600 }}>ปิด</span>}
                </div>
              </div>
            </div>

            {/* Bottom: stock stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "8px 12px", background: "var(--bg)", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", marginRight: 8, flexShrink: 0 }}>ปรับสต็อก</span>
              <button
                type="button"
                onClick={() => setStockAdjust((prev) => ({ ...prev, [product.id]: Math.max(-product.stockQty, (prev[product.id] || 0) - 1) }))}
                style={{ width: 36, height: 36, padding: 0, borderRadius: "8px 0 0 8px", border: "1px solid var(--line)", background: "#fff", color: "var(--text)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "none" }}
                aria-label="ลด"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="#1a1614" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
              <input
                type="number"
                step={1}
                min={-product.stockQty}
                value={stockAdjust[product.id] ?? 0}
                onChange={(event) => {
                  const val = Math.trunc(Number(event.target.value));
                  setStockAdjust((prev) => ({ ...prev, [product.id]: Math.max(-product.stockQty, val) }));
                }}
                style={{ width: 60, height: 36, border: "1px solid var(--line)", borderLeft: "none", borderRight: "none", textAlign: "center", fontSize: "0.9rem", fontWeight: 700, borderRadius: 0, padding: "0 4px" }}
              />
              <button
                type="button"
                onClick={() => setStockAdjust((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }))}
                style={{ width: 36, height: 36, padding: 0, borderRadius: "0 8px 8px 0", border: "1px solid var(--line)", background: "#fff", color: "var(--text)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "none" }}
                aria-label="เพิ่ม"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#1a1614" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
              <button
                type="button"
                className="secondary"
                disabled={adjustingId === product.id || !stockAdjust[product.id]}
                onClick={() => adjustStock(product.id)}
                style={{ marginLeft: 8, fontSize: "0.75rem", padding: "5px 14px", height: 32, flexShrink: 0 }}
              >
                {adjustingId === product.id ? "..." : "บันทึก"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop: table ── */}
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }} className="hidden lg:block">
        {products.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>ไม่พบสินค้า</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 960, margin: 0, borderRadius: 0, border: "none" }}>
              <thead>
                <tr>
                  <th style={{ width: 52 }}>รูป</th>
                  <th>ชื่อสินค้า</th>
                  <th>หมวดหมู่</th>
                  <th style={{ textAlign: "right" }}>ราคา</th>
                  <th style={{ textAlign: "right" }}>ต้นทุน</th>
                  <th style={{ textAlign: "right" }}>สต็อก</th>
                  <th style={{ width: 168 }}>ปรับสต็อก</th>
                  <th style={{ width: 76 }}></th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} style={{ opacity: product.isActive ? 1 : 0.55 }}>
                    <td>
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt={product.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, border: "1.5px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", color: "var(--muted)" }}>–</div>
                      )}
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>{product.name}</p>
                      {product.sku && <p style={{ margin: "1px 0 0", fontSize: "0.67rem", color: "var(--muted)" }}>SKU: {product.sku}</p>}
                      {!product.isActive && <span style={{ display: "inline-block", fontSize: "0.62rem", background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "0 6px", marginTop: 2, fontWeight: 600 }}>ปิดใช้งาน</span>}
                    </td>
                    <td>
                      {product.category ? (
                        <span style={{ fontSize: "0.72rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 20, padding: "2px 8px", color: "var(--muted)", whiteSpace: "nowrap" }}>{product.category}</span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>–</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.875rem" }}>{formatCurrency(product.price, currency)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.875rem", color: "var(--muted)" }}>{formatCurrency(product.cost, currency)}</td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", fontVariantNumeric: "tabular-nums", color: product.stockQty <= 5 ? "#ef4444" : product.stockQty <= 10 ? "#d97706" : "var(--text)" }}>
                        {product.stockQty}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="number"
                          step={1}
                          value={stockAdjust[product.id] || 0}
                          onChange={(event) => setStockAdjust((prev) => ({ ...prev, [product.id]: Math.trunc(Number(event.target.value)) }))}
                          style={{ width: 68 }}
                        />
                        <button type="button" className="secondary" disabled={adjustingId === product.id} onClick={() => adjustStock(product.id)} style={{ fontSize: "0.72rem", padding: "3px 8px", whiteSpace: "nowrap" }}>
                          {adjustingId === product.id ? "..." : "บันทึก"}
                        </button>
                      </div>
                    </td>
                    <td>
                      <button type="button" className="secondary" onClick={() => openEdit(product)} style={{ fontSize: "0.72rem", padding: "3px 10px" }}>
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      <PaginationControls page={currentPage} pageSize={pageSize} totalItems={totalItems} onPageChange={goPage} />

      {addModalOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeAddModal();
          }}
        >
          <div className="modal-panel" style={{ width: "min(560px, 100%)" }}>
            <div className="modal-header">
              <div>
                <h3 className="m-0 text-lg font-semibold">เพิ่มสินค้า</h3>
                <p className="m-0 mt-1 text-sm text-[var(--muted)]">เพิ่มสินค้าใหม่พร้อมรูป 1:1 และเลือกหมวดหมู่</p>
              </div>
              <button type="button" className="secondary" onClick={closeAddModal}>
                ปิด
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="field mb-0">
                <label htmlFor="sku">SKU</label>
                <input id="sku" name="sku" />
              </div>

              <div className="field mb-0">
                <label htmlFor="name">ชื่อสินค้า *</label>
                <input id="name" name="name" required />
              </div>

              <div className="field mb-0">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor="categoryId">หมวดหมู่</label>
                  <button
                    type="button"
                    className="secondary px-2 py-1 text-xs"
                    onClick={() => {
                      setAddCategoryError("");
                      setAddCategoryModalOpen(true);
                    }}
                  >
                    เพิ่มหมวดหมู่
                  </button>
                </div>
                <select id="categoryId" name="categoryId" value={addCategoryId} onChange={(event) => setAddCategoryId(event.target.value)}>
                  <option value="">ไม่ระบุหมวดหมู่</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field mb-0">
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
                  ระบบจะครอปเป็น 1:1 และบีบไฟล์ไม่เกิน 10KB (base64)
                </p>
              </div>
              {imageData ? (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                  <p className="mb-2 text-xs text-[var(--muted)]">{imageInfo}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageData} alt="Preview" className="h-28 w-28 rounded-lg object-cover" />
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

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="field mb-0">
                  <label htmlFor="price">ราคาขาย *</label>
                  <input id="price" name="price" type="number" min={0} step="0.01" required />
                </div>
                <div className="field mb-0">
                  <label htmlFor="cost">ต้นทุนต่อหน่วย *</label>
                  <input id="cost" name="cost" type="number" min={0} step="0.01" required />
                </div>
                <div className="field mb-0">
                  <label htmlFor="stockQty">สต็อกเริ่มต้น *</label>
                  <input id="stockQty" name="stockQty" type="number" min={0} step={1} defaultValue={0} required />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="secondary" onClick={closeAddModal}>
                  ยกเลิก
                </button>
                <button type="submit" disabled={saving || processingImage}>
                  {saving ? "กำลังบันทึก..." : processingImage ? "กำลังจัดรูป..." : "บันทึกสินค้า"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {addCategoryModalOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setAddCategoryModalOpen(false);
              setAddCategoryError("");
            }
          }}
        >
          <div className="modal-panel" style={{ width: "min(460px, 100%)" }}>
            <div className="modal-header">
              <div>
                <h3 className="m-0 text-lg font-semibold">เพิ่มหมวดหมู่</h3>
                <p className="m-0 mt-1 text-sm text-[var(--muted)]">เพิ่มหมวดใหม่แล้วเลือกใช้ได้ทันที</p>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setAddCategoryModalOpen(false);
                  setAddCategoryError("");
                }}
              >
                ปิด
              </button>
            </div>

            <form className="space-y-3" onSubmit={onSubmitAddCategory}>
              <div className="field mb-0">
                <label htmlFor="addCategoryName">ชื่อหมวดหมู่ *</label>
                <input
                  id="addCategoryName"
                  required
                  value={addCategoryName}
                  onChange={(event) => setAddCategoryName(event.target.value)}
                />
              </div>

              <div className="field mb-0">
                <label htmlFor="addCategorySortOrder">ลำดับ</label>
                <input
                  id="addCategorySortOrder"
                  type="number"
                  step={1}
                  value={addCategorySortOrder}
                  onChange={(event) => setAddCategorySortOrder(Math.trunc(Number(event.target.value) || 0))}
                />
              </div>

              {addCategoryError ? <p className="m-0 text-sm text-red-600">{addCategoryError}</p> : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setAddCategoryModalOpen(false);
                    setAddCategoryError("");
                  }}
                >
                  ยกเลิก
                </button>
                <button type="submit" disabled={addCategorySaving}>
                  {addCategorySaving ? "กำลังบันทึก..." : "บันทึกหมวดหมู่"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editForm ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeEdit();
          }}
        >
          <div className="modal-panel" style={{ width: "min(560px, 100%)" }}>
            <div className="modal-header">
              <div>
                <h3 className="m-0 text-lg font-semibold">แก้ไขสินค้า</h3>
                <p className="m-0 mt-1 text-sm text-[var(--muted)]">แก้ชื่อ รูป หมวด ราคา ต้นทุน สต็อก และสถานะได้</p>
              </div>
              <button type="button" className="secondary" onClick={closeEdit}>
                ปิด
              </button>
            </div>

            <form className="space-y-3" onSubmit={onSubmitEdit}>
              <div className="field mb-0">
                <label htmlFor="editSku">SKU</label>
                <input
                  id="editSku"
                  value={editForm.sku}
                  onChange={(event) => setEditForm((prev) => (prev ? { ...prev, sku: event.target.value } : prev))}
                />
              </div>

              <div className="field mb-0">
                <label htmlFor="editName">ชื่อสินค้า *</label>
                <input
                  id="editName"
                  required
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                />
              </div>

              <div className="field mb-0">
                <label htmlFor="editCategoryId">หมวดหมู่</label>
                <select
                  id="editCategoryId"
                  value={editForm.categoryId}
                  onChange={(event) => setEditForm((prev) => (prev ? { ...prev, categoryId: event.target.value } : prev))}
                >
                  <option value="">ไม่ระบุหมวดหมู่</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field mb-0">
                <label htmlFor="editImageFile">รูปสินค้า (ไฟล์)</label>
                <input
                  key={editFileInputKey}
                  id="editImageFile"
                  type="file"
                  accept="image/*"
                  onChange={onEditImageFileChange}
                  disabled={processingEditImage}
                />
                <p className="mb-0 mt-1 text-xs text-[var(--muted)]">ระบบจะครอปเป็น 1:1 และบีบไฟล์ไม่เกิน 10KB (base64)</p>
              </div>

              {editImageData ? (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                  <p className="mb-2 text-xs text-[var(--muted)]">{editImageInfo || "รูปที่ใช้งานปัจจุบัน"}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editImageData} alt="Edit preview" className="h-28 w-28 rounded-lg object-cover" />
                  <button
                    type="button"
                    className="secondary mt-2"
                    onClick={() => {
                      setEditImageData("");
                      setEditImageInfo("ลบรูปแล้ว");
                      setEditFileInputKey((prev) => prev + 1);
                    }}
                  >
                    ลบรูป
                  </button>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="field mb-0">
                  <label htmlFor="editPrice">ราคาขาย *</label>
                  <input
                    id="editPrice"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={editForm.price}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, price: event.target.value } : prev))}
                  />
                </div>
                <div className="field mb-0">
                  <label htmlFor="editCost">ต้นทุน *</label>
                  <input
                    id="editCost"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={editForm.cost}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, cost: event.target.value } : prev))}
                  />
                </div>
                <div className="field mb-0">
                  <label htmlFor="editStockQty">สต็อก *</label>
                  <input
                    id="editStockQty"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={editForm.stockQty}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, stockQty: event.target.value } : prev))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) => setEditForm((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))}
                />
                เปิดใช้งานสินค้า
              </label>

              {editError ? <p className="m-0 text-sm text-red-600">{editError}</p> : null}

              <div className="flex justify-end gap-2">
                <button type="button" className="secondary" onClick={closeEdit}>
                  ยกเลิก
                </button>
                <button type="submit" disabled={savingEdit || processingEditImage}>
                  {savingEdit ? "กำลังบันทึก..." : processingEditImage ? "กำลังย่อรูป..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ImageCropModal
        open={Boolean(cropAddImageFile)}
        file={cropAddImageFile}
        title="ครอปรูปสินค้าใหม่"
        description="เลือกตำแหน่งรูปที่จะใช้ในสินค้า (1:1)"
        onCancel={() => {
          setCropAddImageFile(null);
          setProcessingImage(false);
          setFileInputKey((prev) => prev + 1);
        }}
        onApply={({ dataUrl, info }) => {
          setImageData(dataUrl);
          setImageInfo(info);
          setCropAddImageFile(null);
          setProcessingImage(false);
          setFileInputKey((prev) => prev + 1);
        }}
      />

      <ImageCropModal
        open={Boolean(cropEditImageFile)}
        file={cropEditImageFile}
        title="ครอปรูปสินค้า (แก้ไข)"
        description="เลือกรูปที่ต้องการใช้แทนรูปเดิม"
        onCancel={() => {
          setCropEditImageFile(null);
          setProcessingEditImage(false);
          setEditFileInputKey((prev) => prev + 1);
        }}
        onApply={({ dataUrl, info }) => {
          setEditImageData(dataUrl);
          setEditImageInfo(info);
          setCropEditImageFile(null);
          setProcessingEditImage(false);
          setEditFileInputKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}
