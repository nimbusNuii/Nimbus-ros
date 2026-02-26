import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function hashPin(pin: string) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

async function main() {
  await prisma.storeSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      businessName: "Demo POS Shop",
      branchName: "Main",
      address: "Bangkok",
      phone: "000-000-0000",
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

  const products = [
    { name: "หมูหมักงา", category: "ปิ้งย่าง", price: 89, cost: 39, sku: "DEMO-001", stockQty: 120 },
    { name: "เนื้อโคขุนสไลซ์", category: "ปิ้งย่าง", price: 129, cost: 62, sku: "DEMO-002", stockQty: 90 },
    { name: "เบคอนรมควัน", category: "ปิ้งย่าง", price: 99, cost: 48, sku: "DEMO-003", stockQty: 100 },
    { name: "ไส้กรอกหมู", category: "ปิ้งย่าง", price: 79, cost: 32, sku: "DEMO-004", stockQty: 110 },
    { name: "หมึกสด", category: "ปิ้งย่าง", price: 119, cost: 58, sku: "DEMO-005", stockQty: 70 },
    { name: "กุ้งแม่น้ำ", category: "ปิ้งย่าง", price: 149, cost: 82, sku: "DEMO-006", stockQty: 65 },
    { name: "สามชั้นหมักโคชูจัง", category: "ปิ้งย่าง", price: 109, cost: 52, sku: "DEMO-007", stockQty: 95 },
    { name: "ไก่หมักซอสเกาหลี", category: "ปิ้งย่าง", price: 89, cost: 37, sku: "DEMO-008", stockQty: 105 },
    { name: "เห็ดออรินจิย่าง", category: "ปิ้งย่าง", price: 69, cost: 26, sku: "DEMO-009", stockQty: 130 },
    { name: "ชุดผักรวมย่าง", category: "ปิ้งย่าง", price: 59, cost: 24, sku: "DEMO-010", stockQty: 140 },
    { name: "ข้าวกะเพราหมูสับ", category: "อาหารตามสั่ง", price: 69, cost: 28, sku: "DEMO-011", stockQty: 160 },
    { name: "ข้าวกะเพราเนื้อ", category: "อาหารตามสั่ง", price: 85, cost: 38, sku: "DEMO-012", stockQty: 120 },
    { name: "ข้าวผัดกุ้ง", category: "อาหารตามสั่ง", price: 89, cost: 41, sku: "DEMO-013", stockQty: 100 },
    { name: "ข้าวผัดปู", category: "อาหารตามสั่ง", price: 95, cost: 45, sku: "DEMO-014", stockQty: 85 },
    { name: "ผัดซีอิ๊วหมู", category: "อาหารตามสั่ง", price: 75, cost: 31, sku: "DEMO-015", stockQty: 130 },
    { name: "ราดหน้าทะเล", category: "อาหารตามสั่ง", price: 95, cost: 46, sku: "DEMO-016", stockQty: 90 },
    { name: "ผัดพริกแกงหมูกรอบ", category: "อาหารตามสั่ง", price: 89, cost: 43, sku: "DEMO-017", stockQty: 95 },
    { name: "คะน้าหมูกรอบ", category: "อาหารตามสั่ง", price: 85, cost: 39, sku: "DEMO-018", stockQty: 100 },
    { name: "ไข่เจียวหมูสับ", category: "อาหารตามสั่ง", price: 65, cost: 25, sku: "DEMO-019", stockQty: 150 },
    { name: "ข้าวหมูทอดกระเทียม", category: "อาหารตามสั่ง", price: 79, cost: 33, sku: "DEMO-020", stockQty: 125 },
    { name: "ต้มยำกุ้งน้ำข้น", category: "ต้ม/แกง", price: 129, cost: 60, sku: "DEMO-021", stockQty: 70 },
    { name: "ต้มแซ่บกระดูกอ่อน", category: "ต้ม/แกง", price: 119, cost: 55, sku: "DEMO-022", stockQty: 65 },
    { name: "แกงส้มชะอมกุ้ง", category: "ต้ม/แกง", price: 139, cost: 68, sku: "DEMO-023", stockQty: 55 },
    { name: "แกงเขียวหวานไก่", category: "ต้ม/แกง", price: 109, cost: 50, sku: "DEMO-024", stockQty: 75 },
    { name: "น้ำเปล่า", category: "เครื่องดื่ม", price: 15, cost: 5, sku: "DEMO-025", stockQty: 250 },
    { name: "โค้ก", category: "เครื่องดื่ม", price: 25, cost: 11, sku: "DEMO-026", stockQty: 220 },
    { name: "ชาไทยเย็น", category: "เครื่องดื่ม", price: 35, cost: 14, sku: "DEMO-027", stockQty: 180 },
    { name: "เก๊กฮวย", category: "เครื่องดื่ม", price: 30, cost: 12, sku: "DEMO-028", stockQty: 175 },
    { name: "เฉาก๊วยนมสด", category: "ของหวาน", price: 45, cost: 18, sku: "DEMO-029", stockQty: 140 },
    { name: "ขนมปังกระเทียม", category: "ของทานเล่น", price: 49, cost: 19, sku: "DEMO-030", stockQty: 150 }
  ] as const;

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
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
