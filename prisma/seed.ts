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
    { name: "Americano", category: "Coffee", price: 70, cost: 24, sku: "COF-AMR", stockQty: 120 },
    { name: "Latte", category: "Coffee", price: 85, cost: 30, sku: "COF-LAT", stockQty: 100 },
    { name: "Croissant", category: "Bakery", price: 60, cost: 20, sku: "BAK-CRO", stockQty: 80 },
    { name: "Pad Krapow", category: "Main", price: 95, cost: 35, sku: "FOOD-PK", stockQty: 60 }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        category: product.category,
        price: product.price,
        cost: product.cost,
        stockQty: product.stockQty,
        isActive: true
      },
      create: {
        sku: product.sku,
        name: product.name,
        category: product.category,
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
