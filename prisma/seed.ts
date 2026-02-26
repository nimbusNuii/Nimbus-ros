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
    {
      name: "Americano",
      category: "Coffee",
      price: 70,
      cost: 24,
      sku: "COF-AMR",
      stockQty: 120,
      imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80"
    },
    {
      name: "Latte",
      category: "Coffee",
      price: 85,
      cost: 30,
      sku: "COF-LAT",
      stockQty: 100,
      imageUrl: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80"
    },
    {
      name: "Croissant",
      category: "Bakery",
      price: 60,
      cost: 20,
      sku: "BAK-CRO",
      stockQty: 80,
      imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80"
    },
    {
      name: "Pad Krapow",
      category: "Main",
      price: 95,
      cost: 35,
      sku: "FOOD-PK",
      stockQty: 60,
      imageUrl: "https://images.unsplash.com/photo-1562967916-eb82221dfb22?auto=format&fit=crop&w=600&q=80"
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        category: product.category,
        imageUrl: product.imageUrl,
        price: product.price,
        cost: product.cost,
        stockQty: product.stockQty,
        isActive: true
      },
      create: {
        sku: product.sku,
        name: product.name,
        category: product.category,
        imageUrl: product.imageUrl,
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
    { name: "ลูกค้าขาจร", type: "WALK_IN", phone: null, note: "ลูกค้าทั่วไป" },
    { name: "คุณสมชาย", type: "REGULAR", phone: "0811111111", note: "ลูกค้าประจำช่วงเช้า" },
    { name: "บริษัท ABC", type: "REGULAR", phone: "020000000", note: "รับใบกำกับภาษี" }
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
