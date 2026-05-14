# Smart NGOB — System Flow

ระบบติดตามกำกับงบประมาณ ศูนย์อนามัยที่ 10 | Google Apps Script + Sheets

---

## 1) Tab Modules (UI)

| Tab | ชื่อแสดง | ฟังก์ชัน GAS หลัก | Sheet ที่ใช้ |
|-----|---------|-----------------|------------|
| dashboard | ภาพรวมผู้บริหาร | `getDashboardData` | DS2, DS5, DS6, DS3 |
| group | รายกลุ่มงาน | `getDashboardData` (groupSummary) | DS6 |
| detail | รายรหัสงบ | `getDashboardData` (tableRows) | DS2 |
| gfinput | อัปเดต GFMIS รายวัน | `getGFInputRows`, `saveGFInput` | DS2 |
| activities | กันเงินรายวัน | `listActivities`, `createActivity`, `updateActivity`, `deleteActivity` | DS6, DS5 |
| admin | % เบิกสายบริหาร | `manualRecalcAdminAlloc`, `overrideAdminAlloc` | DS5 |
| transfer | รอบโอนงบ | `listTransferRounds`, `processTransferRound`, `updateTransferRoundMeta`, `deleteTransferRound` | DS7, DS2 |
| exec | สรุปผู้บริหาร | `getDashboardData` | DS2, DS5, DS6, DS3 |
| logs | ประวัติการใช้งาน | `getRecentLogs` | DS4 |
| plan | แผนงานโครงการ | `getProjects`, `saveProject` | DS8, DS9 (dev) |
| **reports** | **รายงาน** | `getDashboardData` | DS2, DS3, DS5, DS6 |

### tab-reports (รายละเอียด)
แสดง 6 sections:
- **A** KPI strip: งบจัดสรร / เบิกจ่ายสะสม / % vs เป้า / คงเหลือ
- **B** Hero card + Donut chart: % เบิกรวม + สัดส่วน Wallet A/B/C/D
- **C** Admin line bars: แท่ง % เบิกต่อสายบริหาร (เขียว/น้ำเงิน/แดง)
- **D** Monthly stacked bar + Watchlist alerts
- **E** Wallet breakdown table: Type | จัดสรร | เบิก | คงเหลือ | % | สถานะ
- **F** Alert list + Executive summary text

---

## 2) Data Sheets Reference

| Sheet | บทบาท | เขียนโดย | อ่านโดย |
|-------|--------|---------|--------|
| DS0_Staging | พื้นที่พัก paste GFMIS | `stagingImport` | `confirmImport` |
| DS1_Transactions | Audit log ธุรกรรม | `confirmImport`, `saveGFInput` | `_bootstrapActivitiesFromTransactions` |
| **DS2_MasterBudget** | **งบจัดสรรรายรหัส (แกนหลัก)** | `confirmImport`, `saveGFInput`, `_syncMasterAllocFromDS7` | `getDashboardData`, `getGFInputRows` |
| DS3_Targets | เป้าเบิกจ่ายรายเดือน (%) | seed / manual | `getDashboardData` |
| DS4_Logs | System audit log | `_log` (ทุก operation) | `getRecentLogs` |
| DS5_AdminAlloc | สรุปสายบริหาร/Pool | `_recalcAdminAlloc`, `_syncActivitiesToDS5` | `getDashboardData`, tab-admin |
| DS6_Activities | สมุดกันเงิน/กิจกรรม (soft delete) | `createActivity`, `updateActivity`, `deleteActivity` | `listActivities`, `_syncActivitiesToDS5` |
| DS7_Transfers | ประวัติรอบโอนงบ | `processTransferRound`, `_recordTransferItems` | `listTransferRounds`, `_syncMasterAllocFromDS7` |
| DS8_Projects | โครงการรายปี | `saveProject` | `getProjects` (dev) |
| DS9_Activities | กิจกรรมย่อยในโครงการ | `saveActivity` | `getActivities` (dev) |
| source | Master dropdown/reference | seed / manual | ทุก form ที่มี dropdown |

**คอลัมน์สำคัญใน source:** col A = `Admin_Line`, col E = `กลุ่มงาน` (ใช้ mapping group→adminLine)

---

## 3) Data Flows

### Flow A: นำเข้างบจาก GFMIS (รอบโอน)
```
User (tab-import)
  → paste ข้อมูล
  → stagingImport()         → DS0_Staging (write)
  → [user กด ยืนยัน]
  → confirmImport()
      ├─ DS2_MasterBudget   (update Alloc/PO/Paid)
      ├─ DS1_Transactions   (append audit row)
      ├─ DS7_Transfers      (append ถ้ามี transferDate)
      └─ _recalcAdminAlloc() → DS5_AdminAlloc (recalc)
```

### Flow B: อัปเดต PO/เบิกรายวัน
```
User (tab-gfinput)
  → โหลด: getGFInputRows()  ← DS2_MasterBudget (read)
  → แก้ PO/Paid
  → saveGFInput()
      ├─ DS2_MasterBudget   (update PO_Now, Paid_Now, Remaining)
      └─ DS4_Logs           (append log)
```

