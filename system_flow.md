# สรุประบบ: โมดูลหน้าเว็บ + โครงสร้างการเก็บข้อมูลใน Google Sheet

เอกสารนี้สรุปการทำงานของแต่ละหน้าใน `index.html` และความสัมพันธ์กับชีทข้อมูลใน `code.gs` เพื่อใช้เป็นคู่มือดูแลระบบ/ส่งต่องาน

---

## 1) โครงสร้างโมดูลหน้าเว็บ (UI Tabs)

## `tab-dashboard` ภาพรวมผู้บริหาร
- แสดง KPI หลัก: งบจัดสรร, เบิกจ่าย, PO, คงเหลือ, ความต่างเทียบ GFMIS
- อ่านข้อมูลผ่าน `getDashboardData(fiscalYear)`
- ใช้ข้อมูลรวมจาก `DS2_MasterBudget` + `DS6_Activities` + `DS5_AdminAlloc` + `DS3_Targets`

## `tab-group` รายละเอียดตามกลุ่มงาน
- แสดงสรุปตามกลุ่มงานจากข้อมูลกันเงิน/กิจกรรม
- ใช้ข้อมูล `groupSummary` ที่สร้างจาก `DS6_Activities`

## `tab-detail` รายละเอียดรายรหัสงบ
- ตารางรายรหัสงบ (แผนงาน/รหัส/จัดสรร/เบิก/PO/คงเหลือ)
- ข้อมูลจาก `tableRows` ใน `getDashboardData` (ฐานจาก `DS2_MasterBudget`)

## `tab-import` นำเข้าข้อมูล GFMIS
- Step 1: วางข้อมูลจาก GFMIS แล้วตรวจ (`parsePaste -> stagingImport`)
- Step 2: ยืนยันนำเข้า (`confirmImport`)
- Step 3: ตั้งยอดยกมา (`setInitialBalance`)
- ถ้ามี `transferDate` จะบันทึกรายการโอนเข้า `DS7_Transfers` ด้วย

## `tab-gfinput` อัปเดต GFMIS รายวัน
- โหลดรายการจาก `getGFInputRows`
- บันทึก PO/เบิกวันนี้ผ่าน `saveGFInput`
- อัปเดตกลับเข้า `DS2_MasterBudget` ทันที

## `tab-activities` สมุดกันเงินรายวัน (CRUD)
- อ่านรายการ: `listActivities`
- เพิ่ม/แก้ไข/ลบ: `createActivity`, `updateActivity`, `deleteActivity`
- นำเข้าแบบวางข้อความ: `importActivities`
- ทุกการเปลี่ยนจะ sync ผลไป `DS5_AdminAlloc` ผ่าน `_syncActivitiesToDS5`

## `tab-admin` % เบิกจ่ายตามสายบริหาร
- แสดงสรุปสายบริหารจาก `DS5_AdminAlloc`
- รองรับ override ผ่าน `overrideAdminAlloc` / `resetAdminAllocOverride`
- ปุ่ม Recalculate เรียก `manualRecalcAdminAlloc`

## `tab-transfer` รอบการโอนงบประมาณ (CRUD รอบโอน)
- แสดงรอบโอนแบบไม่จำกัดจำนวนรอบจาก `DS7_Transfers` (ไม่ล็อกแค่ R1-R3)
- Create รอบใหม่: `processTransferRound`
- Read ประวัติรอบ: `listTransferRounds` / `getTransferHistory`
- Update metadata รอบ: `updateTransferRoundMeta`
- Delete รอบ: `deleteTransferRound` (พร้อม sync ย้อนกลับเข้า `DS2_MasterBudget` โดย `_syncMasterAllocFromDS7`)

## `tab-exec` สรุปผู้บริหาร (Executive Dashboard)
- KPI/แนวโน้มเดือน/สัดส่วน pool/กลุ่มงาน
- ใช้ข้อมูลจาก `getDashboardData` ชุดเดียวกับ dashboard หลัก แต่ render มุมผู้บริหาร

## `tab-logs` ประวัติการใช้งาน
- ดึงจาก `getRecentLogs`
- แหล่งข้อมูลคือ `DS4_Logs`

---

## 2) โครงสร้างชีทข้อมูล (Data Sheets)

## `DS0_Staging`
- พื้นที่พักข้อมูลที่ผู้ใช้ paste จาก GFMIS ก่อนยืนยันนำเข้า
- ถูกเขียนโดย `stagingImport`
- ถูกอ่านโดย `confirmImport`
- หลังยืนยันจะเปลี่ยนสถานะเป็น “นำเข้าแล้ว …”

## `DS1_Transactions`
- เก็บธุรกรรมการอัปเดตงบ/เบิก/PO ทุกครั้ง (audit เชิงธุรกรรม)
- เขียนโดย `confirmImport` และบาง flow ของ `saveGFInput`
- ใช้สำหรับ bootstrap กิจกรรมบางกรณี (`_bootstrapActivitiesFromTransactions`)

