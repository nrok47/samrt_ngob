# Smart NGOB — Project Context

## Project Overview
**Smart Budget Tracking (Smart NGOB)**
ระบบติดตามกำกับงบประมาณ ศูนย์อนามัยที่ 10 อุบลราชธานี
- ติดตามการเบิกจ่าย/กันเงิน/รอบโอนงบจาก GFMIS
- แสดงผล dashboard ผู้บริหาร + รายงานตามสายบริหาร
- ปีงบประมาณปัจจุบัน: 2569

---

## Stack & Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Google Apps Script (`Code.gs`) |
| Frontend | HTML templates: `index.html`, `tab_*.html`, `scripts.html`, `styles.html` |
| Database | Google Sheets (DS0–DS9 + `source`) |
| Styling | Tailwind CSS + Sarabun font |
| Icons | Font Awesome 6.5 |
| Dialogs | SweetAlert2 |
| Deploy | `clasp push` → GAS Editor → Deploy as Web App |

### Sheets (Data Sources)
| Sheet | บทบาท |
|-------|--------|
| DS0_Staging | พื้นที่พัก paste จาก GFMIS ก่อนยืนยัน |
| DS1_Transactions | Audit log ธุรกรรมงบ/เบิก/PO |
| **DS2_MasterBudget** | **แกนหลัก** — งบจัดสรรรายรหัส (Wallet_Type, Alloc, PO, Paid) |
| DS3_Targets | เป้าเบิกจ่ายรายเดือน (%) |
| DS4_Logs | System audit log |
| DS5_AdminAlloc | สรุปตามสายบริหาร (คำนวณจาก DS6) |
| DS6_Activities | สมุดกันเงิน/กิจกรรมรายวัน (CRUD + soft delete) |
| DS7_Transfers | ประวัติรอบโอนงบ (ไม่จำกัดรอบ) |
| DS8_Projects | โครงการรายปี (กำลังพัฒนา) |
| DS9_Activities | กิจกรรมย่อยในโครงการ (กำลังพัฒนา) |
| source | Master dropdown — กลุ่มงาน, สายบริหาร, รหัสงบ |

### Wallet Types
| Type | ความหมาย | นับใน RBJ |
|------|----------|----------|
| A | ยุทธศาสตร์ (50%) | ✓ |
| B | นโยบาย (20%) | ✓ |
| C | บริหาร/พื้นฐาน (30%) | ✓ |
| D | สิทธิ | ✓ |
| E | บุคลากร | ✗ |
| F | ลงทุน | ✗ |
| X | ยกเว้น | ✗ |

---

## UI Tabs (11 รายการ)
| Tab | ชื่อ | หน้าที่ |
|-----|------|--------|
| dashboard | ภาพรวม | KPI หลัก — จัดสรร/เบิก/PO/คงเหลือ/GFMIS diff |
| group | รายกลุ่มงาน | สรุปตามกลุ่มงานจาก DS6 |
| detail | รายรหัสงบ | ตารางรายรหัสจาก DS2 |
| gfinput | อัปเดต GFMIS รายวัน | บันทึก PO/Paid เข้า DS2 |
| activities | กันเงินรายวัน | CRUD DS6 + sync DS5 |
| admin | % เบิกสายบริหาร | สรุป DS5 + override |
| transfer | รอบโอนงบ | CRUD DS7 + sync DS2 |
| exec | สรุปผู้บริหาร | KPI trend/สัดส่วน pool |
| logs | ประวัติการใช้งาน | DS4 logs |
| plan | แผนงานโครงการ | Gantt + DS8/DS9 (dev) |
| **reports** | **รายงาน** | KPI strip, donut, admin bars, monthly trend, wallet table, alerts |

---

## Dev Workflow
1. แก้ไขไฟล์ใน VS Code
2. `clasp push` ทุกครั้งหลังแก้ (ไม่มี hot reload)
3. เปิด GAS Web App URL ทดสอบผ่าน browser
4. ไม่มี automated tests — ทดสอบมือ

---

## Rules สำหรับ Claude
- **`clasp push` ทุกครั้ง** หลังแก้ไขไฟล์ใดๆ ก่อนบอก user ว่าเสร็จ
- **ห้ามแนะนำแก้ Sheet โดยตรง** — ต้องผ่านฟังก์ชันใน Code.gs เสมอ
- **DS2_MasterBudget** = single source of truth ของงบจัดสรร
- **Admin_Line** ใน DS6 ขับยอดรวม DS5 — mapping มาจาก `source` sheet (col A = Admin_Line, col E = กลุ่มงาน)
- การแก้ mapping ให้แก้ที่ `source` sheet แล้วกด Recalculate DS5 (ไม่ต้อง deploy ใหม่)
- รอบโอนงบรองรับ **ไม่จำกัดจำนวนรอบ** (ไม่ lock แค่ R1–R3)
