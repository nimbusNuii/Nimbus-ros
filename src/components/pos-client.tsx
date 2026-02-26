"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ReceiptPreviewModal } from "@/components/receipt-preview-modal";

type Product = {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  price: number;
  cost: number;
  stockQty: number;
};

type Category = {
  id: string;
  name: string;
};

type MenuOption = {
  id: string;
  type: "SPICE_LEVEL" | "ADD_ON" | "REMOVE_INGREDIENT";
  label: string;
};

type Customer = {
  id: string;
  name: string;
  type: "WALK_IN" | "REGULAR";
};

type PosClientProps = {
  products: Product[];
  categories: Category[];
  menuOptions: MenuOption[];
  customers: Customer[];
  vatEnabled: boolean;
  taxRate: number;
  currency: string;
  initialRecentReceipts: Array<{
    id: string;
    orderNumber: string;
    createdAt: string;
    paymentMethod: string;
    status: "PAID" | "OPEN" | "CANCELLED";
    customerType: "WALK_IN" | "REGULAR";
    customerName: string | null;
    itemCount: number;
    total: number;
  }>;
};

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "QR";
type ServiceMode = "DINE_IN" | "TAKEAWAY";

type CartModifier = {
  spiceLevel: string;
  addOns: string[];
  removeSelections: string[];
  removeIngredients: string;
  note: string;
};

type CartLine = {
  lineId: string;
  productId: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  unitPrice: number;
  qty: number;
  stockQty: number;
  modifier: CartModifier;
  sendToKitchen: boolean;
};

type ToastState = {
  id: number;
  text: string;
  tone: "success" | "warning";
};

const DEFAULT_MODIFIER: CartModifier = {
  spiceLevel: "",
  addOns: [],
  removeSelections: [],
  removeIngredients: "",
  note: ""
};

function createLineId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function customerNameLabel(item: { customerType: "WALK_IN" | "REGULAR"; customerName: string | null }) {
  return item.customerName || (item.customerType === "REGULAR" ? "ลูกค้าประจำ" : "ลูกค้าขาจร");
}

function receiptStatusLabel(status: "PAID" | "OPEN" | "CANCELLED") {
  if (status === "PAID") return "ชำระแล้ว";
  if (status === "OPEN") return "บิลล่วงหน้า";
  return "ยกเลิก";
}

function sanitizeModifier(modifier: CartModifier): CartModifier {
  return {
    spiceLevel: modifier.spiceLevel,
    addOns: [...modifier.addOns].sort(),
    removeSelections: [...modifier.removeSelections].sort(),
    removeIngredients: modifier.removeIngredients.trim(),
    note: modifier.note.trim()
  };
}

function modifierSignature(modifier: CartModifier) {
  const normalized = sanitizeModifier(modifier);
  return JSON.stringify(normalized);
}

function modifierNote(modifier: CartModifier) {
  const normalized = sanitizeModifier(modifier);
  const chunks: string[] = [];
  if (normalized.spiceLevel) chunks.push(`เผ็ด: ${normalized.spiceLevel}`);
  if (normalized.addOns.length) chunks.push(`เพิ่ม: ${normalized.addOns.join(", ")}`);
  const removeItems = normalized.removeSelections.length ? normalized.removeSelections.join(", ") : "";
  const removeRaw = normalized.removeIngredients ? normalized.removeIngredients : "";
  const removeText = [removeItems, removeRaw].filter(Boolean).join(", ");
  if (removeText) chunks.push(`ไม่ใส่: ${removeText}`);
  if (normalized.note) chunks.push(`โน้ต: ${normalized.note}`);
  return chunks.join(" | ");
}