## `DS2_MasterBudget` (แกนหลัก)
- master รายรหัสงบแต่ละปีงบ
- ฟิลด์สำคัญ: `Wallet_Type`, `Alloc_R1..R3`, `Alloc_Total`, `PO_Now`, `Paid_Now`, `Remaining`, `Fiscal_Year`
- ใช้เป็นฐาน dashboard หลักและรายละเอียดรายรหัส
- หมายเหตุ: ระบบรองรับรอบโอนไม่จำกัดผ่าน `DS7`; ส่วน `R1..R3` ใช้เพื่อความเข้ากันได้ย้อนหลัง/มุมมองรวม

## `DS3_Targets`
- เป้าหมายการเบิกจ่ายรายเดือน/สะสม (%)
- ใช้ใน dashboard และ executive trend

## `DS4_Logs`
- audit log ของระบบ (module/action/detail/status/duration)
- เขียนผ่าน helper `_log`

## `DS5_AdminAlloc`
- ตารางจัดสรรตามสายบริหาร/Pool
- สร้างและคำนวณโดย `_recalcAdminAlloc`
- ยอดเบิกฝั่งสายบริหาร sync จาก `DS6_Activities` ผ่าน `_syncActivitiesToDS5`
- รองรับการ override รายแถว

## `DS6_Activities`
- สมุดกันเงิน/กิจกรรมรายวัน (CRUD + soft delete)
- เป็นฐาน “ยอดเบิกจ่ายเชิงปฏิบัติการ” ในหลายหน้า
- มีคอลัมน์ soft delete: `Is_Deleted`, `Deleted_At`, `Deleted_By`, `Delete_Reason`

## `DS7_Transfers`
- ประวัติรอบโอนจากกรมแบบไม่จำกัดจำนวนรอบ
- 1 รอบ = แถวหัวรอบ (budgetCode ว่าง) + แถวรายการย่อย (budgetCode มีค่า)
- ใช้แสดงผลแท็บรอบโอน, สรุปรอบ, และ sync ย้อนกลับ DS2 หลังแก้/ลบรอบ

## `source`
- master dropdown/reference data (กลุ่มงาน, pool, wallet type, สถานะ, รหัสงบ ฯลฯ)
- ใช้เติมตัวเลือกในฟอร์มฝั่งเว็บ

---

## 3) Data Flow หลักของระบบ

## Flow A: นำเข้างบจาก GFMIS (รอบโอน)
1. ผู้ใช้ paste ในหน้า `นำเข้า GFMIS`
2. `stagingImport` เขียนลง `DS0_Staging`
3. ผู้ใช้ยืนยัน -> `confirmImport`
4. ระบบอัปเดต `DS2_MasterBudget` + ลงธุรกรรม `DS1_Transactions`
5. ถ้ามีวันที่รอบโอน ระบบบันทึกลง `DS7_Transfers`
6. ระบบ recalculated `DS5_AdminAlloc`

## Flow B: อัปเดต PO/เบิกรายวัน
1. หน้า `อัปเดต GFMIS รายวัน` โหลดข้อมูลจาก `DS2` (+ optional external GF_Input)
2. บันทึกผ่าน `saveGFInput`
3. อัปเดต `PO/Paid/Remaining` ใน `DS2` และลง log

## Flow C: กันเงิน/กิจกรรม
1. CRUD ที่ `tab-activities` เขียน `DS6_Activities`
2. ทุกครั้งที่แก้ จะ sync สะท้อนยอดไป `DS5_AdminAlloc`
3. Dashboard และ admin summary ดึงผลรวมจาก DS6/DS5

## Flow D: บริหารรอบโอน (CRUD รอบ)
1. สร้างรอบ: `processTransferRound` -> `DS7`
2. แก้ metadata รอบ: `updateTransferRoundMeta`
3. ลบรอบ: `deleteTransferRound`
4. หลังลบ -> `_syncMasterAllocFromDS7` เพื่อคำนวณยอดจัดสรรใน `DS2` ใหม่จากรอบที่เหลือ

---

## 4) ฟังก์ชัน Utility/Operation สำคัญ

- `setupSheets` / `initializeSystem`: สร้างชีทและ header ที่จำเป็น
- `resetFiscalYear` / `resetFY2569`: ล้างข้อมูลเฉพาะปีงบ
- `autoClassifyWalletTypes`: จัดประเภท A/B/C/D อัตโนมัติ
- `identifyDashboardFailure`: ช่วยวินิจฉัยเมื่อ dashboard โหลดไม่ขึ้น

---

## 5) ข้อควรระวังในการใช้งาน

- การนำเข้ารอบโอนควรใส่วันที่รอบก่อนยืนยัน เพื่อให้ trace ลง `DS7` ชัดเจน
- ถ้าต้องแก้/ลบรอบโอน ให้ทำผ่าน CRUD ของแท็บ `รอบโอนงบ` เพื่อให้ `DS2` sync ตามอัตโนมัติ
- การแก้ข้อมูลตรงในชีทโดยไม่ผ่านฟังก์ชัน อาจทำให้ยอดข้ามชีทไม่สอดคล้องกัน