### Flow C: กันเงิน/กิจกรรม (CRUD)
```
User (tab-activities)
  → เลือกกลุ่มงาน → Admin_Line auto-fill จาก source sheet
  → createActivity / updateActivity / deleteActivity
      ├─ DS6_Activities     (write/update/soft-delete)
      └─ _syncActivitiesToDS5()
            └─ DS5_AdminAlloc (recalc ยอดเบิกต่อสายบริหาร)

หมายเหตุ:
  - Admin_Line (DS6 col 3) ขับยอดรวมใน DS5 โดยตรง
  - ถ้า auto-map ผิด ให้แก้ที่ source (col A+E) แล้ว recalculate
```

### Flow D: บริหารรอบโอน (CRUD)
```
User (tab-transfer)
  → processTransferRound()  → DS7_Transfers (append หัวรอบ + รายการย่อย)
  → updateTransferRoundMeta() → DS7_Transfers (update metadata)
  → deleteTransferRound()
      ├─ DS7_Transfers       (mark deleted)
      └─ _syncMasterAllocFromDS7()
            └─ DS2_MasterBudget (recalc Alloc_Total จากรอบที่เหลือ)

หมายเหตุ: ไม่จำกัดจำนวนรอบ (R1, R2, R3, ... Rn)
```

### Flow E: รายงาน (Reports)
```
User (tab-reports / tab-dashboard / tab-exec)
  → getDashboardData(fiscalYear)
      ├─ DS2_MasterBudget   (งบจัดสรร, PO, Paid, Remaining)
      ├─ DS3_Targets         (เป้าเบิกรายเดือน)
      ├─ DS5_AdminAlloc      (สรุปสายบริหาร)
      └─ DS6_Activities      (ยอดกันเงิน/กิจกรรม)
  → render ฝั่ง client
      ├─ tab-dashboard: KPI card + group summary
      ├─ tab-exec: trend chart + pool ratio
      └─ tab-reports: 6 sections (KPI, hero %, donut, admin bars, monthly, wallet table)
```

---

## 4) Key Functions Index

| Function | Module | รับ | คืน |
|----------|--------|-----|-----|
| `doGet()` | Entry | - | HtmlOutput (web app) |
| `getDashboardData(fy)` | Dashboard | fiscalYear | Object (kpi, tableRows, groupSummary, adminSummary, targets) |
| `stagingImport(rows)` | Import | array of rows | staging result |
| `confirmImport(date, fy)` | Import | transferDate, fiscalYear | import summary |
| `setInitialBalance(id, ip, ipo, date)` | Import | budget params | - |
| `getGFInputRows(fy)` | GFInput | fiscalYear | array |
| `saveGFInput(updates)` | GFInput | array of updates | result |
| `listActivities(fy, kw, page, size)` | Activities | params | paginated list |
| `createActivity(payload, fy)` | Activities | payload | new row |
| `updateActivity(id, payload, fy)` | Activities | id + payload | updated row |
| `deleteActivity(id, fy, reason)` | Activities | id + reason | - |
| `_syncActivitiesToDS5(fy)` | Sync | fiscalYear | - |
| `listTransferRounds(fy)` | Transfer | fiscalYear | array |
| `processTransferRound(date, fy, desc)` | Transfer | params | round object |
| `deleteTransferRound(roundId, fy)` | Transfer | roundId | - |
| `_syncMasterAllocFromDS7(fy, codes)` | Sync | fiscalYear, budgetCodes | - |
| `manualRecalcAdminAlloc(fy)` | Admin | fiscalYear | - |
| `overrideAdminAlloc(id, amount, note)` | Admin | allocId + override | - |
| `getRecentLogs(n)` | Logs | n rows | array |
| `autoClassifyWalletTypes(fy, onlyPending)` | Classify | params | summary |

---

## 5) Gotchas / ข้อควรระวัง

- **ห้ามแก้ Sheet โดยตรง** — ยอดข้ามชีทจะไม่ sync ถ้าไม่ผ่านฟังก์ชัน
- **รอบโอน**: ใส่ `transferDate` ก่อนยืนยัน เพื่อให้ trace ลง DS7 ชัดเจน
- **ลบรอบโอน**: ต้องทำผ่าน tab-transfer เท่านั้น ถึงจะ sync DS2 ย้อนกลับ
- **Admin_Line**: ถ้า auto-fill ผิด แก้ที่ `source` sheet (col A + col E) แล้ว recalculate DS5 — ไม่ต้อง deploy ใหม่
- **DS6 soft delete**: row ที่ `Is_Deleted = true` จะไม่นับในยอดรวม DS5
- **Wallet_Type X**: ยกเว้นจาก RBJ pool — ไม่นับในเป้าเบิก A+B+C+D
- **DS8/DS9**: module แผนงานโครงการยังอยู่ระหว่างพัฒนา — ยังไม่ production ready