export function PosClient({
  products,
  categories: categoryMaster,
  menuOptions,
  customers,
  vatEnabled,
  taxRate,
  currency,
  initialRecentReceipts
}: PosClientProps) {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [serviceMode, setServiceMode] = useState<ServiceMode>("DINE_IN");
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [selectedCustomerId, setSelectedCustomerId] = useState("WALK_IN");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [recentReceipts, setRecentReceipts] = useState(initialRecentReceipts);
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null);
  const [modifierState, setModifierState] = useState<CartModifier>(DEFAULT_MODIFIER);
  const [removedLine, setRemovedLine] = useState<CartLine | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pulseProductId, setPulseProductId] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const spiceOptions = useMemo(
    () => menuOptions.filter((item) => item.type === "SPICE_LEVEL").map((item) => item.label),
    [menuOptions]
  );
  const addOnOptions = useMemo(
    () => menuOptions.filter((item) => item.type === "ADD_ON").map((item) => item.label),
    [menuOptions]
  );
  const removeIngredientOptions = useMemo(
    () => menuOptions.filter((item) => item.type === "REMOVE_INGREDIENT").map((item) => item.label),
    [menuOptions]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of categoryMaster) set.add(item.name);
    for (const product of products) {
      if (product.category) set.add(product.category);
    }
    return ["ALL", ...Array.from(set)];
  }, [categoryMaster, products]);

  const visibleProducts = useMemo(() => {
    if (activeCategory === "ALL") return products;
    return products.filter((product) => (product.category || "Other") === activeCategory);
  }, [activeCategory, products]);

  const subtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
    [cartLines]
  );
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  const taxable = Math.max(0, subtotal - safeDiscount);
  const tax = vatEnabled ? (taxable * taxRate) / 100 : 0;
  const total = taxable + tax;
  const selectedLines = cartLines.filter((line) => line.sendToKitchen);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!removedLine) return;
    const timer = window.setTimeout(() => setRemovedLine(null), 5000);
    return () => window.clearTimeout(timer);
  }, [removedLine]);

  function showToast(text: string, tone: ToastState["tone"] = "success") {
    setToast({ id: Date.now(), text, tone });
  }

  function addLineFromProduct(product: Product, modifier: CartModifier = DEFAULT_MODIFIER) {
    const normalized = sanitizeModifier(modifier);
    const signature = modifierSignature(normalized);

    setCartLines((prev) => {
      const index = prev.findIndex(
        (line) => line.productId === product.id && modifierSignature(line.modifier) === signature
      );
      if (index < 0) {
        return [
          {
            lineId: createLineId(),
            productId: product.id,
            name: product.name,
            category: product.category,
            imageUrl: product.imageUrl,
            unitPrice: product.price,
            qty: 1,
            stockQty: product.stockQty,
            modifier: normalized,
            sendToKitchen: true
          },
          ...prev
        ];
      }

      const next = [...prev];
      const target = next[index];
      if (target.qty >= target.stockQty) return prev;
      next[index] = { ...target, qty: target.qty + 1 };
      return next;
    });

    setPulseProductId(product.id);
    window.setTimeout(() => setPulseProductId((current) => (current === product.id ? null : current)), 200);
    showToast(`เพิ่ม ${product.name} ลงตะกร้า`);
  }

  function updateQty(lineId: string, delta: number) {
    setCartLines((prev) =>
      prev
        .map((line) => {
          if (line.lineId !== lineId) return line;
          const nextQty = Math.max(0, Math.min(line.stockQty, line.qty + delta));
          return { ...line, qty: nextQty };
        })
        .filter((line) => line.qty > 0)
    );
  }

  function removeLine(lineId: string) {
    setCartLines((prev) => {
      const target = prev.find((line) => line.lineId === lineId) || null;
      if (target) {
        setRemovedLine(target);
      }
      return prev.filter((line) => line.lineId !== lineId);
    });
    showToast("ลบรายการแล้ว", "warning");
  }

  function undoRemove() {
    if (!removedLine) return;
    setCartLines((prev) => [removedLine, ...prev]);
    setRemovedLine(null);
    showToast("คืนรายการกลับแล้ว");
  }

  function toggleSend(lineId: string) {
    setCartLines((prev) =>
      prev.map((line) => (line.lineId === lineId ? { ...line, sendToKitchen: !line.sendToKitchen } : line))
    );
  }

  function openModifier(product: Product) {
    setModifierProduct(product);
    setModifierState({
      ...DEFAULT_MODIFIER
    });
  }

  function closeModifier() {
    setModifierProduct(null);
    setModifierState({
      ...DEFAULT_MODIFIER
    });
  }

  function toggleAddOn(label: string) {
    setModifierState((prev) => ({
      ...prev,
      addOns: prev.addOns.includes(label) ? prev.addOns.filter((item) => item !== label) : [...prev.addOns, label]
    }));
  }

  function toggleRemoveSelection(label: string) {
    setModifierState((prev) => ({
      ...prev,
      removeSelections: prev.removeSelections.includes(label)
        ? prev.removeSelections.filter((item) => item !== label)
        : [...prev.removeSelections, label]
    }));
  }

  async function submitOrder(lines: CartLine[], action: "KITCHEN" | "PAYMENT" | "ADVANCE") {
    if (!lines.length || submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({
            productId: line.productId,
            qty: line.qty,
            note: modifierNote(line.modifier) || undefined
          })),
          discount: action === "PAYMENT" ? safeDiscount : 0,
          paymentMethod,
          orderStatus: action === "ADVANCE" ? "OPEN" : "PAID",
          scheduledFor: action === "ADVANCE" && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
          customerId: selectedCustomer?.id,
          customerType: selectedCustomer ? selectedCustomer.type : "WALK_IN",
          customerName: selectedCustomer ? selectedCustomer.name : "ลูกค้าขาจร",
          note: `บริการ: ${serviceMode === "DINE_IN" ? "ทานที่ร้าน" : "กลับบ้าน"}`
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.items && Array.isArray(data.items)) {
          const detail = data.items
            .map((item: { name: string; required: number; stock: number }) => `${item.name} (ต้องการ ${item.required}, เหลือ ${item.stock})`)
            .join(", ");
          throw new Error(`สต็อกไม่พอ: ${detail}`);
        }
        throw new Error(data.error ?? "Cannot submit order");
      }

      setCartLines((prev) => prev.filter((line) => !lines.some((target) => target.lineId === line.lineId)));
      if (action === "PAYMENT") {
        setDiscount(0);
      }
      if (action === "ADVANCE") {
        setScheduledFor("");
      }

      setMessage(
        action === "KITCHEN"
          ? `ส่งครัวแล้ว ${data.orderNumber}`
          : action === "ADVANCE"
            ? `บันทึกบิลล่วงหน้าแล้ว ${data.orderNumber}`
            : `ชำระเงินแล้ว ${data.orderNumber}`
      );
      setReceiptOrderId(data.id);
      setRecentReceipts((prev) =>
        [
          {
            id: data.id,
            orderNumber: data.orderNumber,
            createdAt: data.createdAt,
            paymentMethod: data.paymentMethod,
            status: data.status,
            customerType: data.customerType,
            customerName: data.customerName,
            itemCount: data.itemCount,
            total: data.total
          },
          ...prev
        ].slice(0, 10)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot submit order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_420px]">
        <aside className="card space-y-3">
          <h2 className="mt-0 text-base font-semibold">หมวดเมนู</h2>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                onMouseEnter={() => setHoveredCategory(category)}
                onMouseLeave={() => setHoveredCategory((current) => (current === category ? null : current))}
                onFocus={() => setHoveredCategory(category)}
                onBlur={() => setHoveredCategory((current) => (current === category ? null : current))}
                className={`secondary w-full justify-start rounded-xl border-l-4 px-3 py-2 text-left ${
                  activeCategory === category
                    ? "border-l-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_8%,white)]"
                    : hoveredCategory === category
                      ? "border-l-[color-mix(in_srgb,var(--brand)_45%,white)] bg-[color-mix(in_srgb,var(--brand)_5%,white)]"
                      : "border-l-transparent"
                }`}
              >
                {category === "ALL" ? "ทั้งหมด" : category}
              </button>
            ))}
          </div>
          <p className="m-0 text-xs text-[var(--muted)]">
            {hoveredCategory ? `กำลังเลือก: ${hoveredCategory === "ALL" ? "ทั้งหมด" : hoveredCategory}` : "แตะหมวดเมนูเพื่อกรองสินค้า"}
          </p>

          <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-2">
            <p className="m-0 text-xs font-semibold text-[var(--muted)]">โหมดออเดอร์</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={serviceMode === "DINE_IN" ? "" : "secondary"}
                onClick={() => setServiceMode("DINE_IN")}
              >
                ทานที่ร้าน
              </button>
              <button
                type="button"
                className={serviceMode === "TAKEAWAY" ? "" : "secondary"}
                onClick={() => setServiceMode("TAKEAWAY")}
              >
                กลับบ้าน
              </button>
            </div>
          </div>
        </aside>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-xl font-semibold">เมนูขาย</h2>
            <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
              แตะเมนูเพื่อเพิ่มทันที
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className={`group flex min-h-52 flex-col rounded-xl border border-[var(--line)] bg-white p-3 text-left transition duration-150 hover:bg-[#f9fafb] ${
                  pulseProductId === product.id ? "scale-[0.98]" : ""
                } ${product.stockQty <= 0 ? "opacity-70" : ""}`}
              >
                <button
                  type="button"
                  className="secondary flex w-full flex-1 flex-col items-start rounded-lg border border-transparent bg-transparent p-0 text-left"
                  onClick={() => addLineFromProduct(product)}
                  disabled={product.stockQty <= 0}
                >
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-24 w-full rounded-lg border border-[var(--line)] object-cover"
                    />
                  ) : (
                    <div className="grid h-24 w-full place-items-center rounded-lg border border-dashed border-[var(--line)] text-xs text-[var(--muted)]">
                      ไม่มีรูปสินค้า
                    </div>
                  )}
                  <div className="mt-2 w-full space-y-1">
                    <div className="line-clamp-2 font-semibold text-[#111827]">{product.name}</div>
                    <div className="text-xs text-[var(--muted)]">{product.category || "Uncategorized"}</div>
                    <div className={`text-xs ${product.stockQty > 0 ? "text-[var(--muted)]" : "text-red-600"}`}>
                      คงเหลือ {product.stockQty}
                    </div>
                    <div className="text-base font-semibold">{formatCurrency(product.price, currency)}</div>
                  </div>
                </button>

                <div className="mt-auto grid w-full grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    className="secondary w-full text-xs"
                    onClick={() => addLineFromProduct(product)}
                    disabled={product.stockQty <= 0}
                  >
                    เพิ่มลงตะกร้า
                  </button>
                  <button
                    type="button"
                    className="secondary w-full text-xs"
                    onClick={() => openModifier(product)}
                    disabled={product.stockQty <= 0}
                  >
                    ปรับแต่ง
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card flex max-h-[calc(100vh-150px)] flex-col">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-xl font-semibold">ตะกร้า</h2>
            <span className="rounded-full border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]">
              {cartLines.reduce((sum, item) => sum + item.qty, 0)} ชิ้น
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">รองรับส่งบางรายการเข้าครัว โดยเลือกเช็กบ็อกซ์ในแต่ละรายการ</p>

          <div className="mt-2 flex-1 space-y-2 overflow-auto pr-1">
            {cartLines.length === 0 ? <p className="text-[var(--muted)]">ยังไม่มีรายการ</p> : null}
            {cartLines.map((line) => (
              <article key={line.lineId} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-2">
                <div className="grid grid-cols-[auto_1fr_auto] items-start gap-2">
                  <input
                    type="checkbox"
                    checked={line.sendToKitchen}
                    onChange={() => toggleSend(line.lineId)}
                    className="mt-1 h-4 w-4 accent-[#E24A3B]"
                  />
                  <div>
                    <div className="font-semibold">{line.name}</div>
                    <p className="m-0 text-xs text-[var(--muted)]">
                      {formatCurrency(line.unitPrice, currency)} x {line.qty}
                    </p>
                    <p className="m-0 text-xs text-[var(--muted)]">{modifierNote(line.modifier) || "ไม่ระบุเพิ่มเติม"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="secondary h-8 w-8 p-0" onClick={() => updateQty(line.lineId, -1)}>
                      -
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold">{line.qty}</span>
                    <button className="secondary h-8 w-8 p-0" onClick={() => updateQty(line.lineId, 1)}>
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <button type="button" className="secondary text-xs" onClick={() => removeLine(line.lineId)}>
                    ลบรายการ
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-2 space-y-2 border-t border-[var(--line)] pt-3">
            <div className="field">
              <label htmlFor="customerDropdown">ลูกค้า</label>
              <select
                id="customerDropdown"
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
              >
                <option value="WALK_IN">ลูกค้าขาจร</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.type === "REGULAR" ? "ลูกค้าประจำ" : "ขาจร"})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="field mb-0">
                <label htmlFor="discount">ส่วนลด</label>
                <input
                  id="discount"
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(event) => setDiscount(Number(event.target.value))}
                />
              </div>
              <div className="field mb-0">
                <label htmlFor="payment">ชำระเงิน</label>
                <select
                  id="payment"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                >
                  <option value="CASH">เงินสด</option>
                  <option value="CARD">บัตร</option>
                  <option value="TRANSFER">โอนเงิน</option>
                  <option value="QR">QR</option>
                </select>
              </div>
            </div>

            <table className="table">
              <tbody>
                <tr>
                  <td>ยอดก่อนส่วนลด</td>
                  <td>{formatCurrency(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td>ส่วนลด</td>
                  <td>{formatCurrency(safeDiscount, currency)}</td>
                </tr>
                <tr>
                  <td>{vatEnabled ? `ภาษี (${taxRate}%)` : "ภาษี (ปิด VAT)"}</td>
                  <td>{formatCurrency(tax, currency)}</td>
                </tr>
                <tr>
                  <td className="text-base font-semibold">ยอดสุทธิ</td>
                  <td className="text-lg font-bold">{formatCurrency(total, currency)}</td>
                </tr>
              </tbody>
            </table>

            <div className="field mb-0">
              <label htmlFor="scheduledFor">บิลล่วงหน้า (วัน/เวลา)</label>
              <input
                id="scheduledFor"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
              <p className="mb-0 mt-1 text-xs text-[var(--muted)]">
                ถ้าระบุวันเวลา ระบบจะบันทึกเป็นสถานะบิลล่วงหน้า และยังไม่คิดยอดขายในสรุป
              </p>
            </div>

            <div className="grid gap-2">
              <button
                onClick={() => void submitOrder(selectedLines, "KITCHEN")}
                disabled={submitting || selectedLines.length === 0}
                className="w-full"
              >
                {submitting ? "กำลังส่ง..." : `Send to Kitchen (${selectedLines.length})`}
              </button>
              <button
                onClick={() => void submitOrder(cartLines, "PAYMENT")}
                disabled={submitting || cartLines.length === 0}
                className="secondary w-full"
              >
                {submitting ? "กำลังบันทึก..." : "Proceed to Payment"}
              </button>
              <button
                onClick={() => void submitOrder(cartLines, "ADVANCE")}
                disabled={submitting || cartLines.length === 0}
                className="secondary w-full"
              >
                {submitting ? "กำลังบันทึก..." : "บันทึกบิลล่วงหน้า"}
              </button>
            </div>

            {message ? <p className="mt-1 text-sm text-[var(--ok)]">{message}</p> : null}
            {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
          </div>
        </section>
      </div>

      <section className="card mt-4">
        <h2 className="mt-0 text-xl font-semibold">ใบเสร็จย้อนหลังล่าสุด (10 รายการ)</h2>
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>เลขที่บิล</th>
                <th>สถานะ</th>
                <th>จำนวน</th>
                <th>ลูกค้า</th>
                <th>ชำระ</th>
                <th>ยอดสุทธิ</th>
                <th>ดู/พิมพ์</th>
              </tr>
            </thead>
            <tbody>
              {recentReceipts.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.orderNumber}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        row.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700"
                          : row.status === "OPEN"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {receiptStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>{row.itemCount}</td>
                  <td>{customerNameLabel(row)}</td>
                  <td>{row.paymentMethod}</td>
                  <td>{formatCurrency(row.total, currency)}</td>
                  <td>
                    <button className="secondary" type="button" onClick={() => setReceiptOrderId(row.id)}>
                      เปิด Modal
                    </button>
                  </td>
                </tr>
              ))}
              {recentReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-[var(--muted)]">
                    ยังไม่มีใบเสร็จ
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {modifierProduct ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="modal-header">
              <h3 className="m-0 text-lg font-semibold">ปรับแต่งเมนู: {modifierProduct.name}</h3>
              <button className="secondary" onClick={closeModifier}>
                ปิด
              </button>
            </div>

            <div className="grid gap-3">
              <div className="field">
                <label>ระดับความเผ็ด</label>
                <select
                  value={modifierState.spiceLevel}
                  onChange={(event) =>
                    setModifierState((prev) => ({
                      ...prev,
                      spiceLevel: event.target.value
                    }))
                  }
                >
                  <option value="">ไม่ระบุ</option>
                  {spiceOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>เพิ่มพิเศษ</label>
                <div className="grid grid-cols-2 gap-2">
                  {addOnOptions.map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[#111827]"
                    >
                      <input
                        type="checkbox"
                        checked={modifierState.addOns.includes(item)}
                        onChange={() => toggleAddOn(item)}
                        className="h-4 w-4 accent-[#E24A3B]"
                      />
                      {item}
                    </label>
                  ))}
                  {addOnOptions.length === 0 ? (
                    <p className="col-span-2 m-0 text-xs text-[var(--muted)]">
                      ยังไม่ได้ตั้งค่าเพิ่มพิเศษในหน้า Manage &gt; Menu Options
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="field">
                <label>ไม่ใส่วัตถุดิบ</label>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  {removeIngredientOptions.map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[#111827]"
                    >
                      <input
                        type="checkbox"
                        checked={modifierState.removeSelections.includes(item)}
                        onChange={() => toggleRemoveSelection(item)}
                        className="h-4 w-4 accent-[#E24A3B]"
                      />
                      {item}
                    </label>
                  ))}
                </div>
                <input
                  value={modifierState.removeIngredients}
                  onChange={(event) =>
                    setModifierState((prev) => ({
                      ...prev,
                      removeIngredients: event.target.value
                    }))
                  }
                  placeholder="เช่น ไม่ใส่หอม, ไม่ใส่พริก"
                />
              </div>

              <div className="field">
                <label>โน้ตเพิ่มเติม</label>
                <textarea
                  rows={3}
                  value={modifierState.note}
                  onChange={(event) =>
                    setModifierState((prev) => ({
                      ...prev,
                      note: event.target.value
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button className="secondary" onClick={closeModifier}>
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  addLineFromProduct(modifierProduct, modifierState);
                  closeModifier();
                }}
              >
                เพิ่มลงตะกร้า
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {removedLine ? (
        <div className="toast-slide-in fixed bottom-4 right-4 z-50 rounded-xl border border-[var(--line)] bg-white p-3 text-sm shadow-sm">
          ลบ {removedLine.name} แล้ว
          <button className="secondary ml-2 text-xs" onClick={undoRemove}>
            Undo
          </button>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`toast-slide-in fixed right-4 top-20 z-50 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
            toast.tone === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <ReceiptPreviewModal orderId={receiptOrderId} onClose={() => setReceiptOrderId(null)} />
    </>
  );
}
