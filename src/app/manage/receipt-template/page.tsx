import { ReceiptTemplateForm } from "@/components/receipt-template-form";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReceiptTemplatePage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const [template, store] = await Promise.all([
    prisma.receiptTemplate.findFirst({ where: { isDefault: true } }),
    prisma.storeSetting.findUnique({ where: { id: 1 } })
  ]);

  const safeTemplate =
    template ||
    (await prisma.receiptTemplate.create({
      data: {
        name: "Default Receipt",
        isDefault: true
      }
    }));

  const safeStore =
    store ||
    (await prisma.storeSetting.create({
      data: {
        id: 1,
        businessName: "POS Shop",
        vatEnabled: true,
        taxRate: 7,
        currency: "THB"
      }
    }));

  return (
    <div>
      <ReceiptTemplateForm
        initialTemplate={{
          ...safeTemplate,
          customCss: safeTemplate.customCss ?? null
        }}
        store={{
          businessName: safeStore.businessName,
          branchName: safeStore.branchName,
          address: safeStore.address,
          phone: safeStore.phone,
          vatNumber: safeStore.vatNumber,
          receiptLogoUrl: safeStore.receiptLogoUrl,
          currency: safeStore.currency
        }}
      />
    </div>
  );
}
