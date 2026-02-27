import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function hashPin(pin: string) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

async function main() {
  await prisma.storeSetting.upsert({
    where: { id: 1 },
    update: {
      businessName: "ร้านหมูปิ้งหน้าโรงเรียน",
      branchName: "สาขาหลัก",
      address: "กรุงเทพฯ",
      phone: "02-000-0000",
      vatNumber: "0100000000000",
      vatEnabled: true,
      taxRate: 7,
      currency: "THB"
    },
    create: {
      id: 1,
      businessName: "ร้านหมูปิ้งหน้าโรงเรียน",
      branchName: "สาขาหลัก",
      address: "กรุงเทพฯ",
      phone: "02-000-0000",
      vatNumber: "0100000000000",
      vatEnabled: true,
      taxRate: 7,
      currency: "THB"
    }
  });

  const defaultTemplate = await prisma.receiptTemplate.findFirst({
    where: { isDefault: true }
  });

  if (!defaultTemplate) {
    await prisma.receiptTemplate.create({
      data: {
        name: "Default Receipt",
        isDefault: true,
        headerText: "{{businessName}}",
        footerText: "แล้วพบกันใหม่"
      }
    });
  }

  const categorySeeds = [
    { name: "หมูปิ้ง", sortOrder: 1 },
    { name: "ชุดเซต", sortOrder: 2 },
    { name: "เครื่องเคียง", sortOrder: 3 },
    { name: "เครื่องดื่ม", sortOrder: 4 }
  ] as const;

  const categoryIdByName = new Map<string, string>();
  for (const category of categorySeeds) {
    const created = await prisma.productCategory.upsert({
      where: { name: category.name },
      update: {
        sortOrder: category.sortOrder,
        isActive: true
      },
      create: {
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: true
      }
    });
    categoryIdByName.set(created.name, created.id);
  }

  const products = [
    { name: "หมูปิ้งสูตรโบราณ", category: "หมูปิ้ง", price: 12, cost: 5, sku: "MOO-001", stockQty: 400 },
    { name: "หมูปิ้งนมสด", category: "หมูปิ้ง", price: 13, cost: 6, sku: "MOO-002", stockQty: 350 },
    { name: "หมูปิ้งพริกไทยดำ", category: "หมูปิ้ง", price: 13, cost: 6, sku: "MOO-003", stockQty: 320 },
    { name: "หมูปิ้งสามชั้น", category: "หมูปิ้ง", price: 15, cost: 7, sku: "MOO-004", stockQty: 250 },
    { name: "หมูปิ้งสไปซี่", category: "หมูปิ้ง", price: 14, cost: 6, sku: "MOO-005", stockQty: 240 },
    { name: "หมูปิ้งซอสเทอริยากิ", category: "หมูปิ้ง", price: 14, cost: 6, sku: "MOO-006", stockQty: 220 },
    { name: "หมูปิ้งงาขาว", category: "หมูปิ้ง", price: 13, cost: 6, sku: "MOO-007", stockQty: 260 },
    { name: "หมูปิ้งกระเทียมพริกไทย", category: "หมูปิ้ง", price: 13, cost: 6, sku: "MOO-008", stockQty: 260 },
    { name: "หมูปิ้งแจ่ว", category: "หมูปิ้ง", price: 14, cost: 6, sku: "MOO-009", stockQty: 210 },
    { name: "หมูปิ้งซอสหวาน", category: "หมูปิ้ง", price: 12, cost: 5, sku: "MOO-010", stockQty: 280 },
    { name: "ชุดเซต A หมูปิ้ง 5 ไม้ + ข้าวเหนียว", category: "ชุดเซต", price: 69, cost: 31, sku: "SET-011", stockQty: 120 },
    { name: "ชุดเซต B หมูปิ้ง 8 ไม้ + ข้าวเหนียว 2 ห่อ", category: "ชุดเซต", price: 109, cost: 50, sku: "SET-012", stockQty: 90 },
    { name: "ชุดเซต C หมูปิ้ง 10 ไม้ + น้ำ 1 ขวด", category: "ชุดเซต", price: 139, cost: 64, sku: "SET-013", stockQty: 80 },
    { name: "ชุดเซต D หมูปิ้ง 15 ไม้ + น้ำ 2 ขวด", category: "ชุดเซต", price: 199, cost: 95, sku: "SET-014", stockQty: 60 },
    { name: "ชุดเซตครอบครัว หมูปิ้ง 20 ไม้ + ข้าวเหนียว 6 ห่อ", category: "ชุดเซต", price: 279, cost: 132, sku: "SET-015", stockQty: 45 },
    { name: "ชุดเซตอิ่มคุ้ม หมูปิ้ง 12 ไม้ + ข้าวเหนียว 3 ห่อ", category: "ชุดเซต", price: 169, cost: 78, sku: "SET-016", stockQty: 70 },
    { name: "ชุดเซตมื้อเช้า หมูปิ้ง 6 ไม้ + นมถั่วเหลือง", category: "ชุดเซต", price: 89, cost: 40, sku: "SET-017", stockQty: 100 },
    { name: "ชุดเซตมื้อด่วน หมูปิ้ง 4 ไม้ + น้ำเปล่า", category: "ชุดเซต", price: 59, cost: 27, sku: "SET-018", stockQty: 130 },
    { name: "ชุดเซตพรีเมียม หมูปิ้งสามชั้น 10 ไม้ + น้ำสมุนไพร", category: "ชุดเซต", price: 179, cost: 86, sku: "SET-019", stockQty: 55 },
    { name: "ชุดเซตคู่หู หมูปิ้ง 10 ไม้ + ข้าวเหนียว 2 ห่อ + น้ำ 2 ขวด", category: "ชุดเซต", price: 149, cost: 69, sku: "SET-020", stockQty: 85 },
    { name: "ข้าวเหนียวห่อเล็ก", category: "เครื่องเคียง", price: 8, cost: 3, sku: "SIDE-021", stockQty: 500 },
    { name: "ข้าวเหนียวห่อใหญ่", category: "เครื่องเคียง", price: 12, cost: 5, sku: "SIDE-022", stockQty: 350 },
    { name: "แจ่วสูตรพิเศษ", category: "เครื่องเคียง", price: 10, cost: 4, sku: "SIDE-023", stockQty: 220 },
    { name: "แตงกวาดอง", category: "เครื่องเคียง", price: 15, cost: 6, sku: "SIDE-024", stockQty: 180 },
    { name: "น้ำเปล่า 600ml", category: "เครื่องดื่ม", price: 10, cost: 4, sku: "DRINK-025", stockQty: 600 },
    { name: "โค้ก 325ml", category: "เครื่องดื่ม", price: 20, cost: 10, sku: "DRINK-026", stockQty: 300 },
    { name: "สไปรท์ 325ml", category: "เครื่องดื่ม", price: 20, cost: 10, sku: "DRINK-027", stockQty: 280 },
    { name: "ชามะนาวเย็น", category: "เครื่องดื่ม", price: 25, cost: 11, sku: "DRINK-028", stockQty: 240 },
    { name: "นมถั่วเหลือง", category: "เครื่องดื่ม", price: 15, cost: 7, sku: "DRINK-029", stockQty: 260 },
    { name: "น้ำเก๊กฮวย", category: "เครื่องดื่ม", price: 20, cost: 9, sku: "DRINK-030", stockQty: 220 }
  ] as const;

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        categoryId: categoryIdByName.get(product.category) || null,
        category: product.category,
        imageUrl: null,
        price: product.price,
        cost: product.cost,
        stockQty: product.stockQty,
        isActive: true
      },
      create: {
        sku: product.sku,
        name: product.name,
        categoryId: categoryIdByName.get(product.category) || null,
        category: product.category,
        imageUrl: null,
        price: product.price,
        cost: product.cost,
        stockQty: product.stockQty,
        isActive: true
      }
    });
  }

  const users = [
    { username: "cashier", fullName: "Cashier", role: "CASHIER", pin: "1111" },
    { username: "kitchen", fullName: "Kitchen Staff", role: "KITCHEN", pin: "2222" },
    { username: "manager", fullName: "Manager", role: "MANAGER", pin: "3333" },
    { username: "admin", fullName: "Administrator", role: "ADMIN", pin: "9999" }
  ] as const;

  for (const user of users) {
    await prisma.appUser.upsert({
      where: { username: user.username },
      update: {
        fullName: user.fullName,
        role: user.role,
        pinHash: hashPin(user.pin),
        isActive: true
      },
      create: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        pinHash: hashPin(user.pin),
        isActive: true
      }
    });
  }

  const customers = [
    { name: "ลูกค้า", type: "WALK_IN", phone: null, note: "ลูกค้าทั่วไป" },
    { name: "คุณสมชาย", type: "REGULAR", phone: "0811111111", note: "ลูกค้าประจำช่วงเช้า" },
    { name: "คุณสมหญิง", type: "REGULAR", phone: "0822222222", note: "ชอบไม่เผ็ด" },
    { name: "คุณอนันต์", type: "REGULAR", phone: "0833333333", note: "สั่งกลับบ้านบ่อย" },
    { name: "คุณมาลี", type: "REGULAR", phone: "0844444444", note: "แพ้อาหารทะเล" },
    { name: "บริษัท ABC", type: "REGULAR", phone: "020000000", note: "รับใบกำกับภาษี" },
    { name: "บริษัท XYZ", type: "REGULAR", phone: "026666666", note: "สั่งเลี้ยงทีมทุกศุกร์" },
    { name: "ร้านข้างบ้าน", type: "REGULAR", phone: "0855555555", note: "ลูกค้าเพื่อนบ้าน" },
    { name: "คุณปกรณ์", type: "REGULAR", phone: "0866666666", note: "ชอบเพิ่มชีส" },
    { name: "คุณเบญจา", type: "REGULAR", phone: "0877777777", note: "เน้นเมนูปิ้งย่าง" }
  ] as const;

  for (const customer of customers) {
    const existing = await prisma.customer.findFirst({
      where: {
        name: customer.name,
        type: customer.type
      }
    });

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          phone: customer.phone,
          note: customer.note,
          isActive: true
        }
      });
      continue;
    }

    await prisma.customer.create({
      data: {
        name: customer.name,
        type: customer.type,
        phone: customer.phone,
        note: customer.note,
        isActive: true
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
