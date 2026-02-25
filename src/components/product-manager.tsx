"use client";

import { FormEvent, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  price: number;
  cost: number;
  stockQty: number;
  isActive: boolean;
};

type ProductManagerProps = {
  initialProducts: Product[];
  currency: string;
};

export function ProductManager({ initialProducts, currency }: ProductManagerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [stockAdjust, setStockAdjust] = useState<Record<string, number>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sku: form.get("sku"),
          name: form.get("name"),
          category: form.get("category"),
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
        headers: {
          "content-type": "application/json"
        },
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
    <div className="grid grid-2">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>เพิ่มสินค้า</h2>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="sku">SKU</label>
            <input id="sku" name="sku" />
          </div>
          <div className="field">
            <label htmlFor="name">ชื่อสินค้า *</label>
            <input id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="category">หมวดหมู่</label>
            <input id="category" name="category" />
          </div>
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
          <button disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกสินค้า"}</button>
        </form>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>รายการสินค้า</h2>
        <table className="table">
          <thead>
            <tr>
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
                <td>{product.name}</td>
                <td>{product.category || "-"}</td>
                <td>{formatCurrency(product.price, currency)}</td>
                <td>{formatCurrency(product.cost, currency)}</td>
                <td>{product.stockQty}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
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
                      style={{ width: 90 }}
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
      </section>
    </div>
  );
}
