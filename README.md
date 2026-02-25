# POS App (Next.js + PostgreSQL)

ระบบ POS ตัวอย่างที่มี:
- หน้าร้าน (POS)
- หน้าคนในครัว (Kitchen Board)
- หน้าสรุป (ยอดขาย + ต้นทุน + กำไร)
- หน้าใบเสร็จย้อนหลัง (ค้นหา/พิมพ์ซ้ำ)
- หน้า POS แสดงใบเสร็จย้อนหลังล่าสุด 10 ใบในหน้าเดียว
- หน้าจัดการ (ข้อมูลร้าน, สินค้า, ค่าใช้จ่าย)
- RBAC + Login (Cashier/Kitchen/Manager/Admin)
- ตัดสต็อกอัตโนมัติเมื่อขาย + ปรับสต็อก + inventory log
- Template ใบเสร็จแก้ไขได้ + หน้าใบเสร็จพิมพ์ได้
- ธีมระบบทั้งแอปสลับได้จาก Navbar (`Sandstone`, `Ocean Ink`, `Matcha Paper`, `Sunset Ledger`, `Graphite Night`)
- API สำหรับดาวน์โหลดคำสั่ง ESC/POS + คิวพิมพ์ (Print Queue)
- จัดการผู้ใช้งานและสิทธิ์จากหน้าแอดมิน
- แจ้งเตือนสินค้าสต็อกต่ำในหน้าจัดการ
- หน้า Inventory Log สำหรับตรวจสอบประวัติสต็อกย้อนหลัง
- หน้า Audit Log สำหรับดูประวัติการแก้ไข/การใช้งานย้อนหลัง
- หน้าสรุปมีกราฟกำไรรายวันและรายสัปดาห์
- รองรับคิวพิมพ์หลาย channel (`CASHIER_RECEIPT`, `KITCHEN_TICKET`)
- รองรับ export CSV สำหรับ Inventory Log และ Audit Log
- Printer agent มี auto-retry เมื่อพิมพ์ไม่สำเร็จ

## Tech Stack
- Next.js (App Router + TypeScript)
- Prisma ORM
- PostgreSQL

## 1) Setup
```bash
cp .env.example .env
# แก้ DATABASE_URL และ POS_SESSION_SECRET
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

เปิดที่:
- `http://localhost:3000/auth/login`
- Login ตัวอย่าง:
  - `cashier / 1111`
  - `kitchen / 2222`
  - `manager / 3333`
  - `admin / 9999`

## 2) โครงข้อมูลสำคัญ
- `AppUser`: ผู้ใช้ระบบ + role + PIN hash
- `Product`: สินค้า/เมนู พร้อม `price`, `cost`, `stockQty`
- `Order`, `OrderItem`: ข้อมูลขายและรายการต่อบิล
- `InventoryLog`: ประวัติการตัด/เติม/ปรับสต็อก
- `Expense`: ค่าใช้จ่ายแยกประเภท
  - `INGREDIENT` (ค่าของ)
  - `STAFF` (ค่าพนักงาน)
  - `ELECTRICITY` (ค่าไฟ)
  - `OTHER`
- `ReceiptTemplate`: เทมเพลตใบเสร็จ
- `StoreSetting`: ข้อมูลร้าน/ภาษี/สกุลเงิน
- `PrintJob`: คิวงานพิมพ์สำหรับ printer bridge
- `AuditLog`: เก็บกิจกรรมสำคัญของผู้ใช้และระบบ

## 3) RBAC
- `CASHIER`: ใช้หน้าร้าน + ออกใบเสร็จ + สร้าง print job
- `KITCHEN`: ใช้หน้าครัว
- `MANAGER`: ดู summary + จัดการสินค้า/ค่าใช้จ่าย/template/print queue
- `ADMIN`: สิทธิ์เหมือน manager ทั้งหมด
- หน้า `manage/users`: manager ดูข้อมูลได้, admin สร้าง/แก้ role/เปลี่ยน PIN/เปิดปิดผู้ใช้ได้

## 4) สูตรสรุปในหน้า Summary
- `ยอดขาย` = ผลรวมบิลที่ชำระแล้ว
- `ต้นทุนจากเมนู` = Σ (`unitCost x qty`)
- `ค่าใช้จ่ายรวม` = ต้นทุนจากเมนู + ค่าของ + ค่าพนักงาน + ค่าไฟ + อื่นๆ
- `กำไรสุทธิ` = ยอดขาย - ค่าใช้จ่ายรวม
- หน้า Summary มีกราฟ:
  - กำไรรายวัน (สูงสุดย้อนหลัง 62 วันตามช่วงที่เลือก)
  - กำไรรายสัปดาห์ (รวมจาก daily buckets)

## 5) สต็อก
- เมื่อ `POST /api/orders` สำเร็จ ระบบจะตัดสต็อกสินค้าอัตโนมัติ
- ถ้าสต็อกไม่พอ ระบบจะตอบ `409` และบอกสินค้าที่ไม่พอ
- หน้า `manage/products` มีฟังก์ชันปรับสต็อก (+/-)
- หน้า `manage` มีบล็อกแจ้งเตือนสินค้าสต็อกต่ำ (threshold ค่าเริ่มต้น 10)

## 6) Template ใบเสร็จ
หน้า `manage/receipt-template` ปรับได้:
- ข้อความหัว/ท้าย
- กระดาษ 58mm / 80mm
- แสดงข้อมูลร้าน/เลขภาษี
- แสดงต้นทุนประมาณการ
- ใส่ custom CSS
- เลือก Theme Presets พร้อมดูตัวอย่างก่อน apply (`Classic Thermal`, `Modern Cafe`, `Compact Fast`, `VAT Formal`)

