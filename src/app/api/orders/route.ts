import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { buildPrintPayload, suggestedTarget } from "@/lib/print";

type CustomerType = "WALK_IN" | "REGULAR";

type OrderInput = {
  items: Array<{ productId: string; qty: number; note?: string }>;
  discount?: number;
  paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "QR";
  orderStatus?: "PAID" | "OPEN";
  scheduledFor?: string;
  customerId?: string;
  customerType?: CustomerType;
  customerName?: string;
  note?: string;
};

function buildOrderNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD-${stamp}-${suffix}`;
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: todayStart }
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: true
    }
  });

  return NextResponse.json(
    orders.map((order) => ({
      ...order,
      subtotal: toNumber(order.subtotal),
      discount: toNumber(order.discount),
      tax: toNumber(order.tax),
      total: toNumber(order.total),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
        unitCost: toNumber(item.unitCost),
        lineTotal: toNumber(item.lineTotal)
      }))
    }))
  );
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as OrderInput;

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "No order items" }, { status: 400 });
    }

    const normalizedItems = body.items
      .map((item) => ({
        productId: item.productId,
        qty: Math.max(1, Number(item.qty) || 1),
        note: item.note?.trim() || null
      }))
      .filter((item) => item.productId);

    const orderStatus = body.orderStatus === "OPEN" ? "OPEN" : "PAID";
    const scheduledFor =
      orderStatus === "OPEN" && body.scheduledFor ? new Date(body.scheduledFor) : null;

    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
      return NextResponse.json({ error: "scheduledFor is invalid datetime" }, { status: 400 });
    }

    const customerNameRaw = body.customerName?.trim() || "";
    const customerIdRaw = body.customerId?.trim() || null;
    let customerType: CustomerType = body.customerType === "REGULAR" ? "REGULAR" : "WALK_IN";
    let customerName = customerType === "REGULAR" ? customerNameRaw : customerNameRaw || "ลูกค้าขาจร";
    let customerId: string | null = null;

    if (customerIdRaw) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerIdRaw }
      });

      if (!customer || !customer.isActive) {
        return NextResponse.json({ error: "ไม่พบลูกค้า หรือถูกปิดใช้งาน" }, { status: 404 });
      }

      customerId = customer.id;
      customerType = customer.type;
      customerName = customer.name;
    } else if (customerType === "REGULAR" && !customerName) {
      return NextResponse.json({ error: "กรุณาระบุชื่อลูกค้าประจำ" }, { status: 400 });
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Product not found or inactive" }, { status: 400 });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const consolidated = normalizedItems.reduce<Map<string, number>>((map, item) => {
      map.set(item.productId, (map.get(item.productId) || 0) + item.qty);
      return map;
    }, new Map<string, number>());

    const outOfStock = products
      .map((product) => ({
        id: product.id,
        name: product.name,
        required: consolidated.get(product.id) || 0,
        stock: product.stockQty
      }))
      .filter((item) => item.stock < item.required);

    if (outOfStock.length > 0) {
      return NextResponse.json(
        {
          error: "Stock not enough",
          items: outOfStock
        },
        { status: 409 }
      );
    }

    const subtotal = normalizedItems.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      if (!product) return sum;
      return sum + toNumber(product.price) * item.qty;
    }, 0);

    const discount = Math.max(0, Number(body.discount) || 0);
    const setting = await prisma.storeSetting.findUnique({ where: { id: 1 } });
    const vatEnabled = setting?.vatEnabled ?? true;
    const taxRate = vatEnabled && setting ? toNumber(setting.taxRate) : 0;

    const taxable = Math.max(0, subtotal - discount);
    const tax = (taxable * taxRate) / 100;
    const total = taxable + tax;

    const defaultTemplate = await prisma.receiptTemplate.findFirst({ where: { isDefault: true } });
    const storeName = setting?.businessName ?? "POS Shop";
    const receiptFooter = defaultTemplate?.footerText ?? "ขอบคุณที่อุดหนุน";

    let order = null;
    let outOfStockRace = false;
    for (let attempts = 0; attempts < 3; attempts += 1) {
      const orderNumber = buildOrderNumber();
      try {
        order = await prisma.$transaction(async (tx) => {
          const createdOrder = await tx.order.create({
            data: {
              orderNumber,
              paymentMethod: body.paymentMethod ?? "CASH",
              status: orderStatus,
              scheduledFor,
              customerId,
              customerType,
              customerName,
              note: body.note?.trim() || null,
              subtotal,
              discount,
              tax,
              total,
              items: {
                create: normalizedItems.map((item) => {
                  const product = productMap.get(item.productId)!;
                  return {
                    productId: product.id,
                    nameSnapshot: product.name,
                    qty: item.qty,
                    unitPrice: toNumber(product.price),
                    unitCost: toNumber(product.cost),
                    lineTotal: toNumber(product.price) * item.qty,
                    note: item.note,
                    kitchenState: "NEW"
                  };
                })
              }
            }
          });

          for (const [productId, qty] of consolidated.entries()) {
            const decreased = await tx.product.updateMany({
              where: {
                id: productId,
                stockQty: { gte: qty }
              },
              data: {
                stockQty: { decrement: qty }
              }
            });

            if (decreased.count === 0) {
              throw new Error(`OUT_OF_STOCK:${productId}`);
            }

            await tx.inventoryLog.create({
              data: {
                productId,
                orderId: createdOrder.id,
                deltaQty: -qty,
                reason: "SALE",
                actor: auth.session?.username ?? "system",
                note: `Sale ${createdOrder.orderNumber}`
              }
            });
          }

          if (orderStatus === "PAID") {
            await tx.printJob.create({
              data: {
                orderId: createdOrder.id,
                status: "PENDING",
                channel: "KITCHEN_TICKET",
                printerTarget: suggestedTarget("KITCHEN_TICKET"),
                payload: buildPrintPayload({
                  channel: "KITCHEN_TICKET",
                  businessName: storeName,
                  order: {
                    id: createdOrder.id,
                    orderNumber: createdOrder.orderNumber,
                    createdAt: createdOrder.createdAt,
                    subtotal,
                    discount,
                    tax,
                    total,
                    items: normalizedItems.map((item) => {
                      const product = productMap.get(item.productId)!;
                      return {
                        nameSnapshot: product.name,
                        qty: item.qty,
                        lineTotal: toNumber(product.price) * item.qty,
                        note: item.note
                      };
                    })
                  },
                  footerText: receiptFooter
                })
              }
            });
          }

          await writeAuditLog(
            {
              action: "ORDER_CREATED",
              entity: "Order",
              entityId: createdOrder.id,
              actor: {
                userId: auth.session?.userId,
                username: auth.session?.username,
                role: auth.session?.role
              },
              metadata: {
                orderNumber: createdOrder.orderNumber,
                paymentMethod: body.paymentMethod ?? "CASH",
                status: orderStatus,
                scheduledFor,
                vatEnabled,
                taxRate,
                customerId,
                customerType,
                customerName,
                items: normalizedItems.length,
                subtotal,
                discount,
                tax,
                total
              }
            },
            tx
          );

          return createdOrder;
        });
        break;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("OUT_OF_STOCK:")) {
          outOfStockRace = true;
          break;
        }
        continue;
      }
    }

    if (outOfStockRace) {
      return NextResponse.json({ error: "Stock changed, please retry checkout" }, { status: 409 });
    }

    if (!order) {
      return NextResponse.json({ error: "Cannot create order number" }, { status: 500 });
    }

    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      status: order.status,
      scheduledFor: order.scheduledFor,
      customerId: order.customerId,
      customerType: order.customerType,
      customerName: order.customerName,
      itemCount: normalizedItems.reduce((sum, item) => sum + item.qty, 0),
      subtotal: toNumber(order.subtotal),
      discount: toNumber(order.discount),
      tax: toNumber(order.tax),
      total: toNumber(order.total)
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