รองรับ placeholders:
- `{{businessName}}`
- `{{branchName}}`
- `{{orderNumber}}`
- `{{date}}`
- `{{subtotal}}`
- `{{discount}}`
- `{{tax}}`
- `{{total}}`

## 7) การพิมพ์ใบเสร็จ
1. Receipt Modal:
- หลังชำระเงิน POS จะเปิด `Receipt Modal` ในหน้าเดิม และดาวน์โหลดใบเสร็จ PDF ได้ทันที
- หน้า `receipts` ใช้ดูใบเสร็จย้อนหลังและเปิดพิมพ์ผ่าน modal แบบเดียวกัน
- ใน modal มีรายการเครื่องปริ้นให้เลือกก่อนกดส่งคิวพิมพ์ (ทั้งใบเสร็จและบิลครัว)
  - รายการเครื่องปริ้นดึงจากระบบปฏิบัติการของเครื่องนั้นโดยตรง (Linux/macOS ผ่าน `lpstat`, Windows ผ่าน `Get-Printer`)

2. Receipt PDF:
- ใช้ endpoint: `/api/receipts/:id/pdf`
- ระบบสร้างไฟล์ด้วย `pdfmake` และฟอนต์ `Sarabun` ใน `assets/fonts`
- รองรับข้อความภาษาไทยในใบเสร็จ

3. ESC/POS text (direct download):
- ใช้ endpoint: `/api/print/receipt/:id`
- endpoint จะคืน text command สำหรับเครื่องพิมพ์ที่รองรับ ESC/POS
- สามารถนำไปส่งผ่าน local print bridge (USB/LAN) ได้

4. Print Queue:
- ปุ่มคิวพิมพ์ที่หน้าใบเสร็จส่งงานได้ 2 แบบ:
  - `CASHIER_RECEIPT` (ใบเสร็จ)
  - `KITCHEN_TICKET` (บิลครัว)
- เมื่อสร้างออเดอร์จาก POS ระบบจะ enqueue `KITCHEN_TICKET` ให้อัตโนมัติ
- หน้า `manage/print-jobs` ใช้ติดตามและอัปเดตสถานะคิว
- ถ้ามี printer agent ให้ส่ง header `x-printer-token: <PRINTER_AGENT_TOKEN>` เพื่อดึง/อัปเดตคิวพิมพ์ผ่าน API

5. Printer Agent (ตัวอย่างในโปรเจกต์):
```bash
POS_APP_URL=http://localhost:3000 \
PRINTER_AGENT_TOKEN=optional-printer-token \
PRINTER_CHANNEL=CASHIER_RECEIPT \
PRINTER_TARGET=cashier \
PRINTER_RETRY_ATTEMPTS=3 \
PRINTER_RETRY_DELAY_MS=800 \
PRINT_COMMAND='lpr -P YourPrinterName' \
npm run print:agent
```
- ถ้าไม่กำหนด `PRINT_COMMAND` agent จะพิมพ์ payload ออก console (เหมาะสำหรับ debug)
- ตัว agent จะ poll งานสถานะ `PENDING` ตาม `PRINTER_CHANNEL`/`PRINTER_TARGET` และอัปเดตเป็น `PRINTED` หรือ `FAILED`
- ถ้าพิมพ์ล้มเหลว agent จะ retry ตาม `PRINTER_RETRY_ATTEMPTS`
- ใน Receipt Modal จะเห็นสถานะ job แบบ realtime หลังส่งคิว (`รอพิมพ์`, `พิมพ์เสร็จแล้ว`, `พิมพ์ไม่สำเร็จ`)

ตัวอย่างรัน 2 agent แยกเครื่อง:
```bash
# เครื่องแคชเชียร์
PRINTER_CHANNEL=CASHIER_RECEIPT PRINTER_TARGET=cashier npm run print:agent

# เครื่องครัว
PRINTER_CHANNEL=KITCHEN_TICKET PRINTER_TARGET=kitchen npm run print:agent
```

## 8) API หลัก
- Auth
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Users
  - `GET /api/users`
  - `POST /api/users` (admin)
  - `PATCH /api/users/:id` (admin)
- Inventory
  - `GET /api/inventory-logs`
  - `GET /api/inventory-logs/export`
- Receipts
  - `GET /api/receipts`
  - `GET /api/receipts/:id`
  - `GET /api/receipts/:id/pdf`
- Audit
  - `GET /api/audit-logs`
  - `GET /api/audit-logs/export`
- `POST /api/orders` สร้างบิล
- `GET /api/orders` ดูบิลวันนี้
- `GET/PATCH /api/kitchen` ดูคิว/อัปเดตสถานะครัว
- `GET /api/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET/PUT /api/receipt-template`
- `GET/POST /api/products`
- `PATCH /api/products/:id/stock`
- `GET/POST /api/expenses`
- `GET/PUT /api/store-settings`
- `GET /api/print/receipt/:id`
- `GET/POST /api/print/jobs`
  - `channel` และ `printerTarget` ใช้แยกคิวพิมพ์หลายเครื่อง
- `PATCH /api/print/jobs/:id`
- `GET /api/printers` ดึงรายการเครื่องปริ้นสำหรับ dropdown

## หมายเหตุ
ถ้าต้องการต่อเครื่องปริ้นแบบอัตโนมัติ (กดแล้วพิมพ์ทันทีไม่ผ่าน dialog browser) ควรเพิ่ม service กลางในเครื่องร้าน เช่น:
- Node print daemon
- CUPS bridge
- หรือ agent ที่รับ ESC/POS แล้วส่งไปเครื่องพิมพ์โดยตรง
