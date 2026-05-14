/**
 * ═══════════════════════════════════════════════════════════════
 *  GFMIS Smart Wallet Dashboard — ศูนย์อนามัยที่ 10
 *  Code.gs v3 | รองรับ: โอนหลายรอบ + สัดส่วนกรม + drill-down สายบริหาร
 * ═══════════════════════════════════════════════════════════════
 *
 *  Sheet structure v3:
 *  DS0_Staging        พื้นที่ paste GFMIS ดิบ
 *  DS1_Transactions   ธุรกรรมทุกรายการ (auto-log)
 *  DS2_MasterBudget   กระเป๋า GFMIS (รองรับหลายรอบโอน)
 *  DS3_Targets        เป้าหมายรายเดือน
 *  DS4_Logs           Audit trail
 *  DS5_AdminAlloc     การแบ่งสายบริหาร (คำนวณ+แก้มือได้)
 *  DS6_Activities     กิจกรรมรายสาย (จากชีทกันเงิน)
 *  DS7_Transfers      ประวัติรอบโอนงบ (ไม่จำกัดรอบ)
 *  source             Dropdown lists
 *
 *  DS2 columns (v3 — แทนที่ Allocated อันเดียวด้วย multi-round):
 *  [0]  Budget_ID          [1]  แผนงาน
 *  [2]  รหัสงบประมาณ       [3]  สายบริหาร_GFMIS
 *  [4]  ประเภทงบ           [5]  Wallet_Type (A/B/C/D)
 *  [6]  Include_In_Budget  [7]  Earmarked_For
 *  [8]  Alloc_R1           [9]  Date_R1
 *  [10] Alloc_R2           [11] Date_R2
 *  [12] Alloc_R3           [13] Date_R3
 *  [14] Alloc_Total        [15] Initial_Paid
 *  [16] Initial_PO         [17] Initial_Date
 *  [18] PO_Now             [19] Paid_Now
 *  [20] Paid_Alt           [21] Remaining
 *  [22] Updated            [23] Status
 *  [24] Fiscal_Year
 *
 *  DS5 columns (สายบริหาร):
 *  [0]  Alloc_ID           [1]  ปีงบประมาณ
 *  [2]  Admin_Line         [3]  Budget_Pool (นโยบาย/ยุทธ/พื้นฐาน)
 *  [4]  Pool_Pct           [5]  Alloc_Amount (คำนวณ หรือ override)
 *  [6]  Is_Override        [7]  Override_Amount
 *  [8]  Paid_Amount        [9]  Updated
 *  [10] หมายเหตุ
 *
 *  DS6 columns (กิจกรรมรายสาย — นำเข้าจาก กันเงิน):
 *  [0]  Act_ID  [1] วันที่  [2] กลุ่มงาน  [3] Admin_Line
 *  [4]  กิจกรรม [5] งบประมาณ [6] เบิกจ่าย [7] สถานะ [8] ประเภท
 *  [9]  โครงการ [10] รหัสงบประมาณ
 *  [11] Is_Deleted [12] Deleted_At [13] Deleted_By [14] Delete_Reason
 *
 *  DS7 columns (ประวัติรอบโอน):
 *  [0] ID  [1] Fiscal_Year  [2] Date  [3] Round_No
 *  [4] Plan_Name  [5] Budget_Code  [6] Amount  [7] Created_At
 */

const CONFIG = {
  SPREADSHEET_ID: '18YMnEE-HTnOn3tgDQM0tzcu3k1EDteBA5COhoojutPg',
  SYSTEM_PIN:     'hc10-2569',
  FISCAL_YEAR:    2569,
  TIMEZONE:       'GMT+7',
  // สัดส่วนตามกรมอนามัย (ปรับได้)
  POOL_RATIOS: {
    'นโยบาย':   0.2578,
    'ยุทธศาสตร์': 0.4422,
    'พื้นฐาน':  0.30,
  },
  // ────────────────────────────────────────────────
  // จำแนกประเภทกระเป๋างบประมาณ (A–F + X)
  // A+B+C+D = งบดำเนินงาน → ใช้คำนวณ % รบจ. ส่งกรม ทุกวันที่ 15
  // E = งบบุคลากร  |  F = งบลงทุน  |  X = ไม่นับ
  // ────────────────────────────────────────────────
  WALLET_META: {
    A: { label: 'ขับเคลื่อนยุทธศาสตร์',        short: 'ยุทธศาสตร์ (50%)', color: '#2457a0', bg: '#eff6ff', pool: 'ยุทธศาสตร์',  inRBJ: true  },
    B: { label: 'ขับเคลื่อนนโยบายเร่งด่วน',    short: 'นโยบาย (20%)',    color: '#7c3aed', bg: '#f5f3ff', pool: 'นโยบาย',    inRBJ: true  },
    C: { label: 'ค่าใช้จ่ายบริหาร/พื้นฐาน',    short: 'พื้นฐาน (30%)',   color: '#0d9488', bg: '#f0fdfa', pool: 'พื้นฐาน',   inRBJ: true  },
    D: { label: 'ค่าใช้จ่ายตามสิทธิ์',          short: 'ตามสิทธิ์',        color: '#d97706', bg: '#fffbeb', pool: 'ตามสิทธิ์', inRBJ: true  },
    E: { label: 'งบบุคลากร',                     short: 'บุคลากร',          color: '#64748b', bg: '#f8fafc', pool: 'บุคลากร',  inRBJ: false },
    F: { label: 'งบลงทุน',                       short: 'ลงทุน',             color: '#b45309', bg: '#fef3c7', pool: 'ลงทุน',    inRBJ: false },
    X: { label: 'ไม่นับ/ยกเว้น',                 short: 'ยกเว้น',            color: '#94a3b8', bg: '#f1f5f9', pool: '',         inRBJ: false },
  },
};

// DS2 column index
const C2 = {
  ID:0,PLAN:1,CODE:2,ADMIN_GFMIS:3,BTYPE:4,
  WTYPE:5,INCLUDE:6,EARMARK:7,
  ALLOC_R1:8,DATE_R1:9,ALLOC_R2:10,DATE_R2:11,
  ALLOC_R3:12,DATE_R3:13,ALLOC_TOTAL:14,
  INIT_PAID:15,INIT_PO:16,INIT_DATE:17,
  PO:18,PAID:19,ALT:20,REMAIN:21,UPDATED:22,STATUS:23,
  FISCAL_YEAR:24,
};

// DS5 column index
const C5 = {
  ID:0,YEAR:1,LINE:2,POOL:3,PCT:4,
  ALLOC:5,OVERRIDE:6,OVERRIDE_AMT:7,
  PAID:8,UPDATED:9,NOTE:10,
};

// DS6 column index
const C6 = {
  ID:0,DATE:1,GROUP:2,ADMIN_LINE:3,ACTIVITY:4,
  BUDGET:5,PAID:6,STATUS:7,BTYPE:8,PROJECT:9,BUDGET_CODE:10,
  IS_DELETED:11,DELETED_AT:12,DELETED_BY:13,DELETE_REASON:14,
  PERSON:15,WTYPE:16,DURATION:17,
};

// ── Auto-assign Wallet Type จาก BTYPE (ประเภทงบ) ──────────────────────────
// A = 1.x ขับเคลื่อนยุทธศาสตร์กลุ่มงาน
// B = 2.x ขับเคลื่อนนโยบาย/Healthy Workplace
// C = 3.x ค่าใช้จ่ายพื้นฐาน (ราชการ/สอย/สาธารณูปโภค)
// D = ค่าใช้จ่ายขั้นต่ำตามสิทธิ์ (เบิกแทน/สิทธิ์)
// E = งบบุคลากร (เงินเดือน/ค่าตอบแทนพนักงานราชการ)
// F = งบลงทุน (ครุภัณฑ์/สิ่งก่อสร้าง)
// H = เงินนอกงบประมาณ (ไม่ผ่าน GFMIS)
function _inferDS6Wtype(btype) {
  const s = String(btype || '').trim();
  if (!s) return 'A';
  // prefix-based (ชัดเจนที่สุด)
  if (/^1\./.test(s)) return 'A';
  if (/^2\./.test(s)) return 'B';
  if (/^3\./.test(s)) return 'C';
  // single-letter shorthand (legacy)
  if (/^[ABCDEFH]$/.test(s.toUpperCase())) return s.toUpperCase();
  // keyword-based สำหรับรายการที่ไม่มีเลขนำหน้า
  const sl = s.toLowerCase();
  if (sl.includes('นอกงบ') || sl.includes('เงินนอก')) return 'H';
  if (sl.includes('ขั้นต่ำตามสิทธิ์') || sl.includes('เบิกแทนกัน') || sl.includes('ค่าใช้จ่ายขั้นต่ำ')) return 'D';
  if (sl.includes('บุคลากร') || sl.includes('ค่าตอบแทนพนักงาน') || sl.includes('เงินเดือน') || sl.includes('ประกันสังคม')) return 'E';
  if (sl.includes('ลงทุน') || sl.includes('ครุภัณฑ์') || sl.includes('สิ่งก่อสร้าง')) return 'F';
  return 'A'; // default
}

// DS8 column index
const C8 = {
  ID:0,FISCAL_YEAR:1,NAME:2,ADMIN_LINE:3,GROUP:4,
  WTYPE:5,BUDGET:6,NOTE:7,STATUS:8,CREATED_AT:9,
  START_MONTH:10,MEETING_DATE:11,
  M0:12,M1:13,M2:14,M3:15,M4:16,M5:17,
  M6:18,M7:19,M8:20,M9:21,M10:22,M11:23,
};

// DS9 column index  (กิจกรรมภายในโครงการ)
const C9 = {
  ID:0,PROJECT_ID:1,FISCAL_YEAR:2,NAME:3,
  MONTH:4,MEETING_DATE:5,BUDGET:6,
  STATUS:7,NOTE:8,
  ORIG_MONTH:9,CHANGE_REASON:10,
  CREATED_AT:11,UPDATED_AT:12,
};

// ─── Entry ───────────────────────────────────
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Smart ติดตามกำกับ งบประมาณ ศอ.10')
    .addMetaTag('viewport','width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// ─── Include helper (ใช้ใน index.html template) ───
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ─── Spreadsheet Menu (Container-bound) ─────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 ระบบงบประมาณ (น้องโมเม)')
    .addSubMenu(
      ui.createMenu('💰 Module 1: Wallet GFMIS')
        .addItem('📝 อัพเดตยอด GFMIS (PO/เบิกจริง)', 'openDailyUpdateForm')
        .addItem('💰 บันทึกยอดโอนเงินจากกรม (เพิ่มงบ)', 'showBudgetRoundForm')
    )
    .addSubMenu(
      ui.createMenu('📋 Module 2: จัดการแผนงาน')
        .addItem('➕ เพิ่ม/แก้ไข กิจกรรมในแผน', 'showActivityPlanForm')
        .addItem('📥 Import ข้อมูลจาก DOC_Export_ใหม่', 'migrateDocExportToPlan')
        .addItem('📊 ตรวจสอบสัดส่วนงบ (50/20/30)', 'checkBudgetRatios')
    )
    .addSubMenu(
      ui.createMenu('📝 Module 3: การกันเงิน/ขอเบิก')
        .addItem('➕ บันทึกคำขอกันเงิน (ลงสมุดกันเงิน)', 'showReservationForm')
    )
    .addItem('📊 ดูรายงานสรุป Wallet', 'openWalletDashboard')
    .addItem('🏷 จัดประเภท A/B/C/D อัตโนมัติ (ปีปัจจุบัน)', 'classifyCurrentFiscalYear')
    .addItem('⚙️ รีเซต/สร้าง Sheet ที่จำเป็น', 'initializeSystem')
    .addItem('🧹 ล้างข้อมูลทั้งหมด + ตั้งค่า FY2569 (Clean Slate)', 'cleanSlateAndInitFY2569')
    .addSeparator()
    .addItem('⚡ ตัวช่วยย้ายงบ GF ขาขึ้น (DS0 -> DS2)', 'autoMigrateMasterBudgetDS2')
    .addToUi();
}

function initializeSystem() {
  const res = setupSheets();
  SpreadsheetApp.getUi().alert(res && res.success ? 'Setup สำเร็จ' : 'Setup ไม่สำเร็จ', (res && res.message) || '-', SpreadsheetApp.getUi().ButtonSet.OK);
}

function openWalletDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Smart ติดตามกำกับ งบประมาณ ศอ.10')
    .setWidth(1280);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openDailyUpdateForm() {
  SpreadsheetApp.getUi().alert(
    'อัพเดตยอด GFMIS',
    'เปิดแดชบอร์ดใน Sidebar แล้วไปแท็บ "นำเข้า GFMIS" เพื่อวางข้อมูลและยืนยันนำเข้า',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  openWalletDashboard();
}

function showBudgetRoundForm() {
  SpreadsheetApp.getUi().alert(
    'บันทึกรอบโอน',
    'เปิดแดชบอร์ดใน Sidebar แล้วไปแท็บ "รอบโอนงบ" เพื่อบันทึกรอบโอนใหม่',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  openWalletDashboard();
}

function showReservationForm() {
  SpreadsheetApp.getUi().alert(
    'การกันเงิน/ขอเบิก',
    'เปิดแดชบอร์ดใน Sidebar แล้วไปแท็บ "สายบริหาร" ส่วน "รายละเอียดกันเงิน (CRUD)" เพื่อเพิ่ม/แก้ไข/ลบรายการ',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  openWalletDashboard();
}

// ─── Migration Tool ─────────────────────────────
function autoMigrateMasterBudgetDS2() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('ยืนยันแบบ Migration ขาขึ้น (งบจัดสรร)', 'ระบบจะอ่านรหัสงบประมาณและ "งบสุทธิ" จากชีท DS0_Staging (ที่คุณก๊อปปี้ GF_Input มาวางไว้) \n\nเพื่อสร้างเป็นฐานกระเป๋าเงิน "จัดสรร" ใน DS2_MasterBudget ให้โดยอัตโนมัติ \n\n(หากมีรหัสไหนใน DS2 อยู่แล้ว จะทำการอัปเดตยอดให้ตรงกัน)\n\nดำเนินการต่อไหม?', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const ss = _ss();
    const stSh = ss.getSheetByName('DS0_Staging');
    const mSh = ss.getSheetByName('DS2_MasterBudget');
    if (!stSh || !mSh) throw new Error('ไม่พบชีท DS0 หรือ DS2');
    
    const stData = stSh.getDataRange().getValues().slice(1);
    const mData = mSh.getDataRange().getValues();
    
    const ds2Map = {};
    for (let i = 1; i < mData.length; i++) {
      const code = String(mData[i][C2.CODE]).replace(/\s/g,'');
      const fy = Number(mData[i][C2.FISCAL_YEAR]);
      if (fy === CONFIG.FISCAL_YEAR) ds2Map[code] = i + 1;
    }
    
    let added = 0;
    let updated = 0;
    const appendRows = [];
    const dateStr = _toYmd(_now());
    
    stData.forEach(r => {
      const planName = String(r[0] || '').trim();
      const code = String(r[1] || '').replace(/\s/g,'');
      if (!code || code.length < 10) return;
      
      const netBudget = _n(r[2]);
      if (netBudget === 0) return;
      
      let wType = 'A';
      if (code.startsWith('2100914')) wType = 'B';
      else if (code.startsWith('90909')) wType = 'D';
      else if (['ครุภัณฑ์', 'เครื่อง', 'เตียง', 'ยูนิต', 'สิ่งก่อสร้าง'].some(x => planName.includes(x))) wType = 'C';
      
      if (ds2Map[code]) {
        const rowIdx = ds2Map[code];
        mSh.getRange(rowIdx, C2.ALLOC_R1 + 1).setValue(netBudget);
        mSh.getRange(rowIdx, C2.ALLOC_TOTAL + 1).setValue(netBudget); 
        mSh.getRange(rowIdx, C2.UPDATED + 1).setValue(_now());
        updated++;
      } else {
        const newId = 'B' + Utilities.getUuid().substring(0,8).toUpperCase();
        const newRow = Array(C2.FISCAL_YEAR + 1).fill('');
        newRow[C2.ID] = newId;
        newRow[C2.PLAN] = planName;
        newRow[C2.CODE] = code;
        newRow[C2.ADMIN_GFMIS] = 'ไม่ระบุ';
        newRow[C2.BTYPE] = 'ไม่ระบุ';
        newRow[C2.WTYPE] = wType;
        newRow[C2.INCLUDE] = 'TRUE';
        newRow[C2.ALLOC_R1] = netBudget;
        newRow[C2.DATE_R1] = dateStr;
        newRow[C2.ALLOC_TOTAL] = netBudget;
        newRow[C2.PO] = 0;
        newRow[C2.PAID] = 0;
        newRow[C2.REMAIN] = netBudget;
        newRow[C2.UPDATED] = _now();
        newRow[C2.STATUS] = 'Active';
        newRow[C2.FISCAL_YEAR] = CONFIG.FISCAL_YEAR;
        
        appendRows.push(newRow);
        ds2Map[code] = mData.length + appendRows.length;
        added++;
      }
    });
    
    if (appendRows.length > 0) {
      mSh.getRange(mSh.getLastRow() + 1, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
    }
    
    ui.alert('สำเร็จ!', `ดำเนินการเสร็จสิ้น:\n- สร้างรายการใหม่: ${added} รหัส\n- อัปเดตยอดรหัสเดิม: ${updated} รหัส\n\nยอดเงินตั้งต้นขาขึ้นทั้งหมด 18.4 ล้าน ถูกอัปเดตลง DS2 แล้ว คุณสามารถรีเฟรชหน้า Dashboard ดูผลได้เลยครับ`, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('เกิดข้อผิดพลาด', e.message, ui.ButtonSet.OK);
  }
}

// Module 2 (Roadmap)
function showActivityPlanForm() {
  SpreadsheetApp.getUi().alert('Module 2', 'ฟังก์ชันนี้ยังอยู่ใน Roadmap และจะทำต่อในเฟสถัดไป', SpreadsheetApp.getUi().ButtonSet.OK);
}
function migrateDocExportToPlan() {
  SpreadsheetApp.getUi().alert('Module 2', 'ยังไม่เปิดใช้งาน: Import DOC_Export_ใหม่', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Import DOC export (ไฟล์ .xls แบบ HTML table) เข้า DS8_Projects + DS9_Activities
 * @param {string} htmlText เนื้อไฟล์ .xls (จริงๆ เป็น HTML)
 * @param {Object=} options ตัวเลือกเสริม
 */
function importDocExportToPlan(htmlText, options) {
  try {
    const opt = options || {};
    const fy = Number(opt.fiscalYear || CONFIG.FISCAL_YEAR);
    const defaultAdminLine = String(opt.adminLine || '').trim();
    const defaultGroup = String(opt.group || '').trim();
    const defaultWtype = String(opt.wtype || 'A').trim().toUpperCase();
    const resetYear = String(opt.resetYear || '').toLowerCase() === 'true' || opt.resetYear === true;

    const html = String(htmlText || '');
    if (!html || html.length < 200) return { success: false, message: 'ไม่พบข้อมูลไฟล์ DOC export' };

    const parsed = _parseDocMonthlyHtml(html);
    if (!parsed || !parsed.projects.length) {
      return { success: false, message: 'อ่านไฟล์ไม่สำเร็จ: ไม่พบโครงการในตาราง DOC' };
    }

    const ss = _ss();
    let ds8 = ss.getSheetByName('DS8_Projects');
    let ds9 = ss.getSheetByName('DS9_Activities');
    if (!ds8 || !ds9) {
      setupSheets();
      ds8 = ss.getSheetByName('DS8_Projects');
      ds9 = ss.getSheetByName('DS9_Activities');
    }
    if (!ds8 || !ds9) return { success: false, message: 'ไม่พบ DS8/DS9' };

    if (resetYear) {
      _deleteRowsByFiscalYear(ds9, C9.FISCAL_YEAR, fy);
      _deleteRowsByFiscalYear(ds8, C8.FISCAL_YEAR, fy);
    }

    const ds8Rows = ds8.getDataRange().getValues();
    const ds9Rows = ds9.getDataRange().getValues();
    const projectKeyToId = {};
    const actKeySet = new Set();

    for (let i = 1; i < ds8Rows.length; i++) {
      const r = ds8Rows[i];
      if (!r[C8.ID] || Number(r[C8.FISCAL_YEAR]) !== fy) continue;
      const key = _docProjectKey(fy, String(r[C8.NAME] || ''));
      projectKeyToId[key] = String(r[C8.ID]);
    }
    for (let i = 1; i < ds9Rows.length; i++) {
      const r = ds9Rows[i];
      if (!r[C9.ID] || Number(r[C9.FISCAL_YEAR]) !== fy) continue;
      const key = _docActivityKey(fy, String(r[C9.PROJECT_ID] || ''), String(r[C9.NAME] || ''), r[C9.MONTH]);
      actKeySet.add(key);
    }

    const now = _now();
    const ds8Append = [];
    const ds9Append = [];
    let createdProjects = 0;
    let createdActivities = 0;

    parsed.projects.forEach((p, pi) => {
      const pName = String(p.name || '').trim();
      if (!pName) return;
      const pKey = _docProjectKey(fy, pName);
      let projectId = projectKeyToId[pKey];
      const pMonths = (Array.isArray(p.months) ? p.months : Array(12).fill(0)).map(v => _n(v));
      const pBudget = _n(p.total || pMonths.reduce((s, v) => s + _n(v), 0));

      if (!projectId) {
        projectId = 'P' + fy + '_' + Utilities.getUuid().substring(0, 8).toUpperCase();
        projectKeyToId[pKey] = projectId;
        ds8Append.push([
          projectId, fy, pName,
          defaultAdminLine, defaultGroup,
          defaultWtype, pBudget, 'นำเข้าจาก DOC Export', 'ยังไม่เริ่ม', now,
          '', '', ...pMonths
        ]);
        createdProjects++;
      }

      (p.activities || []).forEach((a, ai) => {
        const aName = String(a.name || '').trim();
        if (!aName) return;
        let hasMonthly = false;
        (a.months || []).forEach(v => { if (_n(v) > 0) hasMonthly = true; });

        // ถ้าไฟล์ไม่มีเดือนเลย ให้สร้าง 1 รายการเดือนว่างเพื่อให้เห็นกิจกรรมในระบบ
        if (!hasMonthly) {
          const k = _docActivityKey(fy, projectId, aName, '');
          if (actKeySet.has(k)) return;
          ds9Append.push([
            'A' + fy + '_' + Utilities.getUuid().substring(0, 8).toUpperCase(),
            projectId, fy, aName, '',
            '', _n(a.total || 0),
            'แผน', 'นำเข้าจาก DOC Export',
            '', '', now, now
          ]);
          actKeySet.add(k);
          createdActivities++;
          return;
        }

        for (let mi = 0; mi < 12; mi++) {
          const amt = _n((a.months || [])[mi]);
          if (amt <= 0) continue;
          const k = _docActivityKey(fy, projectId, aName, mi);
          if (actKeySet.has(k)) continue;
          ds9Append.push([
            'A' + fy + '_' + Utilities.getUuid().substring(0, 8).toUpperCase(),
            projectId, fy, aName, mi,
            '', amt,
            'แผน', 'นำเข้าจาก DOC Export',
            '', '', now, now
          ]);
          actKeySet.add(k);
          createdActivities++;
        }
      });
    });

    if (ds8Append.length) ds8.getRange(ds8.getLastRow() + 1, 1, ds8Append.length, ds8Append[0].length).setValues(ds8Append);
    if (ds9Append.length) ds9.getRange(ds9.getLastRow() + 1, 1, ds9Append.length, ds9Append[0].length).setValues(ds9Append);

    _log('PLAN', 'IMPORT_DOC', `FY ${fy} | projects +${createdProjects}, activities +${createdActivities}`);
    return {
      success: true,
      fiscalYear: fy,
      parsedProjects: parsed.projects.length,
      createdProjects,
      createdActivities,
      message: `นำเข้า DOC สำเร็จ: โครงการใหม่ ${createdProjects} | กิจกรรมใหม่ ${createdActivities}`
    };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}

function _deleteRowsByFiscalYear(sh, fyColIndex, fy) {
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return; // มีแค่ header
  const nCols = sh.getLastColumn() || 1;
  const data = sh.getRange(2, 1, lastRow - 1, nCols).getValues();
  const keep = data.filter(r => Number(r[fyColIndex]) !== Number(fy));
  // ล้างข้อมูลทั้งหมดก่อน (วิธีนี้หลีกเลี่ยง GAS error "cannot delete all non-frozen rows")
  sh.getRange(2, 1, lastRow - 1, nCols).clearContent();
  if (keep.length > 0) {
    sh.getRange(2, 1, keep.length, nCols).setValues(keep);
  }
}

function _docProjectKey(fy, projectName) {
  return String(fy) + '|' + String(projectName || '').trim().toLowerCase();
}
function _docActivityKey(fy, projectId, activityName, monthIndex) {
  return [fy, String(projectId || '').trim(), String(activityName || '').trim().toLowerCase(), String(monthIndex == null ? '' : monthIndex)].join('|');
}

function _docCleanText(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
function _docNum(v) {
  const s = String(v || '').replace(/,/g, '').replace(/[^\d.\-]/g, '').trim();
  if (!s) return 0;
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function _parseDocMonthlyHtml(html) {
  const monthNames = ['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  const tdRe = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi;
  const rows = [];
  let tr;
  while ((tr = trRe.exec(html)) !== null) {
    const rowHtml = tr[0];
    const cells = [];
    let td;
    while ((td = tdRe.exec(rowHtml)) !== null) {
      cells.push({
        attr: String(td[2] || ''),
        raw: String(td[3] || ''),
        text: _docCleanText(td[3] || '')
      });
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return { projects: [] };

  // หา row header ที่มีเดือนครบ
  let header = null;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].map(c => c.text);
    const hit = monthNames.filter(m => t.includes(m)).length;
    if (hit >= 8) { header = t; break; }
  }
  if (!header) return { projects: [] };

  const monthIdx = monthNames.map(m => header.indexOf(m));
  const totalIdx = header.indexOf('รวม');
  const statusIdx = header.indexOf('สถานะ');

  const projects = [];
  let current = null;
  let currentActivityName = '';

  const activityMapByProject = {}; // key: projectName -> { activityName -> obj }

  rows.forEach(cells => {
    const texts = cells.map(c => c.text);
    const joined = texts.join(' | ');
    // ปรับ index เมื่อแถวมี cell น้อยกว่า header เพราะ rowspan cell จาก row ก่อนหน้าไม่ปรากฏซ้ำ
    // (เช่น ชื่อโครงการที่มี rowspan=N จะทำให้แถวกิจกรรมขาด cell นั้น → ทุก index เลื่อนซ้าย)
    const adj = texts.length < header.length ? texts.length - header.length : 0;
    const rowMonthVals = monthIdx.map(ix => {
      if (ix < 0) return 0;
      const adjIx = ix + adj;
      return (adjIx >= 0 && adjIx < texts.length) ? _docNum(texts[adjIx]) : 0;
    });
    const adjTotalIx = totalIdx >= 0 ? totalIdx + adj : -1;
    const rowTotal = (adjTotalIx >= 0 && adjTotalIx < texts.length)
      ? _docNum(texts[adjTotalIx])
      : rowMonthVals.reduce((s, v) => s + v, 0);

    // ── project header (rowspan ใหญ่) ───────────────────────────
    const rowspanCells = cells.filter(c => /rowspan\s*=\s*"?\d+/i.test(c.attr) && c.text && c.text !== '#');
    if (rowspanCells.length) {
      // ดึงเลขลำดับโครงการ (pure number เช่น "1", "2") จาก rowspan cell
      const seqNum = rowspanCells.map(c => c.text.trim()).find(t => /^\d+$/.test(t)) || '';
      const candidates = rowspanCells
        .map(c => c.text)
        .filter(t =>
          t &&
          t !== '#' &&
          !/^\d+$/.test(t.trim()) &&         // ไม่ใช่เลขลำดับล้วน (1, 2, 3)
          !/^\s*\d+\.\d+/.test(t) &&         // *** ไม่ใช่ "1.1 ..." กิจกรรมย่อย ***
          !/^แผนงบประมาณ$/.test(t) &&
          !/^ผลการเบิกจ่าย$/.test(t) &&
          !/^ผลการใช้จ่าย$/.test(t) &&
          t.length > 10
        );
      if (candidates.length) {
        // นำเลขลำดับมาประกบหน้าชื่อโครงการ เช่น "1. โครงการ..."
        const pName = seqNum ? seqNum + '. ' + candidates[0] : candidates[0];
        current = { name: pName, months: Array(12).fill(0), total: 0, activities: [] };
        projects.push(current);
        currentActivityName = '';
        if (!activityMapByProject[pName]) activityMapByProject[pName] = {};
      }
    }
    if (!current) return;

    // ── แถวระดับโครงการ (แผนรวม) ──────────────────────────────
    const isProjectPlan = texts.some(t => /^แผนงบประมาณ$/.test(t));
    if (isProjectPlan) {
      current.months = rowMonthVals;
      current.total = rowTotal;
      return;
    }

    // ── activity header (1.1 ... rowspan=2) — เป็น "จำนวนครั้ง/กิจกรรม" ให้จำชื่อไว้เฉยๆ ──
    const activityHeaderCell = cells.find(c =>
      /rowspan\s*=\s*"?2/i.test(c.attr) &&
      /^\s*\d+\.\d+/.test(c.text || '')
    );
    if (activityHeaderCell) {
      let name = String(activityHeaderCell.text || '').trim();
      // คง เลข "1.1", "1.2" ไว้เพื่อระบุลำดับใน DS9
      // ตัดหน่วยท้ายวงเล็บ เช่น "(แห่ง)", "(ครั้ง)" ออก
      name = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (name) currentActivityName = name;
    }

    // ── ข้ามแถว "จำนวนครั้ง/กิจกรรม" ทั้งหมดตาม requirement ───────────
    if (/จำนวนครั้ง|ครั้ง\/กิจกรรม|กิจกรรม\s*\(.*ครั้ง|แห่ง\)\s*$/.test(joined)) return;
    // ข้ามแถวผลจริงของกิจกรรม (ผู้ใช้จะไปโยงผลเบิกจ่ายจากระบบกันเงิน/GFMIS ต่อเอง)
    if (/ผลการใช้จ่าย/.test(joined)) return;

    // ── แถวจำนวนเงินของกิจกรรม: "- แผนงบประมาณ" ───────────────────
    const isActivityMoneyPlan = /-\s*แผนงบประมาณ|แผนงบประมาณ/.test(joined);
    if (!isActivityMoneyPlan) return;
    if (!currentActivityName) return;

    const map = activityMapByProject[current.name] || (activityMapByProject[current.name] = {});
    if (!map[currentActivityName]) {
      map[currentActivityName] = {
        name: currentActivityName,
        months: Array(12).fill(0),
        total: 0,
        status: ''
      };
      current.activities.push(map[currentActivityName]);
    }
    const act = map[currentActivityName];
    // ── ยึดตำแหน่งเดือนจาก label "แผนงบประมาณ" แทน adj ──────────────────
    // แถว activity money ขาด rowspan cell มากกว่าแถว project plan ทำให้ adj เพี้ยน
    // วิธีนี้: หา label ในแถว แล้วอ่าน 12 cell ถัดไปเป็น ต.ค.→ก.ย. ตรงๆ
    const aLblIx = texts.findIndex(t => /แผนงบประมาณ/.test(t));
    const aMths = (aLblIx >= 0 && texts.length >= aLblIx + 13)
      ? Array.from({length: 12}, (_, i) => _docNum(texts[aLblIx + 1 + i] || ''))
      : rowMonthVals;  // fallback วิธีเดิมถ้าหา label ไม่เจอ
    const aTotal = (aLblIx >= 0 && aLblIx + 13 < texts.length)
      ? (_docNum(texts[aLblIx + 13]) || aMths.reduce((s, v) => s + v, 0))
      : rowTotal;
    for (let i = 0; i < 12; i++) act.months[i] = _r(_n(act.months[i]) + _n(aMths[i]));
    act.total = _r(_n(act.total) + _n(aTotal));
    if (statusIdx >= 0 && statusIdx < texts.length && !act.status) act.status = String(texts[statusIdx] || '').trim();
  });

  // ตัด project ว่าง
  return {
    projects: projects
      .map(p => ({
        name: p.name,
        months: p.months,
        total: p.total,
        activities: (p.activities || []).filter(a => a.name)
      }))
      .filter(p => p.name)
  };
}
function checkBudgetRatios() {
  SpreadsheetApp.getUi().alert('Module 2', 'ยังไม่เปิดใช้งาน: ตรวจสอบสัดส่วนงบ 50/20/30', SpreadsheetApp.getUi().ButtonSet.OK);
}

function executeMainMenuAction(action, fiscalYear) {
  try {
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    switch (String(action || '')) {
      case 'initializeSystem': {
        const r = setupSheets();
        return { success: !!(r && r.success), message: (r && r.message) || 'initialize done' };
      }
      case 'checkBudgetRatios': {
        const ratio = _getCurrentRatios(fy);
        if (!ratio.success) return ratio;
        const msg = `ปีงบ ${fy} | นโยบาย ${ratio.data.policyPct}% | ยุทธศาสตร์ ${ratio.data.strategyPct}% | พื้นฐาน ${ratio.data.basicPct}%`;
        return { success:true, message: msg, data: ratio.data };
      }
      case 'autoClassifyWalletTypes': {
        return autoClassifyWalletTypes(fy, true);
      }
      case 'showActivityPlanForm':
      case 'migrateDocExportToPlan':
        return { success:true, message:'Module 2 ยังอยู่ใน Roadmap (ยังไม่เปิดใช้งาน)' };
      case 'openDailyUpdateForm':
      case 'showBudgetRoundForm':
      case 'showReservationForm':
      case 'openWalletDashboard':
        return { success:true, message:'พร้อมใช้งานจากเมนูในหน้าเว็บแล้ว' };
      default:
        return { success:false, message:'ไม่รู้จักคำสั่งเมนู' };
    }
  } catch (e) {
    return { success:false, message:e.message || String(e) };
  }
}

function classifyCurrentFiscalYear() {
  const fy = CONFIG.FISCAL_YEAR;
  const res = autoClassifyWalletTypes(fy, true);
  SpreadsheetApp.getUi().alert(
    res && res.success ? 'จัดประเภทสำเร็จ' : 'จัดประเภทไม่สำเร็จ',
    (res && res.message) || '-',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return res;
}

// ─── Setup ────────────────────────────────────
function setupSheets() {
  const ss = _ss();
  const DEFS = {
    DS0_Staging: [
      'แผนงาน','รหัสงบประมาณ','งบสุทธิ','การสำรองเงิน',
      'ใบสั่งซื้อ_สัญญา','เบิกจ่าย','เบิกแทน','คงเหลือ','วันที่นำเข้า','สถานะ',
    ],
    DS1_Transactions: [
      'TX_ID','วันที่','รหัสงบประมาณ','แผนงาน','Wallet_Type',
      'ประเภท_TX','ยอดก่อน','ยอดหลัง','ผลต่าง',
      'PO_ก่อน','PO_หลัง','คงเหลือ_GFMIS','ผู้บันทึก','หมายเหตุ','Batch_ID',
      'Activity_ID','Status',
    ],
    DS2_MasterBudget: [
      'Budget_ID','แผนงาน','รหัสงบประมาณ_20หลัก','สายบริหาร_GFMIS',
      'ประเภทงบ','Wallet_Type','Include_In_Budget','Earmarked_For',
      'Alloc_R1','Date_R1','Alloc_R2','Date_R2','Alloc_R3','Date_R3',
      'Alloc_Total',
      'Initial_Paid','Initial_PO','Initial_Date',
      'PO_Now','Paid_Now','Paid_Alt','Remaining','Updated','Status',
      'Fiscal_Year',
    ],
    DS3_Targets: [
      'เดือน','ปีงบประมาณ','เป้าหมาย_PCT','เป้าหมายสะสม_PCT',
      'งบเป้าหมาย_บาท','หมายเหตุ',
    ],
    DS4_Logs: [
      'Log_ID','Timestamp','User','Action','Module',
      'Detail','Records','Status','Duration_ms',
    ],
    DS5_AdminAlloc: [
      'Alloc_ID','ปีงบประมาณ','Admin_Line','Budget_Pool',
      'Pool_Pct','Alloc_Amount','Is_Override','Override_Amount',
      'Paid_Amount','Updated','หมายเหตุ',
    ],
    DS6_Activities: [
      'Act_ID','วันที่','กลุ่มงาน','Admin_Line',
      'กิจกรรม','งบประมาณ','เบิกจ่าย','สถานะ','ประเภทงบ',
      'โครงการ','รหัสงบประมาณ',
      'Is_Deleted','Deleted_At','Deleted_By','Delete_Reason',
    ],
    DS7_Transfers: [
      'ID','Fiscal_Year','Date','Round_No','Plan_Name',
      'Budget_Code','Amount','Created_At'
    ],
    DS8_Projects: [
      'Project_ID','Fiscal_Year','ชื่อโครงการ','Admin_Line','กลุ่มงาน',
      'Wallet_Type','งบประมาณ','หมายเหตุ','Status','Created_At',
      'Start_Month','Meeting_Date',
      'M_Oct','M_Nov','M_Dec','M_Jan','M_Feb','M_Mar',
      'M_Apr','M_May','M_Jun','M_Jul','M_Aug','M_Sep',
    ],
    DS9_Activities: [
      'Act_ID','Project_ID','Fiscal_Year','ชื่อกิจกรรม',
      'เดือน','วันประชุม','งบประมาณ',
      'สถานะ','หมายเหตุ',
      'เดือนเดิม','เหตุผลเปลี่ยน',
      'Created_At','Updated_At',
    ],
    source: [
      'Admin_Line','Budget_Pool','Wallet_Type','สถานะกิจกรรม','กลุ่มงาน',
      'โครงการ','รหัสงบประมาณ','ประเภทงบ',
    ],
  };

  Object.entries(DEFS).forEach(([name, hdr]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
    }
    const firstCell = sh.getRange(1,1).getValue();
    const hasHeader = firstCell !== '' && firstCell !== null;
    if (!hasHeader) {
      sh.getRange(1,1,1,hdr.length).setValues([hdr])
        .setBackground('#1a3a5c').setFontColor('#fff').setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });

  _seedSource(ss);
  _seedTargets(ss);
  _ensureDs6Schema(ss.getSheetByName('DS6_Activities'));
  _log('SETUP','INIT','Setup v3 สำเร็จ — DS2 multi-round + DS5 AdminAlloc + DS6 Activities + DS7 Transfers');
  return { success:true, message:'Setup v3 เรียบร้อย' };
}

function _seedSource(ss) {
  const sh = ss.getSheetByName('source');
  if (sh.getLastRow() > 1) return;
  const lines  = ['นโยบาย ผอ.','รองนิพนธ์','รองศุภลักษณ์','รองสิริรัตน์','รองชัยยะ','ผช.ปราณี','ผช.ศตวรรษ','ไปราชการ','ค่าใช้จ่ายตามสิทธิ์'];
  const pools  = ['นโยบาย','>20% นโยบาย/ชาติ','ยุทธศาสตร์','<50% ยุทธ กรมอนามัย','พื้นฐาน','<30% สนับสนุนองค์กร'];
  const wtypes = ['A — ขับเคลื่อนยุทธศาสตร์ (50%)','B — ขับเคลื่อนนโยบายเร่งด่วน (20%)','C — ค่าใช้จ่ายบริหาร/พื้นฐาน (30%)','D — ค่าใช้จ่ายตามสิทธิ์','E — งบบุคลากร','F — งบลงทุน','X — ไม่นับ/ยกเว้น'];
  const stats  = ['เบิกจ่ายแล้ว','กันเงิน','PO แล้ว','รอดำเนินการ','ยกเลิก'];
  const groups = ['ผู้อำนวยการศูนย์','แม่และเด็ก','วัยเรียน','วัยรุ่น','วัยทำงาน','สูงอายุ','สิ่งแวดล้อม','สุขาภิบาล','กลุ่มวิชาการ วิจัย','อำนวยการ'];
  const n = Math.max(lines.length, pools.length, wtypes.length, stats.length, groups.length);
  for (let i=0; i<n; i++)
    sh.appendRow([lines[i]||'', pools[i]||'', wtypes[i]||'', stats[i]||'', groups[i]||'', '', '', '']);
}

function _seedTargets(ss) {
  const sh = ss.getSheetByName('DS3_Targets');
  if (sh.getLastRow() > 1) return;
  [['ต.ค.',2569,11,11],['พ.ย.',2569,21,21],['ธ.ค.',2569,35,35],
   ['ม.ค.',2569,41,41],['ก.พ.',2569,47,47],['มี.ค.',2569,58,58],
   ['เม.ย.',2569,64,64],['พ.ค.',2569,73,73],['มิ.ย.',2569,81,81],
   ['ก.ค.',2569,91,91],['ส.ค.',2569,99,99],['ก.ย.',2569,100,100],
  ].forEach(r => ss.getSheetByName('DS3_Targets').appendRow([...r, null, '']));
}

// ─── DS7 Transfer Rounds ──────────────────────
/**
 * บันทึกรอบโอนงบใหม่ลง DS7_Transfers
 */
function processTransferRound(transferDate, fiscalYear, description) {
  const t0 = Date.now();
  try {
    const ss = _ss();
    let ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) {
      // self-heal: บางไฟล์ยังไม่เคยรัน setupSheets() ทำให้ DS7 หาย
      setupSheets();
      ds7 = ss.getSheetByName('DS7_Transfers');
    }
    if (!ds7) return { success: false, message: 'ไม่พบชีท DS7_Transfers (สร้างอัตโนมัติไม่สำเร็จ)' };

    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const tDate = transferDate || _now();
    
    const data = ds7.getDataRange().getValues().slice(1);
    let maxRound = 0;
    data.forEach(r => {
      if (r[1] && Number(r[1]) === fy) {
        const rn = Number(r[3]) || 0;
        if (rn > maxRound) maxRound = rn;
      }
    });
    
    const nextRound = maxRound + 1;
    const roundId = `TR${fy}-${String(nextRound).padStart(3, '0')}`;
    
    ds7.appendRow([
      roundId,
      fy,
      tDate,
      nextRound,
      description || `รอบโอนที่ ${nextRound}`,
      '',
      0,
      _now()
    ]);
    
    _log('DS7', 'CREATE_ROUND', `${roundId} | ${tDate}`, 1, Date.now() - t0);
    return {
      success: true,
      roundNo: nextRound,
      roundId,
      message: `สร้างรอบโอนที่ ${nextRound} สำหรับปีงบ ${fy}`
    };
  } catch (e) {
    _log('DS7', 'CREATE_ROUND_ERROR', e.message, 0, Date.now() - t0, 'ERROR');
    return { success: false, message: e.message };
  }
}

/**
 * ดึงประวัติการโอนงบทั้งหมดตามปีงบ
 */
function getTransferHistory(fiscalYear) {
  try {
    const ss = _ss();
    let ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) {
      setupSheets();
      ds7 = ss.getSheetByName('DS7_Transfers');
    }
    if (!ds7) return { success: false, message: 'ไม่พบชีท DS7_Transfers', rounds: [] };

    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const data = ds7.getDataRange().getValues().slice(1);
    
    const roundMap = {};
    data.forEach(r => {
      if (!r[0] || Number(r[1]) !== fy) return;
      const rn = Number(r[3]) || 1;
      const code = String(r[5] || '').trim();
      const amt = _n(r[6]);
      
      if (!roundMap[rn]) {
        roundMap[rn] = {
          roundNo: rn,
          roundId: r[0],
          date: _toYmd(r[2]),
          description: String(r[4] || ''),
          items: [],
          totalAmount: 0
        };
      }
      
      if (code) {
        roundMap[rn].items.push({
          planName: String(r[4] || ''),
          budgetCode: code,
          amount: amt,
          createdAt: _formatMaybeDate(r[7], 'dd/MM/yyyy HH:mm')
        });
        roundMap[rn].totalAmount += amt;
      }
    });
    
    const rounds = Object.values(roundMap)
      .sort((a, b) => b.roundNo - a.roundNo)
      .map(r => ({
        ...r,
        count: r.items.length,
        totalAmount: _r(r.totalAmount)
      }));
    
    return { success: true, rounds, count: rounds.length };
  } catch (e) {
    return { success: false, message: e.message, rounds: [] };
  }
}

/**
 * บันทึกรายการโอนงบลง DS7 (เรียกจาก confirmImport)
 */
function _recordTransferItems(roundNo, fiscalYear, items) {
  try {
    const ss = _ss();
    let ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) {
      setupSheets();
      ds7 = ss.getSheetByName('DS7_Transfers');
    }
    if (!ds7 || !items || !items.length) return;

    const fy = fiscalYear || CONFIG.FISCAL_YEAR;
    const now = _now();
    const roundId = `TR${fy}-${String(roundNo).padStart(3, '0')}`;
    
    const data = ds7.getDataRange().getValues();
    let mainRowIdx = -1;
    let roundDate = now;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === roundId && !data[i][5]) {
        mainRowIdx = i + 1;
        roundDate = data[i][2] || now;
        break;
      }
    }
    
    const appendRows = [];
    items.forEach(item => {
      appendRows.push([
        roundId,
        fy,
        roundDate,
        roundNo,
        item.planName || '',
        item.budgetCode || '',
        _n(item.amount),
        now
      ]);
    });
    
    if (appendRows.length > 0) {
      const startRow = ds7.getLastRow() + 1;
      // set text format ก่อน setValues เพื่อป้องกัน 20-digit integer ถูกแปลงเป็น sci notation
      ds7.getRange(startRow, 6, appendRows.length, 1).setNumberFormat('@STRING@');
      ds7.getRange(startRow, 1, appendRows.length, 8).setValues(appendRows);
    }

    if (mainRowIdx > 0) {
      const totalAmt = items.filter(x => _n(x.amount) > 0).reduce((s, item) => s + _n(item.amount), 0);
      ds7.getRange(mainRowIdx, 7).setValue(_r(totalAmt));
      ds7.getRange(mainRowIdx, 5).setValue(`${items.length} รายการ`);
    }
    
    _log('DS7', 'RECORD_ITEMS', `Round ${roundNo} | ${items.length} items`, items.length);
  } catch (e) {
    _log('DS7', 'RECORD_ITEMS_ERROR', e.message, 0, 0, 'ERROR');
  }
}

/**
 * หารอบโอนจากวันที่ หรือสร้างใหม่ถ้าไม่มี
 */
function _findOrCreateTransferRound(transferDate, fiscalYear) {
  try {
    const ss = _ss();
    let ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) {
      setupSheets();
      ds7 = ss.getSheetByName('DS7_Transfers');
    }
    if (!ds7) return { roundNo: 0 };

    const fy = fiscalYear || CONFIG.FISCAL_YEAR;
    const tDateStr = _toYmd(transferDate);
    const data = ds7.getDataRange().getValues().slice(1);
    
    const tMonth = new Date(tDateStr).getMonth();
    const tYear = new Date(tDateStr).getFullYear();
    
    for (let r of data) {
      if (Number(r[1]) !== fy) continue;
      const rDate = new Date(r[2]);
      if (rDate.getMonth() === tMonth && rDate.getFullYear() === tYear) {
        return { roundNo: Number(r[3]), roundId: r[0] };
      }
    }
    
    const result = processTransferRound(tDateStr, fy, `รอบโอนวันที่ ${tDateStr}`);
    return result.success ? { roundNo: result.roundNo, roundId: result.roundId } : { roundNo: 0 };
  } catch (e) {
    return { roundNo: 0 };
  }
}

/**
 * API สำหรับ UI: บันทึกวันที่รอบโอนและเตรียมพร้อมนำเข้า
 */
function setTransferRoundDate(transferDate, fiscalYear, description) {
  try {
    const result = processTransferRound(transferDate, fiscalYear, description);
    return result;
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * API สำหรับ UI: ดึงประวัติรอบโอนแสดงในตาราง
 */
function listTransferRounds(fiscalYear) {
  return getTransferHistory(fiscalYear);
}

function updateTransferRoundMeta(roundId, transferDate, description, fiscalYear) {
  try {
    const ss = _ss();
    let ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) {
      setupSheets();
      ds7 = ss.getSheetByName('DS7_Transfers');
    }
    if (!ds7) return { success:false, message:'ไม่พบชีท DS7_Transfers' };

    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const rid = String(roundId || '').trim();
    if (!rid) return { success:false, message:'ไม่พบ roundId' };

    const data = ds7.getDataRange().getValues();
    let hit = 0;
    const d = transferDate ? _toYmd(transferDate) : '';
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '') !== rid) continue;
      if (Number(data[i][1]) !== fy) continue;
      if (d) ds7.getRange(i + 1, 3).setValue(d);
      if (description != null && String(description).trim() !== '') {
        ds7.getRange(i + 1, 5).setValue(String(description).trim());
      }
      hit++;
    }
    if (!hit) return { success:false, message:'ไม่พบรอบโอนที่ต้องการแก้ไข' };
    _log('DS7', 'UPDATE_ROUND_META', `${rid} | ${hit} rows`, hit);
    return { success:true, message:`แก้ไขรอบ ${rid} สำเร็จ` };
  } catch (e) {
    return { success:false, message:e.message || String(e) };
  }
}

/** ดึงรายการทั้งหมดในรอบโอนนั้น */
function getTransferRoundItems(roundId, fiscalYear) {
  try {
    const ss = _ss();
    const ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) return { success: false, items: [], message: 'ไม่พบ DS7_Transfers' };
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const rid = String(roundId || '').trim();
    const data = ds7.getDataRange().getValues().slice(1);
    let roundDate = '', roundDesc = '', roundNo = 0;
    const items = [];
    data.forEach(r => {
      if (String(r[0] || '') !== rid || Number(r[1]) !== fy) return;
      if (!roundDate) { roundDate = _toYmd(r[2]); roundNo = Number(r[3]); }
      if (String(r[5] || '').trim()) {
        const amt = _n(r[6]);
        items.push({
          planName: String(r[4] || ''),
          budgetCode: String(r[5] || '').trim(),
          amount: amt,
          unchanged: amt === 0,
          wtype: '',  // เติมจาก DS2 ด้านล่าง
        });
      } else if (!roundDesc) {
        roundDesc = String(r[4] || '');
      }
    });

    // เติม wtype จาก DS2
    const ds2 = ss.getSheetByName('DS2_MasterBudget');
    if (ds2 && items.length) {
      const d2 = ds2.getDataRange().getValues().slice(1);
      const wtMap = {};
      d2.forEach(r => {
        if (r[C2.ID] && Number(r[C2.FISCAL_YEAR]) === fy) {
          wtMap[_normCode(r[C2.CODE])] = String(r[C2.WTYPE] || 'A').trim();
        }
      });
      items.forEach(item => { item.wtype = wtMap[item.budgetCode] || 'A'; });
    }

    return { success: true, roundId: rid, roundNo, roundDate, roundDesc, items, count: items.length };
  } catch (e) {
    return { success: false, items: [], message: e.message };
  }
}

/** เพิ่มรายการใหม่เข้าในรอบโอน + sync DS2 */
function addTransferRoundItem(roundId, planName, budgetCode, amount, fiscalYear) {
  try {
    const ss = _ss();
    let ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) return { success: false, message: 'ไม่พบ DS7_Transfers' };
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const rid = String(roundId || '').trim();
    const code = String(budgetCode || '').replace(/\s/g, '').trim();
    const amt = _n(amount);
    if (!code) return { success: false, message: 'กรุณาระบุรหัสงบประมาณ' };
    if (amt <= 0) return { success: false, message: 'จำนวนเงินต้องมากกว่า 0' };
    const data = ds7.getDataRange().getValues().slice(1);
    let roundDate = _now(), roundNo = 0;
    for (const r of data) {
      if (String(r[0] || '') === rid && Number(r[1]) === fy) {
        roundDate = r[2] || _now();
        roundNo = Number(r[3]) || 0;
        break;
      }
    }
    if (!roundNo) return { success: false, message: 'ไม่พบรอบโอนนี้ใน DS7' };

    // ── upsert DS2: ถ้ารหัสนี้ยังไม่มีในปี fy ให้สร้างแถวใหม่ ──
    const ds2 = ss.getSheetByName('DS2_MasterBudget');
    if (ds2) {
      const d2 = ds2.getDataRange().getValues();
      const exists = d2.slice(1).some(r => r[C2.ID] && _normCode(r[C2.CODE]) === code && Number(r[C2.FISCAL_YEAR]) === fy);
      if (!exists) {
        // หา row ปีก่อนเพื่อ copy ข้อมูล plan/wtype/btype
        const prev = d2.slice(1).find(r => r[C2.ID] && _normCode(r[C2.CODE]) === code) || [];
        const newId = 'B' + Utilities.getUuid().substring(0, 8).toUpperCase();
        const newDs2Row = Array(25).fill('');
        newDs2Row[C2.ID]          = newId;
        newDs2Row[C2.PLAN]        = prev[C2.PLAN] || String(planName || '').trim();
        newDs2Row[C2.CODE]        = code;
        newDs2Row[C2.ADMIN_GFMIS] = prev[C2.ADMIN_GFMIS] || 'ไม่ระบุ';
        newDs2Row[C2.BTYPE]       = prev[C2.BTYPE] || 'ไม่ระบุ';
        newDs2Row[C2.WTYPE]       = prev[C2.WTYPE] || 'A';
        newDs2Row[C2.INCLUDE]     = prev[C2.INCLUDE] !== undefined ? prev[C2.INCLUDE] : true;
        newDs2Row[C2.ALLOC_TOTAL] = 0;
        newDs2Row[C2.PO]          = 0;
        newDs2Row[C2.PAID]        = 0;
        newDs2Row[C2.ALT]         = 0;
        newDs2Row[C2.REMAIN]      = 0;
        newDs2Row[C2.UPDATED]     = _now();
        newDs2Row[C2.STATUS]      = 'Active';
        newDs2Row[C2.FISCAL_YEAR] = fy;
        const ds2NewRow = ds2.getLastRow() + 1;
        ds2.getRange(ds2NewRow, C2.CODE + 1).setNumberFormat('@STRING@');
        ds2.getRange(ds2NewRow, 1, 1, newDs2Row.length).setValues([newDs2Row]);
        _log('DS2', 'AUTO_CREATE', `${code} fy=${fy}`, 1);
      }
    }

    const newRow = ds7.getLastRow() + 1;
    // set text format ก่อน setValues เพื่อป้องกัน Sheets แปลง 20-digit integer เป็น sci notation
    ds7.getRange(newRow, 6).setNumberFormat('@STRING@');
    ds7.getRange(newRow, 1, 1, 8).setValues([[rid, fy, roundDate, roundNo, String(planName || '').trim(), code, amt, _now()]]);
    _syncMasterAllocFromDS7(fy, [code]);
    _recalcAdminAlloc(fy);
    _log('DS7', 'ADD_ITEM', `${rid} | ${code} | ${amt}`, 1);
    return { success: true, message: `เพิ่ม ${code} จำนวน ${fmt_(amt)} บาท ลงรอบ ${roundNo} สำเร็จ` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function fmt_(n) { return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/** ดึงรายการรหัสงบประมาณทั้งหมดจาก DS2 สำหรับ autocomplete
 *  ถ้าไม่มีข้อมูลปีที่ระบุ จะ fallback ดึงทุกปี (deduplicated by budgetCode)
 */
function getBudgetCodeList(fiscalYear) {
  try {
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const ds2 = _ss().getSheetByName('DS2_MasterBudget');
    if (!ds2) return { success: false, items: [] };
    const data = ds2.getDataRange().getValues().slice(1);

    const rows = data.filter(r => r[C2.ID] && Number(r[C2.FISCAL_YEAR]) === fy);
    if (!rows.length) {
      return { success: true, items: [], fyUsed: fy, empty: true,
               message: `ไม่พบข้อมูลปีงบ ${fy} ใน DS2 — กรุณาเพิ่มรหัสงบสำหรับปีนี้ก่อน` };
    }

    const seen = new Set();
    const items = [];
    rows.forEach(r => {
      const code = _normCode(r[C2.CODE]);
      if (!code || seen.has(code)) return;
      seen.add(code);
      items.push({
        planName: String(r[C2.PLAN] || '').trim(),
        budgetCode: code,
        allocated: _n(r[C2.ALLOC_TOTAL]),
        wtype: String(r[C2.WTYPE] || '').trim()
      });
    });
    items.sort((a, b) => a.planName.localeCompare(b.planName, 'th'));
    return { success: true, items, fyUsed: fy };
  } catch (e) {
    return { success: false, items: [], message: e.message };
  }
}

/** อัปเดต Wallet_Type ของรหัสงบใน DS2 (A/B/C/D/X) */
function updateBudgetWalletType(budgetCode, walletType, fiscalYear) {
  try {
    const VALID = ['A', 'B', 'C', 'D', 'E', 'F', 'X'];
    const wt  = String(walletType || '').toUpperCase().trim();
    if (!VALID.includes(wt)) return { success: false, message: `Wallet Type ไม่ถูกต้อง (${wt})` };
    const code = String(budgetCode || '').replace(/\s/g, '').trim();
    if (!code) return { success: false, message: 'ไม่ระบุรหัสงบประมาณ' };
    const fy  = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const ds2 = _ss().getSheetByName('DS2_MasterBudget');
    if (!ds2) return { success: false, message: 'ไม่พบ DS2_MasterBudget' };
    const data = ds2.getDataRange().getValues();
    let updated = 0;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[C2.ID]) continue;
      if (_normCode(r[C2.CODE]) === code && Number(r[C2.FISCAL_YEAR]) === fy) {
        ds2.getRange(i + 1, C2.WTYPE + 1).setValue(wt);
        ds2.getRange(i + 1, C2.UPDATED + 1).setValue(_now());
        updated++;
      }
    }
    if (!updated) return { success: false, message: `ไม่พบรหัสงบ ${code} ในปี ${fy}` };
    _recalcAdminAlloc(fy);
    _log('DS2', 'UPDATE_WTYPE', `${code} → ${wt} | fy=${fy}`, updated);
    return { success: true, message: `อัปเดต Wallet_Type เป็น ${wt} สำเร็จ` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/** ลบรายการออกจากรอบโอน + sync DS2 */
function deleteTransferRoundItem(roundId, budgetCode, fiscalYear) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ss = _ss();
    const ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) return { success: false, message: 'ไม่พบ DS7_Transfers' };
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const rid = String(roundId || '').trim();
    const code = String(budgetCode || '').replace(/\s/g, '').trim();
    const data = ds7.getDataRange().getValues();
    const deleteRows = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '') === rid && Number(data[i][1]) === fy
          && String(data[i][5] || '').replace(/\s/g, '').trim() === code) {
        deleteRows.push(i + 1);
      }
    }
    if (!deleteRows.length) return { success: false, message: 'ไม่พบรายการนี้' };
    for (let i = deleteRows.length - 1; i >= 0; i--) ds7.deleteRow(deleteRows[i]);
    _syncMasterAllocFromDS7(fy, [code]);
    _recalcAdminAlloc(fy);
    _log('DS7', 'DELETE_ITEM', `${rid} | ${code}`, deleteRows.length);
    return { success: true, message: `ลบ ${code} ออกจากรอบสำเร็จ` };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ซ่อมแซม DS7: แปลง budget code ที่เป็น scientific notation กลับเป็นตัวเลขเต็ม
 * เรียกครั้งเดียวจาก GAS Editor → Run → repairDS7BudgetCodes
 */
/**
 * ล้าง DS7 ทั้งหมดของปีงบที่ระบุ และ reset allocation ใน DS2 → 0
 * เรียกจาก GAS Editor → Run → hardResetFY
 * หลังจากนี้ให้ import ทุกรอบใหม่ผ่านหน้าเว็บ
 */
/**
 * Copy DS2 rows จากปีก่อน → ปีงบปัจจุบัน (CONFIG.FISCAL_YEAR)
 * - สร้าง Budget_ID ใหม่, reset allocation/PO/Paid = 0
 * - fix รหัสงบ scientific notation → integer string
 * - ข้ามรายการที่มีอยู่แล้วในปีปัจจุบัน (ไม่ duplicate)
 * เรียกจาก GAS Editor → Run → copyDS2ToCurrentFY
 */
function copyDS2ToCurrentFY() {
  const ss = _ss();
  const ds2 = ss.getSheetByName('DS2_MasterBudget');
  if (!ds2) return 'ไม่พบ DS2_MasterBudget';

  const toFY = CONFIG.FISCAL_YEAR;
  const data = ds2.getDataRange().getValues();
  const headers = data[0];

  // หา fiscal_year column index จาก header (fallback C2.FISCAL_YEAR)
  const fyCol = C2.FISCAL_YEAR;

  // รายการที่มีอยู่แล้วในปีปัจจุบัน (by budget code)
  const existingCodes = new Set();
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][fyCol]) === toFY && data[i][C2.ID]) {
      existingCodes.add(_normCode(data[i][C2.CODE]));
    }
  }

  // หาปีล่าสุดที่มีข้อมูล (น้อยกว่า toFY)
  const years = [...new Set(data.slice(1).map(r => Number(r[fyCol])).filter(y => y > 0 && y < toFY))];
  if (!years.length) return `ไม่พบข้อมูลปีก่อน ${toFY} ใน DS2`;
  const fromFY = Math.max(...years);

  const sourceRows = data.slice(1).filter(r => r[C2.ID] && Number(r[fyCol]) === fromFY);
  if (!sourceRows.length) return `ไม่พบข้อมูลปี ${fromFY} ใน DS2`;

  const now = _now();
  const newRows = [];
  sourceRows.forEach(r => {
    const code = _normCode(r[C2.CODE]);
    if (!code || existingCodes.has(code)) return; // ข้ามถ้ามีอยู่แล้ว
    const newId = 'B' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const newRow = [...r]; // copy ทุก column
    newRow[C2.ID]          = newId;
    newRow[C2.CODE]        = code;          // fix sci notation
    newRow[C2.FISCAL_YEAR] = toFY;
    newRow[C2.STATUS]      = 'Active';
    // reset allocation
    newRow[C2.ALLOC_R1]    = 0;
    newRow[C2.DATE_R1]     = '';
    newRow[C2.ALLOC_R2]    = 0;
    newRow[C2.DATE_R2]     = '';
    newRow[C2.ALLOC_R3]    = 0;
    newRow[C2.DATE_R3]     = '';
    newRow[C2.ALLOC_TOTAL] = 0;
    // reset payments
    newRow[C2.INIT_PAID]   = 0;
    newRow[C2.INIT_PO]     = 0;
    newRow[C2.INIT_DATE]   = '';
    newRow[C2.PO]          = 0;
    newRow[C2.PAID]        = 0;
    newRow[C2.ALT]         = 0;
    newRow[C2.REMAIN]      = 0;
    newRow[C2.UPDATED]     = now;
    newRows.push(newRow);
  });

  if (!newRows.length) return `ไม่มีรายการใหม่ที่ต้องเพิ่ม (ปี ${toFY} มีครบแล้ว)`;

  const startRow = ds2.getLastRow() + 1;
  // set text format สำหรับ budget code column ก่อนเขียน
  ds2.getRange(startRow, C2.CODE + 1, newRows.length, 1).setNumberFormat('@STRING@');
  ds2.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);

  _log('DS2', 'COPY_FY', `${fromFY}→${toFY}: ${newRows.length} rows`, newRows.length);
  return `✅ Copy ${newRows.length} รายการ จากปี ${fromFY} → ${toFY} สำเร็จ`;
}

function hardResetFY() {
  const fy = CONFIG.FISCAL_YEAR; // แก้ตรงนี้ถ้าต้องการปีอื่น
  const ss = _ss();
  const ds7 = ss.getSheetByName('DS7_Transfers');
  const ds2 = ss.getSheetByName('DS2_MasterBudget');
  if (!ds7 || !ds2) return 'ไม่พบ sheet';

  // ลบ DS7 rows ของปีนั้น (เก็บ header)
  const d7 = ds7.getDataRange().getValues();
  const keepRows = [d7[0]]; // header
  for (let i = 1; i < d7.length; i++) {
    if (Number(d7[i][1]) !== fy) keepRows.push(d7[i]);
  }
  ds7.clearContents();
  if (keepRows.length) ds7.getRange(1, 1, keepRows.length, keepRows[0].length).setValues(keepRows);

  // Reset allocation columns ใน DS2 สำหรับปีนี้
  const d2 = ds2.getDataRange().getValues();
  const now = _now();
  for (let i = 1; i < d2.length; i++) {
    if (Number(d2[i][C2.FISCAL_YEAR]) !== fy) continue;
    if (!d2[i][C2.ID]) continue;
    const r = i + 1;
    ds2.getRange(r, C2.ALLOC_R1 + 1).setValue(0);
    ds2.getRange(r, C2.DATE_R1 + 1).setValue('');
    ds2.getRange(r, C2.ALLOC_R2 + 1).setValue(0);
    ds2.getRange(r, C2.DATE_R2 + 1).setValue('');
    ds2.getRange(r, C2.ALLOC_R3 + 1).setValue(0);
    ds2.getRange(r, C2.DATE_R3 + 1).setValue('');
    ds2.getRange(r, C2.ALLOC_TOTAL + 1).setValue(0);
    ds2.getRange(r, C2.UPDATED + 1).setValue(now);
    // fix code column เป็น text format ด้วย
    ds2.getRange(r, C2.CODE + 1).setNumberFormat('@STRING@');
  }

  _log('RESET', 'HARD_RESET_FY', `FY${fy}: DS7 cleared, DS2 alloc zeroed`, 0);
  return `✅ ล้าง DS7 และ reset DS2 ปีงบ ${fy} สำเร็จ — กรุณา import รอบใหม่ทั้งหมด`;
}

function repairDS7BudgetCodes() {
  const ds7 = _ss().getSheetByName('DS7_Transfers');
  if (!ds7) return 'ไม่พบ DS7_Transfers';
  const data = ds7.getDataRange().getValues();
  let fixed = 0;
  for (let i = 1; i < data.length; i++) {
    const raw = String(data[i][5] || '').trim();
    if (!raw) continue;
    if (/^\d+\.?\d*[Ee][+\-]?\d+$/.test(raw)) {
      try {
        const corrected = String(BigInt(Math.round(parseFloat(raw))));
        const cell = ds7.getRange(i + 1, 6);
        cell.setNumberFormat('@STRING@');
        cell.setValue(corrected);
        fixed++;
      } catch(_) {}
    } else {
      // format text anyway to prevent future conversion
      ds7.getRange(i + 1, 6).setNumberFormat('@STRING@');
    }
  }
  return `ซ่อมแซม ${fixed} rows เสร็จ`;
}

function deleteTransferRound(roundId, fiscalYear) {
  const t0 = Date.now();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = _ss();
    let ds7 = ss.getSheetByName('DS7_Transfers');
    if (!ds7) {
      setupSheets();
      ds7 = ss.getSheetByName('DS7_Transfers');
    }
    if (!ds7) return { success:false, message:'ไม่พบชีท DS7_Transfers' };

    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const rid = String(roundId || '').trim();
    if (!rid) return { success:false, message:'ไม่พบ roundId' };

    const data = ds7.getDataRange().getValues();
    const touchedCodes = new Set();
    const deleteRows = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '') !== rid) continue;
      if (Number(data[i][1]) !== fy) continue;
      const code = String(data[i][5] || '').trim();
      if (code) touchedCodes.add(code);
      deleteRows.push(i + 1);
    }
    if (!deleteRows.length) return { success:false, message:'ไม่พบรอบโอนที่ต้องการลบ' };

    for (let i = deleteRows.length - 1; i >= 0; i--) ds7.deleteRow(deleteRows[i]);
    _syncMasterAllocFromDS7(fy, Array.from(touchedCodes));
    _recalcAdminAlloc(fy);

    _log('DS7', 'DELETE_ROUND', `${rid} | deleted ${deleteRows.length}`, deleteRows.length, Date.now() - t0);
    return { success:true, deleted:deleteRows.length, message:`ลบรอบ ${rid} แล้ว (${deleteRows.length} แถว)` };
  } catch (e) {
    return { success:false, message:e.message || String(e) };
  } finally {
    lock.releaseLock();
  }
}

function _syncMasterAllocFromDS7(fiscalYear, touchedCodes) {
  const fy = Number(fiscalYear) || CONFIG.FISCAL_YEAR;
  const ss = _ss();
  const ds7 = ss.getSheetByName('DS7_Transfers');
  const ds2 = ss.getSheetByName('DS2_MasterBudget');
  if (!ds7 || !ds2) return { success:false };

  // กรองเฉพาะ item rows (มี budget code) ที่มี amount > 0 เพื่อคำนวณ DS2
  // rows ที่ amount=0 (ยอดคงเดิม — audit trail เท่านั้น) ไม่นำมาคำนวณ
  const ds7Rows = ds7.getDataRange().getValues().slice(1).filter(r =>
    r[0] && Number(r[1]) === fy && String(r[5] || '').trim() && _n(r[6]) > 0
  );
  const byCode = {};
  ds7Rows.forEach(r => {
    const code = _normCode(r[5]);
    const rn = Number(r[3]) || 0;
    const amount = _n(r[6]);
    const date = _toYmd(r[2]);
    if (!byCode[code]) byCode[code] = [];
    const ix = byCode[code].findIndex(x => x.roundNo === rn);
    if (ix >= 0) byCode[code][ix].amount = _r(byCode[code][ix].amount + amount);
    else byCode[code].push({ roundNo: rn, amount, date });
  });
  Object.keys(byCode).forEach(code => byCode[code].sort((a, b) => a.roundNo - b.roundNo));

  const targetCodes = new Set((touchedCodes || []).map(x => _normCode(x)).filter(Boolean));
  Object.keys(byCode).forEach(code => targetCodes.add(code));

  const data = ds2.getDataRange().getValues();
  const now = _now();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[C2.ID]) continue;
    if ((Number(row[C2.FISCAL_YEAR]) || CONFIG.FISCAL_YEAR) !== fy) continue;
    // normalize DS2 code — รองรับทั้ง text "21009322044002000000" และ sci "2.10093E+19"
    const code = _normCode(row[C2.CODE]);
    if (!targetCodes.has(code)) continue;

    const arr = byCode[code] || [];
    const r1 = arr[0] ? _n(arr[0].amount) : 0;
    const d1 = arr[0] ? arr[0].date : '';
    const r2 = arr[1] ? _n(arr[1].amount) : 0;
    const d2 = arr[1] ? arr[1].date : '';
    const r3 = arr.length > 2 ? _r(arr.slice(2).reduce((s, x) => s + _n(x.amount), 0)) : 0;
    const d3 = arr.length > 2 ? (arr[arr.length - 1].date || '') : '';
    const total = _r(r1 + r2 + r3);

    ds2.getRange(i + 1, C2.ALLOC_R1 + 1).setValue(r1);
    ds2.getRange(i + 1, C2.DATE_R1 + 1).setValue(d1);
    ds2.getRange(i + 1, C2.ALLOC_R2 + 1).setValue(r2);
    ds2.getRange(i + 1, C2.DATE_R2 + 1).setValue(d2);
    ds2.getRange(i + 1, C2.ALLOC_R3 + 1).setValue(r3);
    ds2.getRange(i + 1, C2.DATE_R3 + 1).setValue(d3);
    ds2.getRange(i + 1, C2.ALLOC_TOTAL + 1).setValue(total);
    ds2.getRange(i + 1, C2.REMAIN + 1).setValue(Math.max(0, _r(total - _n(row[C2.PO]) - _n(row[C2.PAID]))));
    ds2.getRange(i + 1, C2.UPDATED + 1).setValue(now);
  }
  return { success:true };
}

// ─── DS0 Staging ──────────────────────────────
function stagingImport(rows) {
  const t0 = Date.now();
  try {
    const sh = _ss().getSheetByName('DS0_Staging');
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow()-1);
    const now = _now(), valid = [];
    rows.forEach(r => {
      if (!r || r.length < 2) return;

      // รองรับ 2 รูปแบบหลัก:
      // A) ตามหน้าเว็บ: [แผนงาน, รหัสงบ, งบสุทธิ, สำรอง, PO, เบิก, เบิกแทน, คงเหลือ]
      // B) จากรายงาน NFMA46 ที่ copy ช่วง D–N: [รหัสงบ, แผนงาน, ..., ..., งบสุทธิ, ..., สำรอง, PO, เบิก, เบิกแทน, คงเหลือ]
      const isBudgetCode = (v) => {
        const s = String(v || '').replace(/\s/g,'').trim();
        return !!s && /^\d{10,}$/.test(s);
      };

      let plan = '';
      let code = '';
      let net = 0, reserve = 0, po = 0, paid = 0, alt = 0, remain = 0;

      // รูปแบบ B (NFMA46 D–N) มักเริ่มด้วยรหัสงบในคอลัมน์แรก และมีงบสุทธิที่ index 4
      if (isBudgetCode(r[0]) && r.length >= 11) {
        code = String(r[0] || '').replace(/\s/g,'').trim();
        plan = String(r[1] || '').trim();
        net = _n(r[4]);
        reserve = _n(r[6]);
        po = _n(r[7]);
        paid = _n(r[8]);
        alt = _n(r[9]);
        remain = _n(r[10]);
      } else {
        // รูปแบบ A (ตามที่ UI แนะนำ)
        plan = String(r[0] || '').trim();
        code = String(r[1] || '').replace(/\s/g,'').trim();
        net = _n(r[2]);
        reserve = _n(r[3]);
        po = _n(r[4]);
        paid = _n(r[5]);
        alt = _n(r[6]);
        remain = _n(r[7]);
      }

      // ต้องเป็นรหัสตัวเลข 10+ หลักเท่านั้น (กรองแถว subtotal / header ออก)
      if (!code || code === 'รหัสงบประมาณ' || !isBudgetCode(code)) return;
      valid.push([plan, code, net, reserve, po, paid, alt, remain, now, 'รอยืนยัน']);
    });
    if (!valid.length) return { success:false, message:'ไม่พบข้อมูล — ตรวจสอบ format การ Paste (ต้องมีรหัสงบ 10+ หลัก)' };
    // *** สำคัญ: set format คอลัมน์ budget code เป็น text ก่อนเขียน
    // เพื่อป้องกัน Sheets แปลง 20-digit integer เป็น scientific notation
    sh.getRange(2, 2, valid.length, 1).setNumberFormat('@STRING@');
    sh.getRange(2,1,valid.length,valid[0].length).setValues(valid);
    _log('DS0','STAGE',`${valid.length} แถว`,valid.length,Date.now()-t0);
    return { success:true, count:valid.length, preview:valid.slice(0,5),
             message:`พบ ${valid.length} รายการ` };
  } catch(e) { return { success:false, message:e.message }; }
}

/**
 * ยืนยัน import — รองรับ multi-round + DS7 logging
 */
function confirmImport(transferDate, fiscalYear) {
  const t0 = Date.now(), lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss      = _ss();
    const staging = ss.getSheetByName('DS0_Staging');
    const master  = ss.getSheetByName('DS2_MasterBudget');
    const txSheet = ss.getSheetByName('DS1_Transactions');
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;

    const sd = staging.getDataRange().getValues().slice(1)
                 .filter(r => r[9] === 'รอยืนยัน');
    if (!sd.length) return { success:false, message:'ไม่มีข้อมูลใน Staging' };

    const md     = master.getDataRange().getValues();
    const codeMap = {};
    md.forEach((r,i) => {
      if (i>0 && r[C2.CODE]) {
        // normalize: รองรับทั้ง "21009322044002000000" และ "2.10093E+19" ใน DS2
        const code = _normCode(r[C2.CODE]);
        const fy = Number(r[C2.FISCAL_YEAR]);
        const key = `${code}_${fy}`;
        codeMap[key] = i+1;
      }
    });

    const tDate   = transferDate || _now();
    const now     = _now();
    const batch   = Utilities.getUuid().substring(0,8).toUpperCase();
    const user    = Session.getActiveUser().getEmail() || 'system';
    let upd=0, added=0;

    sd.forEach(sr => {
      // normalize staging code เหมือนกัน เพื่อให้ match กับ codeMap
      const code = _normCode(sr[1]), plan = sr[0];
      const poN=sr[4], paidN=sr[5], alt=sr[6], rem=sr[7];
      const allocNew = _n(sr[2]); // ยอด "งบสุทธิ" ที่ถูก paste มา (มักเป็นยอดสะสม ณ วันนั้น จากรายงาน NFMA46)
      const key = `${code}_${fy}`;
      const ri = codeMap[key];

      if (ri) {
        const row = md[ri-1];
        const r1  = _n(row[C2.ALLOC_R1]);
        const r2  = _n(row[C2.ALLOC_R2]);
        const oldPaid = _n(row[C2.PAID]), oldPO = _n(row[C2.PO]);
        const oldTotal = _n(row[C2.ALLOC_TOTAL]);

        // ── สำคัญ: ป้องกันการบวกซ้ำกรณี import ยอด "final/สะสม"
        // ถ้ามีงบเดิมอยู่แล้ว และยอดใหม่เป็นยอดสะสม ให้คำนวณ "ยอดเพิ่มรอบนี้" = new - oldTotal
        // ถ้า new <= oldTotal ให้ถือว่าไม่มีเงินโอนเพิ่ม (ไม่ลงรอบใหม่) แต่ยังอัปเดต PO/เบิก/คงเหลือได้
        let allocDelta = allocNew;
        if (oldTotal > 0 && allocNew > 0) {
          allocDelta = _r(allocNew - oldTotal);
          if (allocDelta < 0) allocDelta = 0;
        }

        let colAlloc, colDate;
        if (allocDelta <= 0) {
          colAlloc = null;
          colDate = null;
        } else if (r1 === 0) {
          colAlloc = C2.ALLOC_R1+1; colDate = C2.DATE_R1+1;
        } else if (r2 === 0) {
          colAlloc = C2.ALLOC_R2+1; colDate = C2.DATE_R2+1;
        } else {
          // เกิน 3 รอบ: เก็บส่วนเพิ่มสะสมที่ช่อง R3 เพื่อไม่ให้ยอดหาย
          colAlloc = C2.ALLOC_R3+1; colDate = C2.DATE_R3+1;
        }

        if (colAlloc && colDate) {
          const toSet = (colAlloc === C2.ALLOC_R3 + 1 && r1 > 0 && r2 > 0)
            ? _r(_n(row[C2.ALLOC_R3]) + allocDelta)
            : allocDelta;
          master.getRange(ri, colAlloc).setValue(toSet);
          master.getRange(ri, colDate).setValue(tDate);
        }

        const r1val = (colAlloc === C2.ALLOC_R1+1) ? allocDelta : _n(row[C2.ALLOC_R1]);
        const r2val = (colAlloc === C2.ALLOC_R2+1) ? allocDelta : _n(row[C2.ALLOC_R2]);
        const r3val = (colAlloc === C2.ALLOC_R3+1)
          ? ((r1 > 0 && r2 > 0) ? _r(_n(row[C2.ALLOC_R3]) + allocDelta) : allocDelta)
          : _n(row[C2.ALLOC_R3]);
        const newTotal = r1val + r2val + r3val;
        master.getRange(ri, C2.ALLOC_TOTAL+1).setValue(newTotal);

        master.getRange(ri, C2.PO+1).setValue(poN);
        master.getRange(ri, C2.PAID+1).setValue(paidN);
        master.getRange(ri, C2.INIT_PAID+1).setValue(0);
        master.getRange(ri, C2.ALT+1).setValue(alt);
        master.getRange(ri, C2.REMAIN+1).setValue(rem);
        master.getRange(ri, C2.UPDATED+1).setValue(now);
        master.getRange(ri, C2.FISCAL_YEAR+1).setValue(fy);

        txSheet.appendRow([Utilities.getUuid().substring(0,12), now, code, plan,
          row[C2.WTYPE], 'GFMIS_REF',
          oldPaid, paidN, paidN-oldPaid,
          oldPO, poN, rem, user, `GFMIS ref col${colAlloc} alloc=${allocNew}`, batch]);
        upd++;
      } else {
        const nid = 'B'+Utilities.getUuid().substring(0,6).toUpperCase();
        master.appendRow([
          nid, plan, code, '', 'งบดำเนินงาน',
          'A','TRUE','',
          allocNew, tDate, 0,'', 0,'', allocNew,
          0, 0, '',
          poN, paidN, alt, rem, now, 'ใหม่-รอ classify',
          fy,
        ]);
        txSheet.appendRow([Utilities.getUuid().substring(0,12), now, code, plan,
          'A','NEW_GFMIS_REF', 0, paidN, paidN, 0, poN, rem, user, 'รหัสใหม่ (GFMIS ref)', batch]);
        added++;
      }
    });

    staging.getRange(2,10,sd.length,1)
      .setValue('นำเข้าแล้ว '+Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'dd/MM/yy HH:mm'));

    // ── บันทึกรายการโอนลง DS7_Transfers ──
    // บันทึกทุกรายการที่ผ่าน staging เพื่อ audit trail ครบถ้วน
    // รายการที่ delta=0 (ยอดคงเดิมจากรอบก่อน) บันทึก amount=0 ไว้ใน DS7 เพื่อดูย้อนหลัง
    // _syncMasterAllocFromDS7 จะกรอง amount=0 ออกไม่นำมาคำนวณ DS2
    if (transferDate && sd.length > 0) {
      const roundInfo = _findOrCreateTransferRound(tDate, fy);
      if (roundInfo.roundNo) {
        const transferItems = sd.map(sr => {
          const budgetCode = String(sr[1]).trim();
          const planName = String(sr[0]).trim();
          const allocNew = _n(sr[2]);
          const ri = codeMap[`${budgetCode}_${fy}`];
          let delta = allocNew;
          if (ri) {
            const row = md[ri - 1];
            const oldTotal = _n(row[C2.ALLOC_TOTAL]);
            if (oldTotal > 0 && allocNew > 0) {
              delta = _r(allocNew - oldTotal);
              if (delta < 0) delta = 0;
            }
          }
          return { budgetCode, planName, amount: delta };
        });
        _recordTransferItems(roundInfo.roundNo, fy, transferItems);
      }
    }

    _recalcAdminAlloc(fy);

    // นับรายการที่ delta=0 (ยอดคงเดิม ไม่มีเงินโอนเพิ่ม)
    const unchangedCount = sd.filter(sr => {
      const allocNew = _n(sr[2]);
      const ri = codeMap[`${String(sr[1]).trim()}_${fy}`];
      if (!ri || allocNew <= 0) return false;
      const oldTotal = _n(md[ri-1][C2.ALLOC_TOTAL]);
      return oldTotal > 0 && _r(allocNew - oldTotal) <= 0;
    }).length;

    _log('IMPORT','CONFIRM',`อัปเดต ${upd} | เพิ่ม ${added} | คงเดิม ${unchangedCount} | ${batch}`,upd+added,Date.now()-t0);
    const unchangedNote = unchangedCount > 0 ? `<br><small style="color:#d97706">· ${unchangedCount} รายการยอดคงเดิม (ไม่มีเงินโอนเพิ่ม บันทึก audit trail ใน DS7)</small>` : '';
    return { success:true, updated:upd, added, unchanged:unchangedCount, batchId:batch,
             message:`✅ อัปเดต ${upd} | เพิ่มใหม่ ${added} | DS5 recalculated${unchangedNote}` };
  } catch(e) {
    _log('IMPORT','CONFIRM','ERROR: '+e.message,0,Date.now()-t0,'ERROR');
    return { success:false, message:e.message };
  } finally { lock.releaseLock(); }
}

// ─── DS5 AdminAlloc ────────────────────────────
function _recalcAdminAlloc(fiscalYear) {
  const ss     = _ss();
  const master = ss.getSheetByName('DS2_MasterBudget');
  const ds5    = ss.getSheetByName('DS5_AdminAlloc');
  const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;

  const mdAll = master.getDataRange().getValues().slice(1).filter(r=>r[C2.ID]);
  const _rowFY = (r) => {
    if (r[C2.FISCAL_YEAR] && Number(r[C2.FISCAL_YEAR]) > 2560) return Number(r[C2.FISCAL_YEAR]);
    const idMatch = String(r[C2.ID]).match(/B(25\d{2})/);
    if (idMatch) return Number(idMatch[1]);
    return CONFIG.FISCAL_YEAR;
  };

  const md = mdAll.filter(r => _rowFY(r) === fy);
  const opTotal = md.filter(r=>r[C2.WTYPE]==='A')
                     .reduce((s,r)=>s+_n(r[C2.ALLOC_TOTAL]),0);

  if (opTotal === 0) return;

  const d5All  = ds5.getDataRange().getValues();
  // แถวสำหรับ FY นี้ (index ใน array, sheetRow = idx+1)
  const fyRows = d5All
    .map((r,i) => ({ r, sheetRow: i+1 }))
    .filter(({ r, sheetRow }) => sheetRow > 1 && r[C5.ID] && Number(r[C5.YEAR]) === fy);

  const now = _now();

  if (fyRows.length === 0) {
    // ยังไม่มีข้อมูลสำหรับปีนี้ → สร้าง default 6 สาย
    const defaultLines = [
      { line:'นโยบาย ผอ.',        pool:'นโยบาย',     linePct:1.00 },
      { line:'รองนิพนธ์',         pool:'ยุทธศาสตร์',  linePct:0.50 },
      { line:'รองศุภลักษณ์',      pool:'ยุทธศาสตร์',  linePct:0.20 },
      { line:'รองสิริรัตน์',      pool:'ยุทธศาสตร์',  linePct:0.05 },
      { line:'รองชัยยะ/ผช.',      pool:'ยุทธศาสตร์',  linePct:0.25 },
      { line:'ค่าใช้จ่ายพื้นฐาน', pool:'พื้นฐาน',     linePct:1.00 },
    ];
    defaultLines.forEach(al => {
      const pct     = (CONFIG.POOL_RATIOS[al.pool] || 0) * al.linePct;
      const calcAmt = _r(opTotal * pct);
      const aid     = 'A'+Utilities.getUuid().substring(0,6).toUpperCase();
      ds5.appendRow([aid, fy, al.line, al.pool, pct, calcAmt, 'FALSE', 0, 0, now, 'คำนวณอัตโนมัติ']);
    });
  } else {
    // มีข้อมูลแล้ว → คำนวณใหม่จาก PCT ที่เก็บไว้ (PCT = poolRatio × linePct)
    fyRows.forEach(({ r, sheetRow }) => {
      const isOverride = String(r[C5.OVERRIDE]).toUpperCase() === 'TRUE';
      if (isOverride) return;
      const pct     = _n(r[C5.PCT]);
      const calcAmt = _r(opTotal * pct);
      ds5.getRange(sheetRow, C5.ALLOC+1).setValue(calcAmt);
      ds5.getRange(sheetRow, C5.UPDATED+1).setValue(now);
    });
  }
}

// เพิ่ม / แก้ไข สายบริหาร (CRUD)
function saveAdminLine(payload) {
  try {
    const fy       = payload.fy ? Number(payload.fy) : CONFIG.FISCAL_YEAR;
    const allocId  = payload.allocId || null;
    const lineName = String(payload.lineName || '').trim();
    const pool     = String(payload.pool || '').trim();
    const linePct  = Number(payload.linePct) / 100;   // user ส่งมาเป็น % → convert เป็น 0-1
    const note     = String(payload.note || '').trim();

    if (!lineName) return { success:false, message:'กรุณากรอกชื่อสายบริหาร' };
    if (!pool)     return { success:false, message:'กรุณาเลือก Pool' };
    if (isNaN(linePct) || linePct < 0 || linePct > 1)
      return { success:false, message:'สัดส่วน % ต้องอยู่ระหว่าง 0-100' };

    const pct = (CONFIG.POOL_RATIOS[pool] || 0) * linePct;  // combined ratio
    const ds5 = _ss().getSheetByName('DS5_AdminAlloc');
    const d5  = ds5.getDataRange().getValues();

    if (allocId) {
      // แก้ไขแถวที่มีอยู่
      const ri = d5.findIndex((r,i) => i > 0 && r[C5.ID] === allocId);
      if (ri < 0) return { success:false, message:'ไม่พบรายการ ID: '+allocId };
      const row = ri + 1;
      ds5.getRange(row, C5.LINE+1).setValue(lineName);
      ds5.getRange(row, C5.POOL+1).setValue(pool);
      ds5.getRange(row, C5.PCT+1).setValue(pct);
      ds5.getRange(row, C5.NOTE+1).setValue(note);
      ds5.getRange(row, C5.UPDATED+1).setValue(_now());
      // ถ้าแก้ pool/pct ให้รีเซ็ต override ด้วย
      ds5.getRange(row, C5.OVERRIDE+1).setValue('FALSE');
      _log('DS5','UPDATE_LINE',`${allocId} | ${lineName} | ${pool} | ${(linePct*100).toFixed(1)}%`);
    } else {
      // เพิ่มแถวใหม่
      const aid = 'A'+Utilities.getUuid().substring(0,6).toUpperCase();
      ds5.appendRow([aid, fy, lineName, pool, pct, 0, 'FALSE', 0, 0, _now(), note || 'เพิ่มด้วยตนเอง']);
      _log('DS5','ADD_LINE',`${aid} | ${lineName} | ${pool}`);
    }
    _recalcAdminAlloc(fy);
    return { success:true };
  } catch(e) { return { success:false, message:e.message }; }
}

// ลบสายบริหาร
function deleteAdminLine(allocId) {
  try {
    const ds5 = _ss().getSheetByName('DS5_AdminAlloc');
    const d5  = ds5.getDataRange().getValues();
    const ri  = d5.findIndex((r,i) => i > 0 && r[C5.ID] === allocId);
    if (ri < 0) return { success:false, message:'ไม่พบรายการ ID: '+allocId };
    const fy  = Number(d5[ri][C5.YEAR]) || CONFIG.FISCAL_YEAR;
    ds5.deleteRow(ri+1);
    _recalcAdminAlloc(fy);
    _log('DS5','DELETE_LINE',allocId);
    return { success:true };
  } catch(e) { return { success:false, message:e.message }; }
}

function overrideAdminAlloc(allocId, overrideAmount, note) {
  try {
    const ss  = _ss();
    const ds5 = ss.getSheetByName('DS5_AdminAlloc');
    const d5  = ds5.getDataRange().getValues();
    for (let i=1; i<d5.length; i++) {
      if (d5[i][C5.ID] === allocId) {
        ds5.getRange(i+1, C5.ALLOC+1).setValue(_n(overrideAmount));
        ds5.getRange(i+1, C5.OVERRIDE+1).setValue('TRUE');
        ds5.getRange(i+1, C5.OVERRIDE_AMT+1).setValue(_n(overrideAmount));
        ds5.getRange(i+1, C5.NOTE+1).setValue(note||'');
        ds5.getRange(i+1, C5.UPDATED+1).setValue(_now());
        _log('DS5','OVERRIDE',`${allocId} → ${overrideAmount}`);
        return { success:true };
      }
    }
    return { success:false, message:'ไม่พบ Alloc_ID' };
  } catch(e) { return { success:false, message:e.message }; }
}

function resetAdminAllocOverride(allocId) {
  try {
    const ss  = _ss();
    const ds5 = ss.getSheetByName('DS5_AdminAlloc');
    const d5  = ds5.getDataRange().getValues();
    for (let i=1; i<d5.length; i++) {
      if (d5[i][C5.ID] === allocId) {
        ds5.getRange(i+1, C5.OVERRIDE+1).setValue('FALSE');
        const rowFY = d5[i][C5.YEAR] ? Number(d5[i][C5.YEAR]) : CONFIG.FISCAL_YEAR;
        _recalcAdminAlloc(rowFY);
        _log('DS5','RESET_OVERRIDE',allocId);
        return { success:true };
      }
    }
    return { success:false, message:'ไม่พบ Alloc_ID' };
  } catch(e) { return { success:false, message:e.message }; }
}

// ─── DS6 Activities (import จาก กันเงิน) ──────
function importActivities(rows, adminLineMap, fiscalYear) {
  const t0 = Date.now();
  try {
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    _ensureDs6Schema(ds6);
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;

    const MAP = adminLineMap || _defaultAdminLineMap();

    const valid = [];
    rows.forEach(r => {
      if (!r || !r[2]) return;
      const group    = String(r[1]||'').replace(/\n.*$/,'').trim();
      const adminLine= Object.entries(MAP).find(([k])=>group.includes(k))?.[1] || 'ไม่ระบุ';
      const aid      = 'X'+Utilities.getUuid().substring(0,8).toUpperCase();
      const btypeOld = String(r[6]||'').trim();
      valid.push([
        aid,
        r[0] ? (r[0] instanceof Date ? Utilities.formatDate(r[0],CONFIG.TIMEZONE,'yyyy-MM-dd') : String(r[0])) : '',
        group, adminLine,
        String(r[2]||'').trim(),
        _n(r[3]), _n(r[4]),
        String(r[5]||'').trim(), btypeOld,
        '', '',
        'FALSE', '', '', '',
        '',
        _inferDS6Wtype(btypeOld),
      ]);
    });

    if (!valid.length) return { success:false, message:'ไม่พบกิจกรรม' };

    ds6.getRange(ds6.getLastRow()+1, 1, valid.length, valid[0].length).setValues(valid);

    _syncActivitiesToDS5(fy);

    _log('DS6','IMPORT_ACT',`${valid.length} กิจกรรม`,valid.length,Date.now()-t0);
    return { success:true, count:valid.length,
             message:`นำเข้า ${valid.length} กิจกรรม | DS5 updated` };
  } catch(e) { return { success:false, message:e.message }; }
}

// ────────────────────────────────────────────────────────────────────────────
//  นำเข้า DS6 จาก CSV ไฟล์ "รายละเอียด กันเงิน" (กรมอนามัย ศอ.10)
// ────────────────────────────────────────────────────────────────────────────
function importDS6FromGanoenCSV(csvText, fiscalYear, clearFirst) {
  const t0 = Date.now();
  try {
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    if (!ds6) return { success: false, message: 'ไม่พบ DS6_Activities sheet' };
    _ensureDs6Schema(ds6);

    const fy = Number(fiscalYear || CONFIG.FISCAL_YEAR);

    // ── CSV parser (รองรับ quoted fields ที่มี comma หรือ newline) ─────────
    function _parseCSV(text) {
      const result = [];
      let row = [], cur = '', inQ = false;
      const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inQ) {
          if (c === '"' && s[i+1] === '"') { cur += '"'; i++; }
          else if (c === '"') inQ = false;
          else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ',') { row.push(cur.trim()); cur = ''; }
          else if (c === '\n') { row.push(cur.trim()); result.push(row); row = []; cur = ''; }
          else cur += c;
        }
      }
      if (cur !== '' || row.length) { row.push(cur.trim()); result.push(row); }
      return result;
    }

    // ── แปลงวันที่ภาษาไทย เช่น "3/ต.ค./2025" → "2025-10-03" ────────────
    const MONTHS_TH = {
      'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,
      'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12
    };
    function _parseThaiDate(s) {
      const m = String(s||'').trim().match(/(\d{1,2})\/([\u0E00-\u0E7F.]{3,6})\/(\d{4})/);
      if (!m) return null;
      const mo = MONTHS_TH[m[2]];
      if (!mo) return null;
      const yr = parseInt(m[3]);
      const dy = parseInt(m[1]);
      try {
        const d = new Date(yr, mo - 1, dy);
        return Utilities.formatDate(d, CONFIG.TIMEZONE || 'Asia/Bangkok', 'yyyy-MM-dd');
      } catch(_) { return null; }
    }

    // ── แปลง string ตัวเลข "1,960.00" → number ──────────────────────────
    function _parseNum(s) {
      const v = parseFloat(String(s||'').replace(/,/g,''));
      return isFinite(v) ? v : 0;
    }

    // ── Parse CSV ─────────────────────────────────────────────────────────
    const allRows = _parseCSV(String(csvText || ''));
    // ข้าม 5 แถวแรก (rows 0-4) + row 6 header (index 5) → เริ่มที่ index 6
    const dataRows = allRows.slice(6);

    // ── ถ้า clearFirst: ล้าง DS6 ที่เป็นปีงบนี้ออกก่อน ─────────────────
    if (clearFirst) {
      const lastRow = ds6.getLastRow();
      if (lastRow > 1) {
        const nCols = ds6.getLastColumn() || 15;
        const existing = ds6.getRange(2, 1, lastRow - 1, nCols).getValues();
        const keep = existing.filter(r => _fiscalYearFromDateValue(r[C6.DATE]) !== fy);
        ds6.getRange(2, 1, lastRow - 1, nCols).clearContent();
        if (keep.length > 0) ds6.getRange(2, 1, keep.length, nCols).setValues(keep);
      }
    }

    // ── สร้าง DS6 rows ───────────────────────────────────────────────────
    const valid = [];
    let skipped = 0;
    dataRows.forEach(cols => {
      // padding
      while (cols.length < 15) cols.push('');

      const dateStr  = cols[0];  // วันที่กันเงิน
      const group    = cols[2];  // กลุ่มงาน
      const project  = cols[3];  // โครงการ
      const activity = cols[4];  // แผนงาน/กิจกรรม
      const budgetS  = cols[5];  // งบประมาณ
      const paidS    = cols[7];  // po/กันเงิน/เบิกจ่าย
      const budgCode = cols[8];  // รหัสงบประมาณ
      const status   = cols[10]; // สถานะเงิน
      const btype    = cols[11]; // ประเภทงบประมาณ
      const adminLn  = cols[12]; // สายรองฯ

      // Skip: แถว header ซ้ำที่ฝังในข้อมูล (col[2] === 'กลุ่มงาน')
      if (group === 'กลุ่มงาน' || group === 'กลุ่มงาน ') { skipped++; return; }
      // Skip: ไม่มีกิจกรรม
      if (!activity) { skipped++; return; }
      // Skip: ไม่มีวันที่ที่แปลงได้
      const parsedDate = _parseThaiDate(dateStr);
      if (!parsedDate) { skipped++; return; }

      const person   = String(cols[1] || '').trim();   // ผู้รับผิดชอบ (CSV col B)
      const duration = String(cols[6] || '').trim();   // ระยะเวลาดำเนินการ (CSV col G)
      const id = 'G' + Utilities.getUuid().substring(0, 8).toUpperCase();
      valid.push([
        id,
        parsedDate,
        group,
        adminLn,
        activity,
        _parseNum(budgetS),
        _parseNum(paidS),
        status,
        btype,
        project,
        budgCode,
        'FALSE', '', '', '',
        person,
        _inferDS6Wtype(btype),   // WTYPE auto-assign จาก ประเภทงบ
        duration,                // ระยะเวลาดำเนินการ
      ]);
    });

    if (!valid.length) return { success: false, message: `ไม่พบแถวข้อมูลที่นำเข้าได้ (ข้าม ${skipped} แถว)` };

    // ── เขียนลง DS6 ──────────────────────────────────────────────────────
    const startRow = ds6.getLastRow() + 1;
    ds6.getRange(startRow, 1, valid.length, valid[0].length).setValues(valid);

    // ── sync ยอดเบิกจ่ายไป DS5 ──────────────────────────────────────────
    _syncActivitiesToDS5(fy);

    _log('DS6', 'CSV_IMPORT', `fy:${fy} ok:${valid.length} skip:${skipped}`, valid.length, Date.now() - t0);
    return {
      success: true,
      count: valid.length,
      skipped,
      message: `นำเข้าสำเร็จ ${valid.length} รายการ (ข้าม ${skipped} แถว) · DS5 อัปเดตแล้ว`,
    };
  } catch(e) {
    _log('DS6', 'CSV_IMPORT_ERR', e.message);
    return { success: false, message: e.message };
  }
}

function _syncActivitiesToDS5(fiscalYear) {
  const ss  = _ss();
  const ds6 = ss.getSheetByName('DS6_Activities').getDataRange().getValues().slice(1);
  const ds5 = ss.getSheetByName('DS5_AdminAlloc');
  const d5  = ds5.getDataRange().getValues();

  let fy = Number(fiscalYear);
  if (!Number.isFinite(fy) || fy < 2500) fy = CONFIG.FISCAL_YEAR;
  const paidByLine = {};

  const activeD5Lines = d5.slice(1).map(r => String(r[C5.LINE] || '').trim()).filter(Boolean);
  const map = _defaultAdminLineMap();

  ds6.forEach(r => {
    if (_isTrue(r[C6.IS_DELETED])) return;
    if (String(r[C6.STATUS] || '').trim() !== 'เบิกจ่ายแล้ว') return; // นับเฉพาะเบิกจ่ายแล้ว
    let line = String(r[C6.ADMIN_LINE] != null ? r[C6.ADMIN_LINE] : r[3] || 'ไม่ระบุ').trim() || 'ไม่ระบุ';

    if (!activeD5Lines.includes(line)) {
      const group = String(r[C6.GROUP] != null ? r[C6.GROUP] : r[2] || '').trim();
      const mapped = Object.entries(map).find(([k]) => group.includes(k) || line.includes(k))?.[1];
      if (mapped) {
        line = mapped;
      } else if (['การเงิน', 'บริหาร', 'พัสดุ', 'ทรัพยากรบุคคล', 'hr', 'สารบรรณ'].some(x => group.toLowerCase().includes(x) || line.toLowerCase().includes(x))) {
        line = 'ค่าใช้จ่ายพื้นฐาน';
      }
    }

    const actFY = _fiscalYearFromDateValue(r[1]);
    if (actFY !== fy) return;
    paidByLine[line] = (paidByLine[line] || 0) + _n(r[C6.PAID]);
  });

  const now = _now();
  for (let i = 1; i < d5.length; i++) {
    const line = String(d5[i][C5.LINE] || '').trim();
    const rowFY = d5[i][C5.YEAR] ? Number(d5[i][C5.YEAR]) : null;
    if (rowFY != null && rowFY !== fy) continue;
    const p = _r(paidByLine[line] || 0);
    ds5.getRange(i + 1, C5.PAID + 1).setValue(p);
    ds5.getRange(i + 1, C5.UPDATED + 1).setValue(now);
  }
}

function listActivities(fiscalYear, keyword, page, pageSize, includeDeleted) {
  try {
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    _ensureDs6Schema(ds6);
    const fy  = fiscalYear ? Number(fiscalYear) : null;
    const q   = String(keyword || '').trim().toLowerCase();
    const p   = Number(page) > 0 ? Number(page) : 1;
    const ps  = Number(pageSize) > 0 ? Number(pageSize) : 20;
    const withDeleted = includeDeleted === true || String(includeDeleted).toLowerCase() === 'true';
    let rows = ds6.getDataRange().getValues().slice(1);

    if (fy) {
      const hasFyRows = rows.some(r =>
        r[C6.ID] &&
        !_isTrue(r[C6.IS_DELETED]) &&
        _fiscalYearFromDateValue(r[C6.DATE]) === fy
      );
      if (!hasFyRows) {
        _bootstrapActivitiesFromTransactions(fy);
        rows = ds6.getDataRange().getValues().slice(1);
      }
    }

    let out = rows
      .filter(r => r[0])
      .filter(r => withDeleted || !_isTrue(r[C6.IS_DELETED]))
      .map(r => ({
        id: r[0],
        date: _toYmd(r[1]),
        group: String(r[2] || ''),
        adminLine: String(r[3] || ''),
        activity: String(r[4] || ''),
        budget: _n(r[5]),
        paid: _n(r[6]),
        status: String(r[7] || ''),
        btype: String(r[8] || ''),
        project: String(r[C6.PROJECT] || ''),
        budgetCode: String(r[C6.BUDGET_CODE] || ''),
        person: String(r[C6.PERSON] || ''),
        duration: String(r[C6.DURATION] || ''),
        fiscalYear: _fiscalYearFromDateValue(r[1]),
        isDeleted: _isTrue(r[C6.IS_DELETED]),
        deletedAt: _toYmd(r[C6.DELETED_AT]),
        deletedBy: String(r[C6.DELETED_BY] || ''),
        deleteReason: String(r[C6.DELETE_REASON] || ''),
      }));

    if (fy) out = out.filter(r => r.fiscalYear === fy);
    if (q) {
      out = out.filter(r => [
        r.id, r.date, r.group, r.adminLine, r.activity, r.status, r.btype, r.project, r.budgetCode
      ].join(' ').toLowerCase().includes(q));
    }

    out.sort((a,b) => String(b.date).localeCompare(String(a.date)));
    const total = out.length;
    const totalPages = Math.max(1, Math.ceil(total / ps));
    const pageSafe = Math.min(Math.max(1, p), totalPages);
    const start = (pageSafe - 1) * ps;
    const pageRows = out.slice(start, start + ps);
    return {
      success:true,
      rows: pageRows,
      count: pageRows.length,
      total,
      page: pageSafe,
      pageSize: ps,
      totalPages,
    };
  } catch (e) {
    return { success:false, message:e.message, rows:[] };
  }
}

function _bootstrapActivitiesFromTransactions(fiscalYear) {
  const fy = Number(fiscalYear);
  if (!fy) return 0;
  const ss = _ss();
  const ds6 = ss.getSheetByName('DS6_Activities');
  const txSh = ss.getSheetByName('DS1_Transactions');
  if (!ds6 || !txSh) return 0;
  _ensureDs6Schema(ds6);

  const existingIds = new Set(
    ds6.getDataRange().getValues().slice(1).map(r => String(r[C6.ID] || ''))
  );
  const txRows = txSh.getDataRange().getValues().slice(1).filter(r => r[0]);
  const appendRows = [];

  txRows.forEach(r => {
    const txDate = r[1];
    const txFy = _fiscalYearFromDateValue(txDate);
    if (txFy !== fy) return;

    const rawTxId = String(r[0] || '').trim();
    if (!rawTxId) return;
    const actId = ('T' + rawTxId).replace(/[^A-Za-z0-9_-]/g, '').substring(0, 28);
    if (!actId || existingIds.has(actId)) return;

    const txType = String(r[5] || '').trim();
    const plan = String(r[3] || '').trim();
    const code = String(r[2] || '').trim();
    const diff = Math.abs(_n(r[8]));
    const amount = diff > 0 ? diff : Math.abs(_n(r[7]) - _n(r[6]));
    const budget = amount;
    const paid = amount;

    const btypeTx = String(r[4] || '');
    appendRows.push([
      actId,
      _toYmd(txDate),
      'การเงิน',
      'การเงิน',
      `${txType || 'TX'} | ${plan || code || '-'}`,
      budget,
      paid,
      txType || 'ดึงจาก DS1',
      btypeTx,
      plan || '',
      code || '',
      'FALSE', '', '', '',
      '',
      _inferDS6Wtype(btypeTx),
    ]);
    existingIds.add(actId);
  });

  if (appendRows.length) {
    ds6.getRange(ds6.getLastRow() + 1, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
    _log('DS6','BOOTSTRAP_DS1',`FY ${fy} +${appendRows.length}`);
  }
  return appendRows.length;
}

// ─── ตรวจงบ 2 ชั้น ─────────────────────────────────────────────────────────
// ชั้น 1 (activityId ≠ null): วงเงินคงเหลือของกิจกรรมนั้นใน DS6
//   → ใช้สำหรับ "กันเงินเพิ่มในกิจกรรมเดิม" ไม่ใช้ตอน createActivity
// ชั้น 2 (budgetCode ≠ ''): Remaining ใน DS2_MasterBudget
//   → ใช้ทุกครั้งที่มี budgetCode
function _checkBudget2Layer(activityId, budgetCode, requestAmount, fiscalYear) {
  const fy     = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
  const amount = _n(requestAmount);
  if (amount <= 0) return { ok: true };
  const ss = _ss();

  // ชั้น 1 — วงเงินกิจกรรม (DS6) — ข้ามถ้าไม่มี activityId
  if (activityId) {
    const ds6 = ss.getSheetByName('DS6_Activities').getDataRange().getValues();
    for (let i = 1; i < ds6.length; i++) {
      if (String(ds6[i][0]) !== String(activityId)) continue;
      if (_isTrue(ds6[i][11])) break;
      const actRemain = _r(_n(ds6[i][5]) - _n(ds6[i][6]));
      if (actRemain < amount)
        return { ok:false, layer:1,
          message:`วงเงินกิจกรรมไม่พอ — คงเหลือ ฿${actRemain.toLocaleString()} ต้องการ ฿${amount.toLocaleString()}` };
      break;
    }
  }

  // ชั้น 2 — หมวดรายจ่ายรวม (DS2_MasterBudget)
  if (budgetCode) {
    const normCode = _normCode(budgetCode);
    const ds2 = ss.getSheetByName('DS2_MasterBudget').getDataRange().getValues();
    let found = false;
    for (let i = 1; i < ds2.length; i++) {
      if (_normCode(String(ds2[i][C2.CODE]||'')) !== normCode) continue;
      if (Number(ds2[i][C2.FISCAL_YEAR]) !== fy) continue;
      found = true;
      const budgetRemain = _n(ds2[i][C2.REMAIN]);
      if (budgetRemain < amount)
        return { ok:false, layer:2,
          message:`งบหมวดรายจ่ายไม่พอ — รหัส ${budgetCode} คงเหลือ ฿${budgetRemain.toLocaleString()} ต้องการ ฿${amount.toLocaleString()}` };
      break;
    }
    if (!found)
      return { ok:false, layer:2,
        message:`ไม่พบรหัสงบประมาณ ${budgetCode} ในปีงบ ${fy} — กรุณาตรวจสอบ MasterBudget` };
  }

  return { ok: true };
}

// ─── Cascading Dropdown: โครงการ → กิจกรรม → รหัสงบ (สำหรับ Web UI) ────────
function getCascadingDropdownData(fiscalYear) {
  try {
    const fy  = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities').getDataRange().getValues().slice(1);

    const projMap = {};
    ds6.forEach(r => {
      if (_isTrue(r[11])) return;
      if (_fiscalYearFromDateValue(r[1]) !== fy) return;
      const proj = String(r[9] || 'ไม่ระบุโครงการ').trim();
      if (!projMap[proj]) projMap[proj] = [];
      projMap[proj].push({
        id:         String(r[0]),
        name:       String(r[4] || ''),
        group:      String(r[2] || ''),
        adminLine:  String(r[3] || ''),
        budgetCode: String(r[10] || ''),
        wtype:      String(r[16] || ''),
        budget:     _n(r[5]),
        paid:       _n(r[6]),
        remaining:  _r(_n(r[5]) - _n(r[6])),
        status:     String(r[7] || ''),
      });
    });

    const projects = Object.entries(projMap).map(([name, activities]) => ({
      name,
      activities: activities.sort((a, b) => b.remaining - a.remaining),
    }));

    return { success: true, fiscalYear: fy, projects };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function createActivity(payload, fiscalYear) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const p = payload || {};
    const v = _validateActivityPayload(p);
    if (!v.success) return v;
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    _ensureDs6Schema(ds6);
    const fy  = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    // ตรวจ 2 ชั้น ก่อนบันทึก
    if (v.budget > 0) {
      const check = _checkBudget2Layer(null, String(p.budgetCode||'').trim(), v.budget, fy);
      if (!check.ok) return { success:false, message:check.message };
    }
    const dateStr = _toYmd(p.date || _now().substring(0,10));
    const map = _defaultAdminLineMap();
    const group = String(p.group || '').trim();
    const adminLine = Object.entries(map).find(([k]) => group.includes(k))?.[1] || (p.adminLine || 'ไม่ระบุ');
    const actId = 'X' + Utilities.getUuid().substring(0,8).toUpperCase();
    const btypeNew = String(p.btype || '').trim();
    const row = [
      actId,
      dateStr,
      group,
      adminLine,
      String(p.activity || '').trim(),
      v.budget,
      v.paid,
      String(p.status || '').trim(),
      btypeNew,
      String(p.project || '').trim(),
      String(p.budgetCode || '').trim(),
      'FALSE', '', '', '',
      String(p.person || '').trim(),
      String(p.wtype || '').trim() || _inferDS6Wtype(btypeNew),
      String(p.duration || '').trim(),
    ];
    ds6.appendRow(row);
    _syncActivitiesToDS5(fy);
    // บันทึก RESERVE transaction → DS1 (ledger กลาง)
    const txSh = ss.getSheetByName('DS1_Transactions');
    if (txSh) {
      const txId = 'RSV' + Utilities.getUuid().substring(0,8).toUpperCase();
      txSh.appendRow([txId, dateStr, row[10]||'', row[9]||'', row[16]||'',
        'RESERVE', 0, v.budget, v.budget, 0, 0, 0,
        Session.getActiveUser().getEmail()||'system',
        `กันเงิน: ${row[4]}`, '', actId, 'Reserved']);
    }
    _log('DS6','CREATE',`${actId} ${row[4]}`);
    return { success:true, id:actId };
  } catch (e) {
    return { success:false, message:e.message };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

function updateActivity(activityId, payload, fiscalYear) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const p = payload || {};
    const v = _validateActivityPayload(p);
    if (!v.success) return v;
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    _ensureDs6Schema(ds6);
    const fy  = fiscalYear ? Number(fiscalYear) : null;
    const data = ds6.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(activityId)) continue;
      if (_isTrue(data[i][C6.IS_DELETED])) return { success:false, message:'รายการนี้ถูกลบแล้ว' };
      const oldFy = _fiscalYearFromDateValue(data[i][1]);
      const map = _defaultAdminLineMap();
      const group = String(p.group || data[i][2] || '').trim();
      const adminLine = Object.entries(map).find(([k]) => group.includes(k))?.[1] || (p.adminLine || data[i][3] || 'ไม่ระบุ');
      const dateStr = _toYmd(p.date || data[i][1]);
      const updatedBtype = String(p.btype ?? data[i][C6.BTYPE] ?? '').trim();
      const updatedWtype = String(p.wtype ?? data[i][C6.WTYPE] ?? '').trim()
                           || _inferDS6Wtype(updatedBtype);
      const _oldBudget = _n(data[i][5]);
      const _oldPaid   = _n(data[i][6]);
      const _oldStatus = String(data[i][7] || '');
      // ตรวจ DS2 ถ้างบเพิ่มขึ้น (Layer 2 เท่านั้น — Layer 1 ไม่ใช้เพราะ activity นี้คือตัวถูกแก้)
      if (v.budget > _oldBudget) {
        const increase = v.budget - _oldBudget;
        const bc = String(p.budgetCode ?? data[i][C6.BUDGET_CODE] ?? '').trim();
        const checkFy = _fiscalYearFromDateValue(_toYmd(p.date || data[i][1])) || CONFIG.FISCAL_YEAR;
        const check = _checkBudget2Layer(null, bc, increase, checkFy);
        if (!check.ok) return { success:false, message:check.message };
      }
      const newRow = [
        data[i][0],
        dateStr,
        group,
        adminLine,
        String(p.activity ?? data[i][4] ?? '').trim(),
        v.budget,
        v.paid,
        String(p.status ?? data[i][7] ?? '').trim(),
        updatedBtype,
        String(p.project ?? data[i][C6.PROJECT] ?? '').trim(),
        String(p.budgetCode ?? data[i][C6.BUDGET_CODE] ?? '').trim(),
        data[i][C6.IS_DELETED] || 'FALSE',
        data[i][C6.DELETED_AT] || '',
        data[i][C6.DELETED_BY] || '',
        data[i][C6.DELETE_REASON] || '',
        String(p.person ?? data[i][C6.PERSON] ?? '').trim(),
        updatedWtype,
        String(p.duration ?? data[i][C6.DURATION] ?? '').trim(),
      ];
      ds6.getRange(i+1, 1, 1, 18).setValues([newRow]);
      const newFy = _fiscalYearFromDateValue(dateStr);
      if (oldFy) _syncActivitiesToDS5(oldFy);
      if (newFy && newFy !== oldFy) _syncActivitiesToDS5(newFy);
      if (fy && fy !== oldFy && fy !== newFy) _syncActivitiesToDS5(fy);
      // บันทึก UPDATE transaction → DS1
      const txShUpd = ss.getSheetByName('DS1_Transactions');
      if (txShUpd) {
        const txId = 'UPD' + Utilities.getUuid().substring(0,8).toUpperCase();
        txShUpd.appendRow([txId, dateStr, newRow[10]||'', newRow[9]||'', newRow[16]||'',
          'UPDATE', _oldBudget, v.budget, v.budget - _oldBudget,
          _oldPaid, v.paid, 0,
          Session.getActiveUser().getEmail()||'system',
          `แก้ไข: ${newRow[4]} | status: ${_oldStatus}→${newRow[7]}`, '',
          activityId, 'Updated']);
      }
      _log('DS6','UPDATE',`${activityId} ${newRow[4]} | prev budget=${_oldBudget} paid=${_oldPaid} status=${_oldStatus} -> budget=${v.budget} paid=${v.paid} status=${newRow[7]}`);
      return { success:true };
    }
    return { success:false, message:'ไม่พบรายการกิจกรรม' };
  } catch (e) {
    return { success:false, message:e.message };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  สมุดคุมการเบิกจ่าย — ดึง DS6 แยกตาม BUDGET_CODE
// ══════════════════════════════════════════════════════════════════════════
function getBudgetLedger(budgetCode, fiscalYear) {
  try {
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    const ds2 = ss.getSheetByName('DS2_MasterBudget');
    if (!ds6) return { success:false, message:'ไม่พบ DS6_Activities' };
    _ensureDs6Schema(ds6);

    const fy   = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const code = String(budgetCode || '').trim();

    // ── หาข้อมูล DS2 สำหรับรหัสนี้ ────────────────────────────────────
    let ds2Name = '', ds2Alloc = 0, ds2Plan = '';
    const planAliases = new Set(); // ชื่อแผนงานทั้งหมดที่ตรงกับ code นี้
    planAliases.add(_normCode(code)); // ใช้ตัวเลขรหัสด้วย เผื่อ DS6 เก็บรหัสจริง
    if (ds2) {
      const md = ds2.getDataRange().getValues();
      for (let i = 1; i < md.length; i++) {
        const r = md[i];
        const fyRow = Number(r[C2.FISCAL_YEAR] || 0);
        if (fyRow && fyRow !== fy) continue;
        if (_normCode(String(r[C2.CODE] || '')) === _normCode(code)) {
          ds2Name  = String(r[C2.PLAN] || '');
          ds2Alloc = _n(r[C2.ALLOC_TOTAL]);  // แก้: ALLOC_TOTAL ไม่ใช่ ALLOC
          ds2Plan  = String(r[C2.WTYPE] || '');
          // เพิ่มชื่อแผนงานเป็น alias สำหรับ match DS6
          if (ds2Name) planAliases.add(_normCode(ds2Name));
          break;
        }
      }
    }

    // ── ดึง DS6 กรอง BUDGET_CODE + ปีงบ ──────────────────────────────
    // DS6.BUDGET_CODE อาจเก็บเป็น ชื่อแผนงาน หรือ ตัวเลขรหัส
    // ใช้ planAliases (ทั้ง code และ plan name) เพื่อ match ให้ครบ
    const allRows = ds6.getDataRange().getValues().slice(1);
    const rows = allRows
      .filter(r =>
        r[C6.ID] &&
        !_isTrue(r[C6.IS_DELETED]) &&
        planAliases.has(_normCode(String(r[C6.BUDGET_CODE] || ''))) &&
        _fiscalYearFromDateValue(r[C6.DATE]) === fy
      )
      .sort((a, b) => {
        const da = _toYmd(a[C6.DATE]) || '';
        const db = _toYmd(b[C6.DATE]) || '';
        return da.localeCompare(db);
      });

    // ── คำนวณ running balance ────────────────────────────────────────
    let balance = ds2Alloc;
    let totalBudget = 0, totalPaid = 0;
    const items = rows.map((r, idx) => {
      const budget = _n(r[C6.BUDGET]);
      const paid   = _n(r[C6.PAID]);
      const status = String(r[C6.STATUS] || '');
      balance  -= budget;
      totalBudget += budget;
      totalPaid   += paid;
      return {
        no:       idx + 1,
        id:       String(r[C6.ID] || ''),
        project:  String(r[C6.PROJECT]  || ''),
        activity: String(r[C6.ACTIVITY] || ''),
        duration: String(r[C6.DURATION] || ''),
        date:     _toYmd(r[C6.DATE]),
        budget:   budget,
        paid:     paid,
        status:   status,
        person:   String(r[C6.PERSON] || ''),
        group:    String(r[C6.GROUP]  || ''),
        btype:    String(r[C6.BTYPE]  || ''),
        balance:  _r(balance),
      };
    });

    return {
      success:    true,
      budgetCode: code,
      budgetName: ds2Name,
      budgetPlan: ds2Plan,
      fiscalYear: fy,
      alloc:      ds2Alloc,
      totalBudget: _r(totalBudget),
      totalPaid:   _r(totalPaid),
      remaining:   _r(balance),
      items,
    };
  } catch (e) {
    return { success:false, message:e.message };
  }
}

// ── เติม Wallet_Type ให้แถวเก่าที่ยังว่าง (one-time migration) ─────────────
function migrateDS6WtypeFromBtype(fiscalYear) {
  try {
    const ds6 = _ss().getSheetByName('DS6_Activities');
    if (!ds6 || ds6.getLastRow() <= 1) return { success:true, updated:0 };
    _ensureDs6Schema(ds6);

    const lastRow = ds6.getLastRow();
    const nCols   = Math.max(ds6.getLastColumn(), C6.WTYPE + 1);
    const data    = ds6.getRange(2, 1, lastRow - 1, nCols).getValues();
    const fy      = fiscalYear ? Number(fiscalYear) : null;

    let updated = 0;
    data.forEach((row, i) => {
      if (!row[C6.ID]) return;
      if (fy && _fiscalYearFromDateValue(row[C6.DATE]) !== fy) return;
      const existing = String(row[C6.WTYPE] || '').trim();
      if (existing) return;  // มีแล้ว ข้าม
      const inferred = _inferDS6Wtype(row[C6.BTYPE]);
      data[i][C6.WTYPE] = inferred;
      updated++;
    });

    if (updated > 0) {
      ds6.getRange(2, 1, data.length, nCols).setValues(data);
    }
    _log('DS6','MIGRATE_WTYPE',`updated:${updated}`);
    return { success:true, updated, message:`กำหนด Wallet_Type แล้ว ${updated} แถว` };
  } catch(e) {
    return { success:false, message:e.message };
  }
}

// อัปเดตเฉพาะสถานะ — ไม่ต้องส่ง payload เต็ม (สำหรับ inline dropdown)
function quickUpdateActivityStatus(activityId, newStatus, fiscalYear) {
  try {
    const VALID = ['เบิกจ่ายแล้ว','กันเงิน','PO แล้ว','รอดำเนินการ','ยกเลิก'];
    if (!VALID.includes(newStatus)) return { success:false, message:`สถานะ "${newStatus}" ไม่ถูกต้อง` };

    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    if (!ds6) return { success:false, message:'ไม่พบ DS6_Activities' };

    const data = ds6.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][C6.ID]) !== String(activityId)) continue;
      if (_isTrue(data[i][C6.IS_DELETED])) return { success:false, message:'รายการถูกลบแล้ว' };

      const oldStatus = String(data[i][C6.STATUS] || '');
      if (oldStatus === newStatus) return { success:true };

      // เขียนเฉพาะ column STATUS (col index 7 → sheet col 8)
      ds6.getRange(i + 1, C6.STATUS + 1).setValue(newStatus);

      // sync DS5 เมื่อสถานะกระทบยอดเบิกจ่าย
      const affectsDS5 = s => s === 'เบิกจ่ายแล้ว' || s === 'ยกเลิก';
      if (affectsDS5(oldStatus) || affectsDS5(newStatus)) {
        const fy = fiscalYear ? Number(fiscalYear) : (_fiscalYearFromDateValue(data[i][C6.DATE]) || CONFIG.FISCAL_YEAR);
        _syncActivitiesToDS5(fy);
      }

      _log('DS6','QUICK_STATUS',`${activityId}: ${oldStatus} → ${newStatus}`);
      return { success:true };
    }
    return { success:false, message:'ไม่พบรายการ' };
  } catch(e) {
    return { success:false, message:e.message };
  }
}

function deleteActivity(activityId, fiscalYear, reason) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    _ensureDs6Schema(ds6);
    const data = ds6.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(activityId)) continue;
      if (_isTrue(data[i][C6.IS_DELETED])) return { success:true };
      const oldFy      = _fiscalYearFromDateValue(data[i][1]);
      const _oldBudget = _n(data[i][5]);
      const _oldPaid   = _n(data[i][6]);
      const _oldStatus = String(data[i][7] || '');
      const _actName   = String(data[i][4] || '');
      ds6.getRange(i+1, C6.IS_DELETED+1, 1, 4).setValues([[
        'TRUE',
        _now(),
        Session.getActiveUser().getEmail() || 'system',
        String(reason || '').trim(),
      ]]);
      if (oldFy) _syncActivitiesToDS5(oldFy);
      if (fiscalYear && Number(fiscalYear) !== oldFy) _syncActivitiesToDS5(Number(fiscalYear));
      _log('DS6','SOFT_DELETE',`${activityId} ${_actName} | budget=${_oldBudget} paid=${_oldPaid} prevStatus=${_oldStatus} | reason=${reason||''}`);
      return { success:true };
    }
    return { success:false, message:'ไม่พบรายการกิจกรรม' };
  } catch (e) {
    return { success:false, message:e.message };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

function settleActivity(activityId, actualPaid, fiscalYear, note) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss  = _ss();
    const ds6 = ss.getSheetByName('DS6_Activities');
    _ensureDs6Schema(ds6);
    const data = ds6.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(activityId)) continue;
      if (_isTrue(data[i][C6.IS_DELETED])) return { success:false, message:'รายการนี้ถูกลบแล้ว' };
      const prevStatus = String(data[i][7] || '');
      if (prevStatus === 'เบิกจ่ายแล้ว') return { success:false, message:'ล้างหนี้ไปแล้ว' };
      const reserved  = _n(data[i][5]);
      const prevPaid  = _n(data[i][6]);
      const finalPaid = _n(actualPaid);
      const leftover  = _r(Math.max(0, reserved - finalPaid));
      ds6.getRange(i+1, 7).setValue(finalPaid);
      ds6.getRange(i+1, 8).setValue('เบิกจ่ายแล้ว');
      const fy = fiscalYear ? Number(fiscalYear) : _fiscalYearFromDateValue(data[i][1]);
      _syncActivitiesToDS5(fy);
      // บันทึก SETTLE transaction → DS1
      const txSh = ss.getSheetByName('DS1_Transactions');
      if (txSh) {
        const txId = 'STL' + Utilities.getUuid().substring(0,8).toUpperCase();
        const dateStr = _toYmd(data[i][1]);
        txSh.appendRow([txId, dateStr, String(data[i][10]||''), String(data[i][9]||''), String(data[i][16]||''),
          'SETTLE', reserved, finalPaid, -(reserved - finalPaid), 0, 0, leftover,
          Session.getActiveUser().getEmail()||'system',
          `ล้างหนี้: ${data[i][4]}${note ? ' | '+note : ''} (คืน ฿${leftover.toLocaleString()})`,
          '', activityId, 'Settled']);
        // mark RESERVE row เดิมใน DS1 → Settled (ไม่ต้อง join เวลา query)
        const ds1Data = txSh.getDataRange().getValues();
        for (let j = 1; j < ds1Data.length; j++) {
          if (String(ds1Data[j][15]) === String(activityId) &&
              String(ds1Data[j][16]) === 'Reserved') {
            txSh.getRange(j+1, 17).setValue('Settled');
            break;
          }
        }
      }
      _log('DS6','SETTLE',`${activityId} ${data[i][4]} | reserved=${reserved} prevPaid=${prevPaid} actualPaid=${finalPaid} leftover=${leftover}${note ? ' note='+note : ''}`);
      return { success:true, activityId, reserved, actualPaid:finalPaid, leftover,
               message:`ล้างหนี้สำเร็จ | ใช้จริง ฿${finalPaid.toLocaleString()} เงินคืน ฿${leftover.toLocaleString()}` };
    }
    return { success:false, message:'ไม่พบรายการกิจกรรม' };
  } catch (e) {
    return { success:false, message:e.message };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

function _sumDs6PaidForFY(fy, wtypes) {
  // นับเฉพาะแถวที่สถานะ "เบิกจ่ายแล้ว" เท่านั้น
  // wtypes: array เช่น ['A','B','C','D'] — null/undefined = ทุกประเภท
  try {
    const sh = _ss().getSheetByName('DS6_Activities');
    if (!sh) return 0;
    const rows = sh.getDataRange().getValues().slice(1);
    let s = 0;
    const y = Number(fy);
    const filterWt = Array.isArray(wtypes) && wtypes.length > 0 ? new Set(wtypes) : null;
    rows.forEach(r => {
      if (!r[C6.ID]) return;
      if (_isTrue(r[C6.IS_DELETED])) return;
      if (_fiscalYearFromDateValue(r[C6.DATE]) !== y) return;
      if (String(r[C6.STATUS] || '').trim() !== 'เบิกจ่ายแล้ว') return;
      if (filterWt) {
        // ใช้ WTYPE column ถ้ามี, fallback infer จาก BTYPE
        const wt = String(r[C6.WTYPE] || '').trim() || _inferDS6Wtype(r[C6.BTYPE]);
        if (!filterWt.has(wt)) return;
      }
      s += _n(r[C6.PAID]);
    });
    return _r(s);
  } catch (e) {
    return 0;
  }
}

function _sumDs6ReservedForFY(fy) {
  // นับ BUDGET ทุกสถานะที่ไม่ใช่ "ยกเลิก" (PO + กันเงิน)
  try {
    const sh = _ss().getSheetByName('DS6_Activities');
    if (!sh) return 0;
    const rows = sh.getDataRange().getValues().slice(1);
    let s = 0;
    const y = Number(fy);
    rows.forEach(r => {
      if (!r[C6.ID]) return;
      if (_isTrue(r[C6.IS_DELETED])) return;
      if (_fiscalYearFromDateValue(r[C6.DATE]) !== y) return;
      if (String(r[C6.STATUS] || '').trim() === 'ยกเลิก') return;
      s += _n(r[C6.BUDGET]);
    });
    return _r(s);
  } catch (e) {
    return 0;
  }
}

// ─── Dashboard ────────────────────────────────
function getDashboardData(fiscalYear) {
  const t0 = Date.now();
  try {
    const ss  = _ss();

    const requiredSheets = [
      'DS2_MasterBudget','DS1_Transactions','DS3_Targets','DS4_Logs',
      'DS5_AdminAlloc','DS6_Activities','DS0_Staging','DS7_Transfers','source'
    ];
    const hasAll = requiredSheets.every(name => !!ss.getSheetByName(name));
    if (!hasAll) setupSheets();

    const ds2sheet = ss.getSheetByName('DS2_MasterBudget');
    if (!ds2sheet || ds2sheet.getLastRow() <= 1)
      return { success:false, message:'DS2_MasterBudget ว่างหรือไม่พบ — กรุณารัน setupSheets() และ migrate ก่อน',
               availableYears:[], tableRows:[] };
    const allMd = ds2sheet.getDataRange().getValues().slice(1).filter(r=>r[C2.ID]);
    const _getRowFY = r => {
      if (r[C2.FISCAL_YEAR] && Number(r[C2.FISCAL_YEAR]) > 2560)
        return Number(r[C2.FISCAL_YEAR]);
      const idMatch = String(r[C2.ID]).match(/B(25\d{2})/);
      if (idMatch) return Number(idMatch[1]);
      return CONFIG.FISCAL_YEAR;
    };
    const supportedYears = [2568, 2569];
    const availableYears = supportedYears;

    const yearCount = {};
    allMd.forEach(r => {
      const y = _getRowFY(r);
      if (supportedYears.includes(y)) yearCount[y] = (yearCount[y] || 0) + 1;
    });
    const defaultFy = supportedYears.reduce((best, y) =>
      (yearCount[y] || 0) > (yearCount[best] || 0) ? y : best
    , supportedYears[0]);
    const fy = fiscalYear ? Number(fiscalYear) : defaultFy;
    const md = allMd.filter(r => _getRowFY(r) === Number(fy));
    _recalcAdminAlloc(fy);
    _syncActivitiesToDS5(fy);
    SpreadsheetApp.flush();
    const _readD5ForYear = () =>
      ss.getSheetByName('DS5_AdminAlloc').getDataRange().getValues().slice(1)
        .filter(r => r[C5.ID] && Number(r[C5.YEAR]) === Number(fy));
    let d5 = _readD5ForYear();
    if (d5.length === 0) {
      _recalcAdminAlloc(fy);
      _syncActivitiesToDS5(fy);
      SpreadsheetApp.flush();
      d5 = _readD5ForYear();
    }
    const tgt = _getTarget(ss.getSheetByName('DS3_Targets'));
    const tpct= tgt ? tgt.pct : 0;

    const wA=md.filter(r=>r[C2.WTYPE]==='A');
    const wB=md.filter(r=>r[C2.WTYPE]==='B');
    const wC=md.filter(r=>r[C2.WTYPE]==='C');
    const wD=md.filter(r=>r[C2.WTYPE]==='D');
    const wE=md.filter(r=>r[C2.WTYPE]==='E');
    const wF=md.filter(r=>r[C2.WTYPE]==='F');
    const wX=md.filter(r=>r[C2.WTYPE]==='X');
    // A+B+C+D = งบดำเนินงาน (ใช้คำนวณ % รบจ. ส่งกรม)
    const budget=[...wA,...wB,...wC,...wD];

    const tp = r => {
      const i=_n(r[C2.INIT_PAID]), n=_n(r[C2.PAID]);
      return i>0 ? i+n : n;
    };
    const sum = (arr,fn) => arr.reduce((s,r)=>s+fn(r),0);

    // คำนวณ % รบจ. ส่งกรม (A+B+C+D = งบดำเนินงานรวม)
    const mainAlloc = sum(budget, r=>_n(r[C2.ALLOC_TOTAL]));
    const gfmisPaid = sum(budget, tp);  // GFMIS A+B+C+D (ใช้เปรียบเทียบ op budget)
    // DS6 แยก scope:
    //   mainPaid    = A+B+C+D เท่านั้น → ใช้คำนวณ ring % vs mainAlloc (scope เดียวกัน)
    //   ds6GfmisPaid = A–F (ยกเว้น H ที่ไม่ผ่าน GFMIS) → ใช้ reconcile กับ grandPaid
    const mainPaid       = _sumDs6PaidForFY(fy, ['A','B','C','D']);
    const ds6GfmisPaid   = _sumDs6PaidForFY(fy, ['A','B','C','D','E','F']);
    const activityPaidTotal = ds6GfmisPaid;   // ส่งออกไป UI (ใช้ใน recon label DS5)
    const paidPct   = mainAlloc>0 ? _r(mainPaid/mainAlloc*100) : 0;

    // รวมทั้งหมด (A+B+C+D+E+F) สำหรับแสดงในระบบ
    const allBudget=[...wA,...wB,...wC,...wD,...wE,...wF];
    const totalAllocAll = sum(allBudget, r=>_n(r[C2.ALLOC_TOTAL]));
    const totalPaidAll = sum(allBudget, tp);
    // reconcile: DS6 A–F (excl H) vs GFMIS A–F → ควรเท่ากัน
    const gfmisReconDiff = _r(Math.abs(totalPaidAll - ds6GfmisPaid));
    const totalPaidPctAll = totalAllocAll>0 ? _r(totalPaidAll/totalAllocAll*100) : 0;

    // (walletBreakdown คำนวณหลัง ds6ForFy — ดูด้านล่าง)

    // ── ตัวแปรสำหรับ reconciliation และ pro-rata ──
    const opTotalFromA = sum(wA, r => _n(r[C2.ALLOC_TOTAL]));
    const opPaidFromA  = sum(wA, tp);
    const ds5AllocSum  = _r(d5.reduce((s, r) => s + _n(r[C5.ALLOC]), 0));
    const ds5PaidSum   = _r(d5.reduce((s, r) => s + _n(r[C5.PAID]), 0));

    const useGfmisProrata =
      activityPaidTotal < 1 &&
      opPaidFromA > 0 &&
      opTotalFromA > 0;
    const paidForD5Row = r => {
      if (useGfmisProrata) {
        return _r(_n(r[C5.ALLOC]) * (opPaidFromA / opTotalFromA));
      }
      return _n(r[C5.PAID]);
    };

    const adminSummary = d5.map(r => {
      const paid = paidForD5Row(r);
      const paidPctRow = _n(r[C5.ALLOC]) > 0 ? _r(paid / _n(r[C5.ALLOC]) * 100) : 0;
      return {
        id:       r[C5.ID],
        label:    r[C5.LINE],
        line:     r[C5.LINE],
        pool:     r[C5.POOL],
        pct:      _n(r[C5.PCT]),
        note:     String(r[C5.NOTE] || ''),
        allocated:_n(r[C5.ALLOC]),
        paid,
        paidSheet: _n(r[C5.PAID]),
        isOverride: String(r[C5.OVERRIDE]).toUpperCase()==='TRUE',
        paidPct:  paidPctRow,
        alert:    (() => {
          const p = paidPctRow;
          return p<tpct-10?'red':p<tpct?'yellow':'green';
        })(),
      };
    });

    const ds5PaidDisplaySum = d5.reduce((s, r) => s + paidForD5Row(r), 0);

    const poolSummary = ['นโยบาย','ยุทธศาสตร์','พื้นฐาน'].map(pool => {
      const rows  = d5.filter(r => String(r[C5.POOL] || '').trim() === pool);
      const alloc = rows.reduce((s,r)=>s+_n(r[C5.ALLOC]),0);
      const paid  = rows.reduce((s,r)=>s+paidForD5Row(r),0);
      return { pool, alloc, paid, pct: alloc>0?_r(paid/alloc*100):0,
               targetPct: _r((CONFIG.POOL_RATIOS[pool]||0)*100) };
    });

    const ds6ForFy = (() => {
      try {
        return ss.getSheetByName('DS6_Activities').getDataRange().getValues().slice(1)
          .filter(r => r[C6.ID] && !_isTrue(r[C6.IS_DELETED]) && _fiscalYearFromDateValue(r[C6.DATE]) === fy);
      } catch(_) { return []; }
    })();

    // ยอด PO / กันเงิน = BUDGET ทุกสถานะ ยกเว้น "ยกเลิก"
    const activityReservedTotal = _r(ds6ForFy.reduce((s, r) => {
      if (String(r[C6.STATUS] || '').trim() === 'ยกเลิก') return s;
      return s + _n(r[C6.BUDGET]);
    }, 0));

    // ── walletBreakdown: คำนวณหลัง ds6ForFy ─────────────────────────────
    const _codeToWtype = {};
    md.forEach(r => {
      const code = _normCode(r[C2.CODE]);
      if (code) _codeToWtype[code] = String(r[C2.WTYPE] || 'A').trim();
    });
    const _ds6PaidByWtype = {};
    const _ds6ReservedByWtype = {};  // กันเงินรอเบิก (ไม่ใช่เบิกจ่ายแล้ว, ไม่ใช่ยกเลิก)
    ds6ForFy.forEach(r => {
      const status = String(r[C6.STATUS] || '').trim();
      const code = _normCode(r[C6.BUDGET_CODE]);
      const wt   = _codeToWtype[code] || 'A';
      if (status === 'เบิกจ่ายแล้ว') {
        _ds6PaidByWtype[wt] = (_ds6PaidByWtype[wt] || 0) + _n(r[C6.PAID]);
      } else if (status !== 'ยกเลิก') {
        _ds6ReservedByWtype[wt] = (_ds6ReservedByWtype[wt] || 0) + _n(r[C6.BUDGET]);
      }
    });
    const walletBreakdown = Object.entries(CONFIG.WALLET_META).map(([wt, meta]) => {
      const rows        = md.filter(r => r[C2.WTYPE] === wt);
      const alloc       = sum(rows, r => _n(r[C2.ALLOC_TOTAL]));
      const paidGFMIS   = sum(rows, tp);
      const paidDS6     = _r(_ds6PaidByWtype[wt]     || 0);
      const reservedDS6 = _r(_ds6ReservedByWtype[wt] || 0);
      return {
        wtype: wt, ...meta,
        alloc, count: rows.length,
        paid: paidGFMIS,
        paidGFMIS, paidDS6, reservedDS6,
        pct:    alloc > 0 ? _r(paidGFMIS / alloc * 100) : 0,
        pctDS6: alloc > 0 ? _r(paidDS6   / alloc * 100) : 0,
      };
    });
    // ─────────────────────────────────────────────────────────────────────

    const groupMap = {};
    ds6ForFy.forEach(r => {
      const grp = String(r[C6.GROUP] || 'ไม่ระบุ').trim() || 'ไม่ระบุ';
      const status = String(r[C6.STATUS] || '').trim();
      if (!groupMap[grp]) groupMap[grp] = { label: grp, allocated: 0, paid: 0, reserved: 0 };
      if (status !== 'ยกเลิก') groupMap[grp].allocated += _n(r[C6.BUDGET]);
      if (status === 'เบิกจ่ายแล้ว') groupMap[grp].paid += _n(r[C6.PAID]);
      else if (status !== 'ยกเลิก') groupMap[grp].reserved += _n(r[C6.BUDGET]);
    });
    const groupSummary = Object.values(groupMap).map(g => ({
      label:     g.label,
      allocated: _r(g.allocated),
      paid:      _r(g.paid),
      reserved:  _r(g.reserved),
      paidPct:   g.allocated > 0 ? _r(g.paid / g.allocated * 100) : 0,
      alert: (() => {
        const p = g.allocated > 0 ? _r(g.paid / g.allocated * 100) : 0;
        return p < tpct - 10 ? 'red' : p < tpct ? 'yellow' : 'green';
      })(),
    })).sort((a, b) => b.paid - a.paid);

    const thaiMoNames = ['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
    const ds3RowMap = {};
    ss.getSheetByName('DS3_Targets').getDataRange().getValues().slice(1)
      .filter(r => !r[1] || Number(r[1]) === fy)
      .forEach(r => { ds3RowMap[String(r[0]).trim()] = r; });
    const paidByCalMo = {};
    ds6ForFy.forEach(r => {
      if (String(r[C6.STATUS] || '').trim() !== 'เบิกจ่ายแล้ว') return;
      try {
        const d = r[C6.DATE] instanceof Date ? r[C6.DATE] : new Date(String(r[C6.DATE]));
        if (!isNaN(d.getTime())) {
          const mo = d.getMonth();
          paidByCalMo[mo] = (paidByCalMo[mo] || 0) + _n(r[C6.PAID]);
        }
      } catch(_) {}
    });
    const nowDate = new Date();
    const nowFy   = _fiscalYearFromDateValue(nowDate);
    const curCalMo = nowDate.getMonth();
    const curFiscalMo = curCalMo >= 9 ? curCalMo - 9 : curCalMo + 3;

    let viewFiscalMoLimit = curFiscalMo; 
    if (fy < nowFy) viewFiscalMoLimit = 11;
    if (fy > nowFy) viewFiscalMoLimit = -1;

    const totalAllocForTrend = mainAlloc || 1;
    let cumPaidAmt = 0;
    const monthlyTrend = thaiMoNames.map((m, fi) => {
      const calMo = (fi + 9) % 12;
      const paidThisMo = _r(paidByCalMo[calMo] || 0);
      cumPaidAmt += paidThisMo;
      const paidCumPct  = _r(cumPaidAmt / totalAllocForTrend * 100);
      const ds3Row      = ds3RowMap[m];
      const targetCumPct= ds3Row ? _n(ds3Row[3]) : null;
      return { 
        month: m, 
        fi, 
        paidAmt: paidThisMo, 
        paidCumPct, 
        targetCumPct, 
        isPast: fi <= viewFiscalMoLimit,
        isCurrent: (fy === nowFy && fi === curFiscalMo)
      };
    });

    // ── Transfer view model (unlimited rounds) จาก DS7_Transfers + DS2 ──
    const transferHistory = getTransferHistory(fy);
    const roundSummary = (transferHistory && transferHistory.success ? (transferHistory.rounds || []) : [])
      .slice()
      .sort((a, b) => a.roundNo - b.roundNo)
      .map(r => ({
        roundId: String(r.roundId || ''),
        roundNo: Number(r.roundNo) || 0,
        date: r.date || '-',
        description: String(r.description || ''),
        totalAmount: _n(r.totalAmount),
        count: Number(r.count) || 0,
      }));
    const roundNos = roundSummary.map(r => r.roundNo);

    const byCode = {};
    const allocByCode = {};
    md.forEach(r => {
      const code = String(r[C2.CODE] || '').trim();
      if (!code) return;
      byCode[code] = {
        id: String(r[C2.ID] || ''),
        plan: String(r[C2.PLAN] || ''),
        code,
        wtype: String(r[C2.WTYPE] || 'A'),
        paid: tp(r),
        remaining: _n(r[C2.REMAIN]),
      };
      allocByCode[code] = _n(r[C2.ALLOC_TOTAL]);
    });

    const transferMap = {};
    const ensureTransferRow = (code, planName) => {
      const c = String(code || '').trim();
      if (!c) return null;
      if (!transferMap[c]) {
        const base = byCode[c] || {};
        transferMap[c] = {
          id: base.id || '',
          plan: base.plan || String(planName || ''),
          code: c,
          wtype: base.wtype || 'A',
          paid: _n(base.paid),
          remaining: _n(base.remaining),
          total: 0,
          rounds: {},
        };
      }
      return transferMap[c];
    };

    roundSummary.forEach(round => {
      const src = (transferHistory.rounds || []).find(x => Number(x.roundNo) === Number(round.roundNo));
      (src && src.items ? src.items : []).forEach(item => {
        const row = ensureTransferRow(item.budgetCode, item.planName);
        if (!row) return;
        const amt = _n(item.amount);
        row.rounds[round.roundNo] = _r((row.rounds[round.roundNo] || 0) + amt);
      });
    });

    Object.keys(byCode).forEach(code => {
      const base = byCode[code];
      const row = ensureTransferRow(code, base.plan);
      if (!row) return;
      if (!row.id) row.id = base.id;
      if (!row.plan) row.plan = base.plan;
      row.wtype = base.wtype || row.wtype;
      row.paid = _n(base.paid);
      row.remaining = _n(base.remaining);
    });

    const transferRows = Object.values(transferMap).map(r => {
      let total = 0;
      roundNos.forEach(no => { total += _n(r.rounds[no]); });
      if (total <= 0) total = _n(allocByCode[r.code] || 0);
      const pct = total > 0 ? _r(_n(r.paid) / total * 100) : 0;
      return {
        id: r.id,
        plan: r.plan || r.code,
        code: r.code,
        wtype: r.wtype || 'A',
        total: _r(total),
        paid: _n(r.paid),
        remaining: _n(r.remaining),
        pct,
        rounds: r.rounds,
      };
    }).sort((a, b) => b.total - a.total);

    const bInvestment = wD.map(r=>({
      id:r[C2.ID],plan:r[C2.PLAN],code:r[C2.CODE],
      allocated:_n(r[C2.ALLOC_TOTAL]),paid:tp(r),remaining:_n(r[C2.REMAIN]),
      pct:_n(r[C2.ALLOC_TOTAL])>0?_r(tp(r)/_n(r[C2.ALLOC_TOTAL])*100):0,
      lastUpdate:_formatMaybeDate(r[C2.UPDATED],'dd/MM/yy HH:mm'),
    }));

    const reconcileTotal = sum(wD, r=>tp(r)+_n(r[C2.ALT]));

    // ── DS6 aggregates per DS2 code (กระทบยอดกันเงิน) ────────────────────
    // Build alias lookup: normalized name or code → DS2 original code string
    const _ds2CodeByAlias = {};
    md.forEach(r => {
      const fyRow = Number(r[C2.FISCAL_YEAR] || 0);
      if (fyRow && fyRow !== fy) return;
      const code = String(r[C2.CODE] || '').trim();
      const plan = String(r[C2.PLAN] || '').trim();
      if (code) {
        _ds2CodeByAlias[_normCode(code)] = code;
        if (plan) _ds2CodeByAlias[_normCode(plan)] = code;
      }
    });
    // Accumulate DS6 per DS2 code
    // กันเงิน+เบิก = BUDGET ของ "กันเงิน" + PAID ของ "เบิกจ่ายแล้ว"
    // (ไม่ใช้ BUDGET ของ เบิกจ่ายแล้ว เพราะยอดที่จ่ายจริงอาจต่างจากที่กัน)
    const _ds6ByCode = {}; // code → { reserved, paidOnline }
    ds6ForFy.forEach(r => {
      const alias = _normCode(String(r[C6.BUDGET_CODE] || ''));
      const code  = _ds2CodeByAlias[alias];
      if (!code) return;
      if (!_ds6ByCode[code]) _ds6ByCode[code] = { reserved: 0, paidOnline: 0 };
      const status = String(r[C6.STATUS] || '').trim();
      if (status === 'กันเงิน')       _ds6ByCode[code].reserved   += _n(r[C6.BUDGET]); // ยังไม่จ่าย ใช้ยอดกัน
      if (status === 'เบิกจ่ายแล้ว') {
        _ds6ByCode[code].reserved   += _n(r[C6.PAID]);   // จ่ายจริง ใช้ PAID (ไม่ใช่ BUDGET)
        _ds6ByCode[code].paidOnline += _n(r[C6.PAID]);
      }
    });

    const tableRows = budget.map(r=>{
      const alloc=_n(r[C2.ALLOC_TOTAL]),paid=tp(r);
      const pct=alloc>0?_r(paid/alloc*100):0;
      const codeStr = String(r[C2.CODE] || '').trim();
      const agg = _ds6ByCode[codeStr] || { reserved:0, paidOnline:0 };
      const ds6Reserved   = _r(agg.reserved);
      const ds6Remaining  = _r(alloc - agg.reserved);
      const ds6PaidOnline = _r(agg.paidOnline);
      const diffAmt = Math.abs(agg.paidOnline - paid);
      const matchStatus = paid === 0 && agg.paidOnline === 0 ? 'none'
                        : diffAmt < 1 ? 'exact'
                        : diffAmt <= Math.max(alloc * 0.01, 100) ? 'near' : 'diff';
      return {
        id:r[C2.ID],plan:r[C2.PLAN],code:codeStr,
        wtype:r[C2.WTYPE],earmarked:r[C2.EARMARK],
        allocated:alloc,paid,remaining:_n(r[C2.REMAIN]),po:_n(r[C2.PO]),
        r1:_n(r[C2.ALLOC_R1]),r2:_n(r[C2.ALLOC_R2]),r3:_n(r[C2.ALLOC_R3]),
        pct, alert:pct<tpct-10?'red':pct<tpct?'yellow':'green',
        status:r[C2.STATUS],
        ds6Reserved, ds6Remaining, ds6PaidOnline, gfPaid:paid, matchStatus,
        lastUpdate:_formatMaybeDate(r[C2.UPDATED],'dd/MM/yy HH:mm'),
      };
    });
    const _toTime = v => {
      if (!v) return null;
      try {
        if (v instanceof Date) return v.getTime();
        const d = new Date(v);
        if (isNaN(d.getTime())) return null;
        return d.getTime();
      } catch (_) { return null; }
    };
    const lastUpdateTime = md.reduce((maxT, r) => {
      const t = _toTime(r[C2.UPDATED]);
      if (t == null) return maxT;
      if (maxT == null) return t;
      return t > maxT ? t : maxT;
    }, null);

    // จัดกลุ่มเบิกจ่าย DS6 ตาม Wallet_Type (A–H) เฉพาะสถานะ "เบิกจ่ายแล้ว"
    // ใช้ C6.WTYPE ถ้ามี ไม่งั้น infer จาก BTYPE ด้วย _inferDS6Wtype()
    let ds6A = 0, ds6B = 0, ds6C = 0, ds6D = 0, ds6E = 0, ds6F = 0, ds6H = 0;
    ds6ForFy.forEach(r => {
      if (String(r[C6.STATUS] || '').trim() !== 'เบิกจ่ายแล้ว') return;
      const wt  = String(r[C6.WTYPE] || '').trim() || _inferDS6Wtype(r[C6.BTYPE]);
      const amt = _n(r[C6.PAID]);
      if      (wt === 'A') ds6A += amt;
      else if (wt === 'B') ds6B += amt;
      else if (wt === 'C') ds6C += amt;
      else if (wt === 'D') ds6D += amt;
      else if (wt === 'E') ds6E += amt;
      else if (wt === 'F') ds6F += amt;
      else if (wt === 'H') ds6H += amt;
      else                  ds6A += amt;  // default
    });

    _log('DASHBOARD','GET',`A:${wA.length} B:${wB.length} C:${wC.length} D:${wD.length} | DS5:${d5.length}`,
         md.length,Date.now()-t0);

    return {
      success:true, fiscalYear:fy, availableYears,
      summary:{
        allocated:mainAlloc, paid:mainPaid,
        reserved: activityReservedTotal,
        gfmisPaid: totalPaidAll,   // GFMIS A–F ทั้งหมด (ใช้ใน badge tooltip)
        gfmisReconDiff,            // |totalPaidAll − ds6GfmisPaid|
        po:sum(budget,r=>_n(r[C2.PO])),
        remaining:sum(budget,r=>_n(r[C2.REMAIN])),
        remainingAfterReservation: _r(sum(budget,r=>_n(r[C2.REMAIN])) - ds6ForFy.reduce((s,r) => {
          const st = String(r[C6.STATUS]||'').trim();
          return (st !== 'ยกเลิก' && st !== 'เบิกจ่ายแล้ว') ? s + _n(r[C6.BUDGET]) : s;
        }, 0)),
        paidPct, targetPct:tpct,
        targetMonth:tgt?tgt.month:'-',
        rowCount: tableRows.length,
        // จัดสรรแยก A–F (ใช้ใน breakdown bars)
        opAlloc: sum(wA,r=>_n(r[C2.ALLOC_TOTAL])), opPaid: ds6A,
        bAlloc:  sum(wB,r=>_n(r[C2.ALLOC_TOTAL])), bPaid:  ds6B,
        cAlloc:  sum(wC,r=>_n(r[C2.ALLOC_TOTAL])), cPaid:  ds6C,
        dAlloc:  sum(wD,r=>_n(r[C2.ALLOC_TOTAL])), dPaid:  ds6D,
        eAlloc:  sum(wE,r=>_n(r[C2.ALLOC_TOTAL])), ePaid:  ds6E,
        fAlloc:  sum(wF,r=>_n(r[C2.ALLOC_TOTAL])), fPaid:  ds6F,
        // legacy aliases
        opTotal: sum(wA,r=>_n(r[C2.ALLOC_TOTAL])),
        bTotal:  sum(wB,r=>_n(r[C2.ALLOC_TOTAL])),
        cTotal:  sum(wC,r=>_n(r[C2.ALLOC_TOTAL])),
        reconcileTotal,
        opTotalFromA,
        opPaidFromA,
        ds5AllocSum,
        ds5PaidSum,
        ds5PaidDisplaySum,
        activityPaidTotal,
        adminPaidMode: useGfmisProrata ? 'gfmis_prorata' : 'ds6',
        grandAlloc: sum(md,r=>_n(r[C2.ALLOC_TOTAL])),
        grandPaid: sum(md,tp),
        lastUpdate: lastUpdateTime
          ? _formatMaybeDate(new Date(lastUpdateTime),'dd/MM/yyyy HH:mm')
          : '-',
      },
      adminSummary,
      poolSummary,
      walletBreakdown,
      groupSummary,
      monthlyTrend,
      transferRounds: transferRows, // backward compatibility
      transferData: {
        roundSummary,
        roundNos,
        rows: transferRows,
      },
      tableRows,
      bInvestment,
      reconcileTotal,
    };
  } catch(e) {
    const msg = e.message || String(e);
    _log('DASHBOARD','GET','ERROR: '+msg, 0, Date.now()-t0, 'ERROR');
    return { success:false, message:'getDashboardData error: '+msg, availableYears:[], tableRows:[] };
  }
}

// ─── Misc ──────────────────────────────────────
function _serializeCellForClient(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  if (typeof v === 'object') return String(v);
  return v;
}
function getRecentLogs(n) {
  try {
    const d = _ss().getSheetByName('DS4_Logs').getDataRange().getValues();
    const raw = d.slice(1).reverse().slice(0, n || 20);
    const logs = raw.map(row => (row || []).map(_serializeCellForClient));
    return { success: true, logs: logs };
  } catch (e) {
    return { success: false, logs: [], message: e.message || String(e) };
  }
}

function debugListSheetsAndHeaders() {
  try {
    const ss = _ss();
    const wanted = [
      'DS0_Staging',
      'DS1_Transactions',
      'DS2_MasterBudget',
      'DS3_Targets',
      'DS4_Logs',
      'DS5_AdminAlloc',
      'DS6_Activities',
      'DS7_Transfers',
      'source',
    ];
    const sheets = ss.getSheets().map(sh => sh.getName());
    const headerInfo = {};

    wanted.forEach(name => {
      const sh = ss.getSheetByName(name);
      if (!sh) {
        headerInfo[name] = null;
        return;
      }
      const lastCol = sh.getLastColumn();
      const hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0];
      while (hdr.length && (hdr[hdr.length - 1] === '' || hdr[hdr.length - 1] === null)) hdr.pop();
      headerInfo[name] = hdr;
    });

    return { success: true, sheets, headerInfo };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}

function identifyDashboardFailure(fiscalYear) {
  const ms0 = Date.now();
  let step = 'start';
  try {
    step = 'open spreadsheet';
    const ss = _ss();

    step = 'ensure sheets';
    const requiredSheets = [
      'DS2_MasterBudget','DS3_Targets','DS5_AdminAlloc','DS1_Transactions',
      'DS4_Logs','DS0_Staging','DS6_Activities','DS7_Transfers','source'
    ];
    let missing = requiredSheets.filter(name => !ss.getSheetByName(name));
    if (missing.length) {
      setupSheets();
      missing = requiredSheets.filter(name => !ss.getSheetByName(name));
      if (missing.length) {
        return {
          success: false,
          step,
          message: 'still missing sheets after setupSheets()',
          missing
        };
      }
    }

    step = 'read DS2_MasterBudget';
    const ds2sheet = ss.getSheetByName('DS2_MasterBudget');
    const lastRow = ds2sheet ? ds2sheet.getLastRow() : 0;
    if (!ds2sheet || lastRow <= 1) {
      return {
        success: false,
        step,
        message: 'DS2_MasterBudget ว่างหรือไม่พบข้อมูล (lastRow <= 1)',
        lastRow
      };
    }
    const allMd = ds2sheet.getDataRange().getValues().slice(1).filter(r => r[C2.ID]);
    if (!allMd.length) {
      return { success:false, step, message:'DS2 rows after filter are empty' };
    }

    step = 'compute fiscal year';
    const _getRowFY = r => {
      if (r[C2.FISCAL_YEAR] && Number(r[C2.FISCAL_YEAR]) > 2560) return Number(r[C2.FISCAL_YEAR]);
      const idMatch = String(r[C2.ID]).match(/B(25\d{2})/);
      if (idMatch) return Number(idMatch[1]);
      return CONFIG.FISCAL_YEAR;
    };
    const yearCount = {};
    allMd.forEach(r => { const y=_getRowFY(r); yearCount[y]=(yearCount[y]||0)+1; });
    const availableYears = Object.keys(yearCount).map(Number).filter(y => y > 2560).sort((a,b)=>b-a);
    const defaultFy = availableYears.reduce((best, y) => (yearCount[y] > (yearCount[best]||0)) ? y : best, availableYears[0] || CONFIG.FISCAL_YEAR);
    const fy = fiscalYear ? Number(fiscalYear) : defaultFy;

    step = 'filter rows by FY';
    const md = allMd.filter(r => _getRowFY(r) === Number(fy));

    step = 'compute sums (A/B/C/D)';
    const wA = md.filter(r => r[C2.WTYPE] === 'A');
    const wB = md.filter(r => r[C2.WTYPE] === 'B');
    const wC = md.filter(r => r[C2.WTYPE] === 'C');
    const wD = md.filter(r => r[C2.WTYPE] === 'D');
    const budget = [...wA, ...wB, ...wC];

    const tp = r => {
      const i=_n(r[C2.INIT_PAID]), n=_n(r[C2.PAID]);
      return i>0 ? i+n : n;
    };
    const sum = (arr, fn) => arr.reduce((s,r)=>s+fn(r),0);
    const mainAlloc = sum(budget, r => _n(r[C2.ALLOC_TOTAL]));
    const mainPaid  = sum(budget, tp);
    const paidPct   = mainAlloc>0 ? _r(mainPaid/mainAlloc*100) : 0;

    const grandAlloc = sum(md, r => _n(r[C2.ALLOC_TOTAL]));
    const grandPaid  = sum(md, tp);

    step = 'read targets (DS3_Targets)';
    const tgt = _getTarget(ss.getSheetByName('DS3_Targets'));
    const tpct = tgt ? _n(tgt.pct) : 0;

    return {
      success: true,
      step: 'ok',
      ms: Date.now() - ms0,
      fiscalYear: fy,
      availableYears,
      counts: { md: md.length, wA: wA.length, wB: wB.length, wC: wC.length, wD: wD.length },
      summary: { mainAlloc, mainPaid, paidPct, targetPct: tpct, targetMonth: tgt ? tgt.month : '-', grandAlloc, grandPaid },
      missing
    };
  } catch (e) {
    return {
      success: false,
      step,
      message: e.message || String(e),
      stack: e.stack,
      ms: Date.now() - ms0
    };
  }
}
function getSourceData(){
  try{
    const ss   = _ss();
    const uniq = arr => [...new Set(arr.filter(Boolean).map(v => String(v).trim()))];
    const d = ss.getSheetByName('source').getDataRange().getValues().slice(1);

    // budgetTypes: ดึงจาก CONFIG.WALLET_META (A–F) แทนคอลัมน์ source ที่อาจว่าง
    const budgetTypes = Object.entries(CONFIG.WALLET_META)
      .filter(([k]) => k !== 'X')
      .map(([k, v]) => `${k} — ${v.label}`);

    // budgetCodes: ดึงจาก DS2 ตาม fiscal year ปัจจุบัน — ส่งเป็น {value, label} เพื่อ dropdown แสดงชื่อแผนงาน
    const ds2 = ss.getSheetByName('DS2_MasterBudget');
    const budgetCodes = []; // [{value: code, label: "planName (code)"}]
    if (ds2 && ds2.getLastRow() > 1) {
      const d2 = ds2.getDataRange().getValues().slice(1);
      const seen = new Set();
      d2.forEach(r => {
        if (!r[C2.ID]) return;
        const fy = Number(r[C2.FISCAL_YEAR]);
        if (fy && fy !== CONFIG.FISCAL_YEAR) return;
        const code = _normCode(r[C2.CODE]);
        if (!code || seen.has(code)) return;
        seen.add(code);
        const plan = String(r[C2.PLAN] || '').trim();
        const label = plan || code;
        budgetCodes.push({ value: code, label });
      });
    }

    return {
      success: true,
      adminLines:  uniq(d.map(r=>r[0])),
      budgetPools: uniq(d.map(r=>r[1])),
      walletTypes: uniq(d.map(r=>r[2])),
      actStatuses: uniq(d.map(r=>r[3])),
      groups:      uniq(d.map(r=>r[4])),
      projects:    uniq(d.map(r=>r[5])),
      budgetCodes,
      budgetTypes,
      sourceRows: d.map(r=>({
        adminLine:  String(r[0]||'').trim(),
        budgetPool: String(r[1]||'').trim(),
        walletType: String(r[2]||'').trim(),
        actStatus:  String(r[3]||'').trim(),
        group:      String(r[4]||'').trim(),
        project:    String(r[5]||'').trim(),
        budgetCode: String(r[6]||'').trim(),
        budgetType: String(r[7]||'').trim(),
      })).filter(x=>x.project||x.budgetCode||x.budgetType)
    };
  }
  catch(e){ return { success:false, message: e.message }; }
}
// ─── Admin Line Mappings (source A+E+F) ───────────────────────────────────────

function getAdminLineMappings() {
  try {
    const sh = _ss().getSheetByName('source');
    if (!sh) return { success: false, message: 'ไม่พบ source sheet' };
    const rows = sh.getDataRange().getValues().slice(1);
    const result = [];
    rows.forEach((r, i) => {
      const adminLine = String(r[0] || '').trim();
      const group     = String(r[4] || '').trim();
      const project   = String(r[5] || '').trim();
      if (adminLine && group) {
        result.push({ rowIndex: i + 2, adminLine, group, project });
      }
    });
    return { success: true, rows: result };
  } catch(e) { return { success: false, message: e.message }; }
}

function saveAdminLineMapping(payload) {
  try {
    const sh = _ss().getSheetByName('source');
    if (!sh) return { success: false, message: 'ไม่พบ source sheet' };
    const adminLine = String(payload.adminLine || '').trim();
    const group     = String(payload.group     || '').trim();
    const project   = String(payload.project   || '').trim();
    if (!adminLine) return { success: false, message: 'กรุณาระบุสายบริหาร' };

    const rowIndex = Number(payload.rowIndex || 0);
    if (rowIndex >= 2) {
      // update — เขียนเฉพาะ col A, E, F คงคอลัมน์อื่นไว้
      const existing = sh.getRange(rowIndex, 1, 1, 8).getValues()[0];
      existing[0] = adminLine;
      existing[4] = group;
      existing[5] = project;
      sh.getRange(rowIndex, 1, 1, 8).setValues([existing]);
    } else {
      // append ใหม่
      sh.appendRow([adminLine, '', '', '', group, project, '', '']);
    }
    return { success: true };
  } catch(e) { return { success: false, message: e.message }; }
}

function deleteAdminLineMapping(rowIndex) {
  try {
    const sh = _ss().getSheetByName('source');
    if (!sh) return { success: false, message: 'ไม่พบ source sheet' };
    const ri = Number(rowIndex);
    if (ri < 2) return { success: false, message: 'rowIndex ไม่ถูกต้อง' };
    sh.deleteRow(ri);
    return { success: true };
  } catch(e) { return { success: false, message: e.message }; }
}

// ────────────────────────────────────────────────────────────────────────────
//  ซิงค์ Admin_Line + กลุ่มงาน เข้า DS8_Projects จาก source sheet
// ────────────────────────────────────────────────────────────────────────────
function syncDS8GroupsFromSource(fiscalYear) {
  try {
    const ss    = _ss();
    const srcSh = ss.getSheetByName('source');
    const ds8Sh = ss.getSheetByName('DS8_Projects');
    if (!srcSh) return { success: false, message: 'ไม่พบ source sheet' };
    if (!ds8Sh || ds8Sh.getLastRow() <= 1)
      return { success: true, updated: 0, message: 'ไม่มีข้อมูลใน DS8_Projects' };

    const fy = Number(fiscalYear || CONFIG.FISCAL_YEAR);

    // normalize: ตัด "N." หรือ "N. " นำหน้า แล้ว lowercase + trim
    const _norm = s => String(s || '').replace(/^\d+\.\s*/, '').trim().toLowerCase();

    // สร้าง map จาก source sheet: normalizedName → { adminLine, group }
    const srcRows = srcSh.getDataRange().getValues().slice(1);
    const nameMap = {};
    srcRows.forEach(r => {
      const adminLine = String(r[0] || '').trim();
      const group     = String(r[4] || '').trim();
      const projName  = String(r[5] || '').trim();
      if (adminLine && group && projName) {
        const key = _norm(projName);
        if (key && !nameMap[key]) nameMap[key] = { adminLine, group };
      }
    });

    // อ่าน DS8 ทั้งหมดแล้ว batch-write
    const lastRow = ds8Sh.getLastRow();
    const nCols   = ds8Sh.getLastColumn();
    const data    = ds8Sh.getRange(2, 1, lastRow - 1, nCols).getValues();

    let updated = 0;
    data.forEach((row, i) => {
      if (!row[C8.ID]) return;
      if (Number(row[C8.FISCAL_YEAR]) !== fy) return;
      const key   = _norm(row[C8.NAME]);
      const match = nameMap[key];
      if (!match) return;

      let changed = false;
      if (!String(row[C8.ADMIN_LINE] || '').trim()) {
        data[i][C8.ADMIN_LINE] = match.adminLine;
        changed = true;
      }
      if (!String(row[C8.GROUP] || '').trim()) {
        data[i][C8.GROUP] = match.group;
        changed = true;
      }
      if (changed) updated++;
    });

    if (updated > 0) {
      ds8Sh.getRange(2, 1, data.length, nCols).setValues(data);
    }

    const total = data.filter(r => r[C8.ID] && Number(r[C8.FISCAL_YEAR]) === fy).length;
    _log('SYNC', 'DS8←SOURCE', `fy:${fy} updated:${updated}/${total}`);
    return { success: true, updated, total, message: `อัปเดต ${updated} จาก ${total} โครงการ` };
  } catch(e) {
    _log('SYNC','ERROR',e.message);
    return { success: false, message: e.message };
  }
}

// ─── DS8_Projects (Module 2 foundation) ──────────────────────────────────────

function getProjects(fiscalYear) {
  try {
    const ss = _ss();
    const sh = ss.getSheetByName('DS8_Projects');
    if (!sh || sh.getLastRow() <= 1) return { success: true, rows: [], totalBudget: 0 };
    const fy = Number(fiscalYear || CONFIG.FISCAL_YEAR);
    const rows = sh.getDataRange().getValues().slice(1)
      .filter(r => r[C8.ID] && Number(r[C8.FISCAL_YEAR]) === fy)
      .map(r => ({
        id:          String(r[C8.ID]),
        name:        String(r[C8.NAME]      || ''),
        adminLine:   String(r[C8.ADMIN_LINE]|| ''),
        group:       String(r[C8.GROUP]     || ''),
        wtype:       String(r[C8.WTYPE]     || ''),
        budget:      _n(r[C8.BUDGET]),
        note:        String(r[C8.NOTE]      || ''),
        status:      String(r[C8.STATUS]    || 'ยังไม่เริ่ม'),
        createdAt:   String(r[C8.CREATED_AT]|| ''),
        startMonth:  r[C8.START_MONTH] !== '' && r[C8.START_MONTH] !== null ? Number(r[C8.START_MONTH]) : null,
        meetingDate: String(r[C8.MEETING_DATE] || ''),
        m: [C8.M0,C8.M1,C8.M2,C8.M3,C8.M4,C8.M5,C8.M6,C8.M7,C8.M8,C8.M9,C8.M10,C8.M11].map(c => _n(r[c])),
      }));
    const totalBudget = _r(rows.reduce((s, r) => s + r.budget, 0));
    return { success: true, rows, totalBudget, count: rows.length };
  } catch(e) { return { success: false, message: e.message }; }
}

function saveProject(payload) {
  try {
    const ss = _ss();
    let sh = ss.getSheetByName('DS8_Projects');
    if (!sh) setupSheets();
    sh = ss.getSheetByName('DS8_Projects');

    const fy         = Number(payload.fiscalYear || CONFIG.FISCAL_YEAR);
    const name       = String(payload.name       || '').trim();
    const adminLine  = String(payload.adminLine  || '').trim();
    const group      = String(payload.group      || '').trim();
    const wtype      = String(payload.wtype      || 'A').trim().toUpperCase();
    const budget     = _n(payload.budget);
    const note       = String(payload.note       || '').trim();
    const status     = String(payload.status     || 'ยังไม่เริ่ม').trim();
    const startMonth = (payload.startMonth !== null && payload.startMonth !== undefined && payload.startMonth !== '')
                       ? Number(payload.startMonth) : '';
    const meetingDate = String(payload.meetingDate || '').trim();
    const months      = Array.isArray(payload.m) ? payload.m.map(v => _n(v)) : Array(12).fill(0);

    if (!name) return { success: false, message: 'กรุณาระบุชื่อโครงการ' };

    const id = String(payload.id || '').trim();
    if (id) {
      // update
      const data = sh.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][C8.ID]) !== id) continue;
        const row = i + 1;
        sh.getRange(row, C8.NAME        + 1).setValue(name);
        sh.getRange(row, C8.ADMIN_LINE  + 1).setValue(adminLine);
        sh.getRange(row, C8.GROUP       + 1).setValue(group);
        sh.getRange(row, C8.WTYPE       + 1).setValue(wtype);
        sh.getRange(row, C8.BUDGET      + 1).setValue(budget);
        sh.getRange(row, C8.NOTE        + 1).setValue(note);
        sh.getRange(row, C8.STATUS      + 1).setValue(status);
        sh.getRange(row, C8.START_MONTH + 1).setValue(startMonth);
        sh.getRange(row, C8.MEETING_DATE+ 1).setValue(meetingDate);
        // monthly budgets M0–M11
        months.forEach((v, mi) => sh.getRange(row, C8.M0 + mi + 1).setValue(v));
        return { success: true, id };
      }
      return { success: false, message: 'ไม่พบโครงการ ' + id };
    } else {
      // insert — 24 columns
      const newId = 'P' + fy + '_' + String(Date.now()).slice(-5);
      sh.appendRow([newId, fy, name, adminLine, group, wtype, budget, note, status, _now(),
                    startMonth, meetingDate, ...months]);
      return { success: true, id: newId };
    }
  } catch(e) { return { success: false, message: e.message }; }
}

function deleteProject(projectId) {
  try {
    const sh = _ss().getSheetByName('DS8_Projects');
    if (!sh) return { success: false, message: 'ไม่พบ DS8_Projects' };
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][C8.ID]) !== String(projectId)) continue;
      sh.deleteRow(i + 1);
      return { success: true };
    }
    return { success: false, message: 'ไม่พบโครงการ ' + projectId };
  } catch(e) { return { success: false, message: e.message }; }
}

// ─── DS9_Activities (กิจกรรมภายในโครงการ) ────────────────────────────────────

function getActivities(projectId) {
  try {
    const ss = _ss();
    let sh = ss.getSheetByName('DS9_Activities');
    if (!sh) { setupSheets(); sh = ss.getSheetByName('DS9_Activities'); }
    if (!sh || sh.getLastRow() <= 1) return { success: true, rows: [] };
    const pid = String(projectId || '').trim();
    const rows = sh.getDataRange().getValues().slice(1)
      .filter(r => r[C9.ID] && (!pid || String(r[C9.PROJECT_ID]) === pid))
      .map((r, i) => ({
        id:           String(r[C9.ID]),
        projectId:    String(r[C9.PROJECT_ID] || ''),
        fiscalYear:   Number(r[C9.FISCAL_YEAR] || 0),
        name:         String(r[C9.NAME]        || ''),
        month:        r[C9.MONTH] !== '' && r[C9.MONTH] !== null ? Number(r[C9.MONTH]) : null,
        meetingDate:  String(r[C9.MEETING_DATE]|| ''),
        budget:       _n(r[C9.BUDGET]),
        status:       String(r[C9.STATUS]      || 'แผน'),
        note:         String(r[C9.NOTE]        || ''),
        origMonth:    r[C9.ORIG_MONTH] !== '' && r[C9.ORIG_MONTH] !== null ? Number(r[C9.ORIG_MONTH]) : null,
        changeReason: String(r[C9.CHANGE_REASON]|| ''),
        createdAt:    String(r[C9.CREATED_AT]  || ''),
        updatedAt:    String(r[C9.UPDATED_AT]  || ''),
      }));
    return { success: true, rows, count: rows.length };
  } catch(e) { return { success: false, message: e.message }; }
}

function saveActivity(payload) {
  try {
    const ss = _ss();
    let sh = ss.getSheetByName('DS9_Activities');
    if (!sh) { setupSheets(); sh = ss.getSheetByName('DS9_Activities'); }

    const projectId   = String(payload.projectId   || '').trim();
    const fy          = Number(payload.fiscalYear   || CONFIG.FISCAL_YEAR);
    const name        = String(payload.name         || '').trim();
    const month       = (payload.month !== null && payload.month !== undefined && payload.month !== '')
                        ? Number(payload.month) : '';
    const meetingDate = String(payload.meetingDate  || '').trim();
    const budget      = _n(payload.budget);
    const status      = String(payload.status       || 'แผน').trim();
    const note        = String(payload.note         || '').trim();
    const changeReason= String(payload.changeReason || '').trim();

    if (!projectId) return { success: false, message: 'ไม่พบ Project ID' };
    if (!name)      return { success: false, message: 'กรุณาระบุชื่อกิจกรรม' };

    const id = String(payload.id || '').trim();
    const now = _now();

    if (id) {
      // update
      const data = sh.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][C9.ID]) !== id) continue;
        const row = i + 1;
        const origMonth = data[i][C9.MONTH];
        // ถ้าเดือนเปลี่ยน ให้บันทึก origMonth และ changeReason
        const newOrigMonth = (month !== '' && origMonth !== '' && month !== origMonth && origMonth !== null)
                              ? origMonth : data[i][C9.ORIG_MONTH];
        sh.getRange(row, C9.NAME         + 1).setValue(name);
        sh.getRange(row, C9.MONTH        + 1).setValue(month);
        sh.getRange(row, C9.MEETING_DATE + 1).setValue(meetingDate);
        sh.getRange(row, C9.BUDGET       + 1).setValue(budget);
        sh.getRange(row, C9.STATUS       + 1).setValue(status);
        sh.getRange(row, C9.NOTE         + 1).setValue(note);
        sh.getRange(row, C9.ORIG_MONTH   + 1).setValue(newOrigMonth !== '' ? newOrigMonth : '');
        sh.getRange(row, C9.CHANGE_REASON+ 1).setValue(changeReason);
        sh.getRange(row, C9.UPDATED_AT   + 1).setValue(now);
        return { success: true, id };
      }
      return { success: false, message: 'ไม่พบกิจกรรม ' + id };
    } else {
      // insert
      const newId = 'A' + fy + '_' + String(Date.now()).slice(-6);
      sh.appendRow([newId, projectId, fy, name, month, meetingDate, budget,
                    status, note, '', '', now, now]);
      return { success: true, id: newId };
    }
  } catch(e) { return { success: false, message: e.message }; }
}

function deleteActivity(actId) {
  try {
    const sh = _ss().getSheetByName('DS9_Activities');
    if (!sh) return { success: false, message: 'ไม่พบ DS9_Activities' };
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][C9.ID]) !== String(actId)) continue;
      sh.deleteRow(i + 1);
      return { success: true };
    }
    return { success: false, message: 'ไม่พบกิจกรรม ' + actId };
  } catch(e) { return { success: false, message: e.message }; }
}

// คืน activities ทุกตัวของ fiscal year (สำหรับ Gantt)
function getActivitiesByYear(fiscalYear) {
  try {
    const ss = _ss();
    let sh = ss.getSheetByName('DS9_Activities');
    if (!sh) return { success: true, rows: [] };
    if (sh.getLastRow() <= 1) return { success: true, rows: [] };
    const fy = Number(fiscalYear || CONFIG.FISCAL_YEAR);
    const rows = sh.getDataRange().getValues().slice(1)
      .filter(r => r[C9.ID] && Number(r[C9.FISCAL_YEAR]) === fy)
      .map(r => ({
        id:          String(r[C9.ID]),
        projectId:   String(r[C9.PROJECT_ID] || ''),
        name:        String(r[C9.NAME]        || ''),
        month:       r[C9.MONTH] !== '' && r[C9.MONTH] !== null ? Number(r[C9.MONTH]) : null,
        meetingDate: String(r[C9.MEETING_DATE]|| ''),
        budget:      _n(r[C9.BUDGET]),
        status:      String(r[C9.STATUS]      || 'แผน'),
        origMonth:   r[C9.ORIG_MONTH] !== '' && r[C9.ORIG_MONTH] !== null ? Number(r[C9.ORIG_MONTH]) : null,
        changeReason:String(r[C9.CHANGE_REASON]|| ''),
      }));
    return { success: true, rows };
  } catch(e) { return { success: false, message: e.message }; }
}

// ─── DS6 summary grouped by project name (สำหรับ link DS9↔DS6) ───────────────
function getDS6SummaryByProject(fiscalYear) {
  try {
    const ds6 = _ss().getSheetByName('DS6_Activities');
    if (!ds6 || ds6.getLastRow() <= 1) return { success: true, byProject: {} };
    const fy = Number(fiscalYear || CONFIG.FISCAL_YEAR);
    const byProject = {};
    ds6.getDataRange().getValues().slice(1).forEach(r => {
      if (!r[C6.ID] || _isTrue(r[C6.IS_DELETED])) return;
      if (_fiscalYearFromDateValue(r[C6.DATE]) !== fy) return;
      const proj = String(r[C6.PROJECT] || '').trim();
      if (!proj) return;
      if (!byProject[proj]) byProject[proj] = { budget: 0, paid: 0, count: 0 };
      byProject[proj].budget += _n(r[C6.BUDGET]);
      byProject[proj].paid   += _n(r[C6.PAID]);
      byProject[proj].count++;
    });
    return { success: true, byProject };
  } catch(e) { return { success: false, message: e.message }; }
}

// ─────────────────────────────────────────────────────────────────────────────
function setInitialBalance(budgetId,ip,ipo,idate){
  try{const m=_ss().getSheetByName('DS2_MasterBudget'),d=m.getDataRange().getValues();
  for(let i=1;i<d.length;i++){if(d[i][C2.ID]===budgetId){
    m.getRange(i+1,C2.INIT_PAID+1,1,3).setValues([[_n(ip),_n(ipo),idate||_now()]]);
    _log('MASTER','SET_INITIAL',budgetId); return{success:true};}}
  return{success:false,message:'ไม่พบ: '+budgetId};}
  catch(e){return{success:false,message:e.message};}
}
function manualRecalcAdminAlloc(fiscalYear){
  try{ _recalcAdminAlloc(fiscalYear); _syncActivitiesToDS5(fiscalYear);
  return{success:true,message:'Recalc DS5 สำเร็จ'};}
  catch(e){return{success:false,message:e.message};}
}

function autoClassifyWalletTypes(fiscalYear, onlyPending) {
  try {
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const onlyPendingRows = (onlyPending === true || String(onlyPending).toLowerCase() === 'true');
    const sh = _ss().getSheetByName('DS2_MasterBudget');
    if (!sh) return { success:false, message:'ไม่พบ DS2_MasterBudget' };

    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return { success:false, message:'ยังไม่มีข้อมูลใน DS2' };

    let updated = 0;
    const byType = { A:0, B:0, C:0, D:0 };
    const now = _now();

    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[C2.ID]) continue;
      const rowFY = Number(r[C2.FISCAL_YEAR]) || CONFIG.FISCAL_YEAR;
      if (rowFY !== fy) continue;

      const status = String(r[C2.STATUS] || '').trim();
      if (onlyPendingRows && status && status !== 'ใหม่-รอ classify') continue;

      const plan = String(r[C2.PLAN] || '').trim();
      const code = String(r[C2.CODE] || '').trim();
      const cls = _classifyWalletByPlanAndCode(plan, code);

      sh.getRange(i + 1, C2.WTYPE + 1).setValue(cls.wtype);
      sh.getRange(i + 1, C2.BTYPE + 1).setValue(cls.btype);
      sh.getRange(i + 1, C2.STATUS + 1).setValue('Active');
      sh.getRange(i + 1, C2.UPDATED + 1).setValue(now);
      updated++;
      byType[cls.wtype] = (byType[cls.wtype] || 0) + 1;
    }

    if (updated > 0) _recalcAdminAlloc(fy);

    const msg = `ปีงบ ${fy} | จัดประเภทแล้ว ${updated} รายการ (A:${byType.A} B:${byType.B} C:${byType.C} D:${byType.D})`;
    _log('CLASSIFY', 'AUTO_WTYPE', msg, updated);
    return { success:true, updated, byType, message: msg };
  } catch (e) {
    return { success:false, message:e.message || String(e) };
  }
}

// ─── Reset (ล้างข้อมูลเฉพาะปีงบ) ─────────────────────────────
/**
 * ล้างข้อมูลเฉพาะปีงบ (เช่น 2569) โดยไม่ลบ header/โครงสร้างชีท
 * - DS2: ลบแถวปีงบที่ระบุ (อิง Fiscal_Year หรือเดาจาก ID)
 * - DS1: ลบธุรกรรมที่วันที่อยู่ในปีงบที่ระบุ
 * - DS5: ลบสรุปสายบริหารของปีงบนั้น
 * - DS6: ลบกิจกรรม/กันเงินที่วันที่อยู่ในปีงบนั้น (รวม soft-deleted ด้วย)
 * - DS7: ลบประวัติรอบโอนของปีงบนั้น
 * - DS0: ล้าง staging ทั้งหมด (เพื่อเริ่มนำเข้าใหม่)
 */
function resetFiscalYear(fiscalYear) {
  const t0 = Date.now();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    if (!Number.isFinite(fy) || fy < 2500) return { success:false, message:'ปีงบประมาณไม่ถูกต้อง' };

    const ss = _ss();
    // ensure required sheets exist (รวม DS7)
    setupSheets();

    const counts = {};
    const _clearAllRowsExceptHeader = (sh) => {
      if (!sh) return 0;
      const last = sh.getLastRow();
      if (last <= 1) return 0;
      sh.deleteRows(2, last - 1);
      return last - 1;
    };
    const _rewriteKeepRows = (sh, keepRows /* includes header */) => {
      if (!sh) return 0;
      const last = sh.getLastRow();
      const deleted = Math.max(0, last - 1) - Math.max(0, keepRows.length - 1);
      sh.clearContents();
      sh.getRange(1, 1, 1, keepRows[0].length).setValues([keepRows[0]]);
      if (keepRows.length > 1) {
        sh.getRange(2, 1, keepRows.length - 1, keepRows[0].length).setValues(keepRows.slice(1));
      }
      return deleted;
    };

    // DS0: staging (ล้างทั้งหมด)
    counts.DS0_Staging = _clearAllRowsExceptHeader(ss.getSheetByName('DS0_Staging'));

    // DS2: master budget (ลบเฉพาะ FY)
    {
      const sh = ss.getSheetByName('DS2_MasterBudget');
      const data = sh.getDataRange().getValues();
      const hdr = data[0];
      const _rowFY = (r) => {
        const v = r[C2.FISCAL_YEAR];
        if (v && Number(v) > 2560) return Number(v);
        const idMatch = String(r[C2.ID] || '').match(/B(25\d{2})/);
        if (idMatch) return Number(idMatch[1]);
        return CONFIG.FISCAL_YEAR;
      };
      const keep = [hdr, ...data.slice(1).filter(r => !r[C2.ID] || _rowFY(r) !== fy)];
      counts.DS2_MasterBudget = _rewriteKeepRows(sh, keep);
    }

    // DS1: transactions (ลบตามปีงบจากคอลัมน์วันที่)
    {
      const sh = ss.getSheetByName('DS1_Transactions');
      const data = sh.getDataRange().getValues();
      const hdr = data[0];
      const keep = [hdr, ...data.slice(1).filter(r => {
        if (!r[0]) return true;
        const txFy = _fiscalYearFromDateValue(r[1]);
        return txFy !== fy;
      })];
      counts.DS1_Transactions = _rewriteKeepRows(sh, keep);
    }

    // DS5: admin alloc (ลบตามคอลัมน์ปีงบ)
    {
      const sh = ss.getSheetByName('DS5_AdminAlloc');
      const data = sh.getDataRange().getValues();
      const hdr = data[0];
      const keep = [hdr, ...data.slice(1).filter(r => {
        if (!r[C5.ID]) return true;
        return Number(r[C5.YEAR]) !== fy;
      })];
      counts.DS5_AdminAlloc = _rewriteKeepRows(sh, keep);
    }

    // DS6: activities (ลบตามปีงบจากคอลัมน์วันที่)
    {
      const sh = ss.getSheetByName('DS6_Activities');
      _ensureDs6Schema(sh);
      const data = sh.getDataRange().getValues();
      const hdr = data[0];
      const keep = [hdr, ...data.slice(1).filter(r => {
        if (!r[C6.ID]) return true;
        const actFy = _fiscalYearFromDateValue(r[C6.DATE]);
        return actFy !== fy;
      })];
      counts.DS6_Activities = _rewriteKeepRows(sh, keep);
    }

    // DS7: transfers (ลบตาม Fiscal_Year)
    {
      const sh = ss.getSheetByName('DS7_Transfers');
      const data = sh.getDataRange().getValues();
      const hdr = data[0];
      const keep = [hdr, ...data.slice(1).filter(r => {
        if (!r[0]) return true;
        return Number(r[1]) !== fy;
      })];
      counts.DS7_Transfers = _rewriteKeepRows(sh, keep);
    }

    SpreadsheetApp.flush();
    _log('RESET', 'RESET_FY', `FY ${fy} | ${JSON.stringify(counts)}`, 1, Date.now() - t0);
    return {
      success:true,
      fiscalYear: fy,
      deleted: counts,
      message: `✅ ล้างข้อมูลเฉพาะปีงบ ${fy} สำเร็จ`,
    };
  } catch (e) {
    _log('RESET', 'RESET_FY_ERROR', e.message, 0, Date.now() - t0, 'ERROR');
    return { success:false, message:e.message };
  } finally {
    lock.releaseLock();
  }
}

/** Shortcut สำหรับปีงบ 2569 */
function resetFY2569() {
  return resetFiscalYear(2569);
}

function backfillFiscalYear() {
  const ss     = _ss();
  const master = ss.getSheetByName('DS2_MasterBudget');
  const data   = master.getDataRange().getValues();

  const hdr = data[0];
  if (hdr.length < 25 || hdr[24] !== 'Fiscal_Year') {
    master.getRange(1, 25).setValue('Fiscal_Year')
      .setBackground('#1a3a5c').setFontColor('#fff').setFontWeight('bold');
  }

  let filled = 0;
  for (let i = 1; i < data.length; i++) {
    const row    = data[i];
    const id     = String(row[0] || '');
    const curFY  = row[24];

    if (curFY && Number(curFY) > 2560) continue;

    const m = id.match(/B(25\d{2})/);
    if (m) {
      master.getRange(i+1, 25).setValue(Number(m[1]));
      filled++;
      continue;
    }
    master.getRange(i+1, 25).setValue(CONFIG.FISCAL_YEAR);
    filled++;
  }

  ss.toast(`✅ backfill Fiscal_Year สำเร็จ: ${filled} แถว`, 'backfillFiscalYear', 4);
  _log('SETUP','BACKFILL_FY',`filled ${filled} rows`);
  return { success:true, filled };
}

function cleanupTestRows() {
  const ss = _ss();
  const ds2 = ss.getSheetByName('DS2_MasterBudget');
  const data = ds2.getDataRange().getValues();
  let deleted = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    const id = String(data[i][0] || '');
    if (id && !id.match(/^B25\d{2}-/)) {
      ds2.deleteRow(i + 1);
      deleted++;
    }
  }
  ss.toast(`ลบ test rows: ${deleted} แถว`, 'Cleanup', 3);
  return { success: true, deleted };
}

// ─── GF_Input ──────────────────────────────
function getGFInputRows(fiscalYear) {
  try {
    const ss     = _ss();
    const master = ss.getSheetByName('DS2_MasterBudget');
    if (!master) return { success: false, message: 'ไม่พบ DS2_MasterBudget' };

    const md  = master.getDataRange().getValues().slice(1);
    const fy  = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;

    let gfMap = {};
    try {
      const extId = '1SqOD16854k0z_StQyFAY17gJMye4xMG24S_lC0g9dFE';
      const extSs = SpreadsheetApp.openById(extId);
      const gfSh  = extSs.getSheetByName('GF_Input');
      if (gfSh) {
        const gfData = gfSh.getDataRange().getDisplayValues();
        for (let i = 10; i < gfData.length; i++) {
          const code = String(gfData[i][2] || '').trim();
          if (!code) continue;
          gfMap[code] = {
            poYest:    parseFloat(String(gfData[i][4] || '0').replace(/,/g, '')) || 0,
            paidYest:  parseFloat(String(gfData[i][5] || '0').replace(/,/g, '')) || 0,
            gfRowIndex: i + 1,
          };
        }
      }
    } catch (_) { }

    const result = [];
    let seq = 1;

    md.forEach((r, idx) => {
      if (!r[C2.ID]) return;
      const include = String(r[C2.INCLUDE] || '').toUpperCase();
      if (include === 'FALSE') return;
      const rowFY = r[C2.FISCAL_YEAR] ? Number(r[C2.FISCAL_YEAR]) : fy;
      if (rowFY !== fy) return;
      if (_n(r[C2.ALLOC_TOTAL]) === 0) return;

      const code = String(r[C2.CODE] || '').trim();
      const plan = String(r[C2.PLAN] || '').trim();
      const alloc    = _n(r[C2.ALLOC_TOTAL]);
      const poNow    = _n(r[C2.PO]);
      const paidNow  = _n(r[C2.PAID]);
      const remain   = _n(r[C2.REMAIN]);
      const gf       = gfMap[code] || {};

      result.push({
        rowIndex:   idx + 2,
        gfRowIndex: gf.gfRowIndex || 0,
        seq:        String(seq++),
        plan,
        code,
        wtype:    String(r[C2.WTYPE] || 'A'),
        alloc,
        poYest:   gf.poYest   || 0,
        paidYest: gf.paidYest || 0,
        poNow,
        paidNow,
        remain,
      });
    });

    return { success: true, rows: result, count: result.length };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function saveGFInput(updates) {
  const t0   = Date.now();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!updates || !updates.length) return { success: false, message: 'ไม่มีข้อมูล' };

    let gfSh = null;
    try {
      const extId = '1SqOD16854k0z_StQyFAY17gJMye4xMG24S_lC0g9dFE';
      const extSs = SpreadsheetApp.openById(extId);
      gfSh = extSs.getSheetByName('GF_Input');
    } catch (_) { }

    const ss     = _ss();
    const master = ss.getSheetByName('DS2_MasterBudget');
    const md     = master.getDataRange().getValues();
    const lastDs2Row = md.length;

    let updatedGF = 0, updatedDS2 = 0;
    const now = _now();

    updates.forEach(u => {
      const gfRi   = Number(u.gfRowIndex || 0);
      const code   = String(u.code || '').trim();
      const poNow  = _n(u.poNow);
      const paidNow= _n(u.paidNow);

      // อัปเดต GF_Input Sheet (external)
      if (gfSh && gfRi > 0) {
        gfSh.getRange(gfRi, 8).setValue(poNow);
        gfSh.getRange(gfRi, 9).setValue(paidNow);
        updatedGF++;
      }

      // อัปเดต DS2 — ใช้ rowIndex โดยตรง (ป้องกัน code ซ้ำ/ผิดคู่)
      const ds2Row = Number(u.rowIndex || 0);
      if (ds2Row >= 2 && ds2Row <= lastDs2Row) {
        const row = md[ds2Row - 1];
        // ยืนยัน code ตรงกัน ก่อนเขียน
        const rowCode = String(row[C2.CODE] || '').trim();
        if (rowCode !== code) {
          _log('GF_INPUT','MISMATCH',`row ${ds2Row}: expect ${code} got ${rowCode}`,0,0,'WARN');
          return; // ข้ามแถวนี้ ถ้า code ไม่ตรง
        }
        const allocTotal = _n(row[C2.ALLOC_TOTAL]);
        const newRemain  = Math.max(0, allocTotal - poNow - paidNow);
        master.getRange(ds2Row, C2.PO     + 1).setValue(poNow);
        master.getRange(ds2Row, C2.PAID   + 1).setValue(paidNow);
        master.getRange(ds2Row, C2.REMAIN + 1).setValue(newRemain);
        master.getRange(ds2Row, C2.UPDATED + 1).setValue(now);
        updatedDS2++;
      }
    });

    _log('GF_INPUT', 'SAVE', `DS2: ${updatedDS2} | GF_Sheet: ${updatedGF}`, updates.length, Date.now() - t0);
    return {
      success: true,
      updatedGF,
      updatedDS2,
      message: `✅ อัปเดต DS2: ${updatedDS2} แถว${updatedGF > 0 ? ` | GF_Input Sheet: ${updatedGF} แถว` : ''}`
    };
  } catch (e) {
    _log('GF_INPUT', 'SAVE_ERROR', e.message, 0, Date.now() - t0, 'ERROR');
    return { success: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

// ─── Helpers ──────────────────────────────────
function _ss() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}
function _now(){return Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm:ss');}
function _n(v){const x=parseFloat(String(v).replace(/,/g,''));return isNaN(x)?0:x;}
function _r(v){return Math.round(v*100)/100;}

/**
 * Normalize budget code: แปลง scientific notation → integer string
 * e.g. "2.10093E+19" → "21009322044002000000"
 * ใช้ได้จากทุก function (top-level)
 */
function _normCode(v) {
  const s = String(v || '').replace(/\s/g, '').trim();
  if (!s) return s;
  if (/^\d+\.?\d*[Ee][+\-]?\d+$/.test(s)) {
    try { return String(BigInt(Math.round(parseFloat(s)))); } catch(_) { return s; }
  }
  return s;
}
function _grp(arr,idx){return arr.reduce((a,r)=>{const k=r[idx]||'';if(!a[k])a[k]=[];a[k].push(r);return a;},{});}
function _defaultAdminLineMap() {
  // อ่าน group→adminLine จาก source sheet (col E→A)
  // ถ้าอ่านไม่ได้ fallback hardcode
  try {
    const sh = _ss().getSheetByName('source');
    if (sh && sh.getLastRow() > 1) {
      const rows = sh.getDataRange().getValues().slice(1);
      const map = {};
      rows.forEach(r => {
        const adminLine = String(r[0] || '').trim();
        const group     = String(r[4] || '').trim();
        if (group && adminLine) map[group] = adminLine;
      });
      if (Object.keys(map).length > 0) return map;
    }
  } catch(_) {}
  // fallback
  return {
    'แม่และเด็ก':'รองนิพนธ์', 'วัยเรียน':'รองนิพนธ์',
    'วัยรุ่น':'รองนิพนธ์', 'วัยทำงาน':'รองนิพนธ์',
    'สูงอายุ':'รองนิพนธ์',
    'สิ่งแวดล้อม':'รองศุภลักษณ์','สุขาภิบาล':'รองศุภลักษณ์',
    'LM':'รองสิริรัตน์','ทันต':'รองสิริรัตน์',
    'กลุ่มวิชาการ วิจัย':'รองชัยยะ/ผช.',
    'อำนวยการ':'รองชัยยะ/ผช.',
    'ผู้อำนวยการศูนย์':'นโยบาย ผอ.',
  };
}
function _classifyWalletByPlanAndCode(planName, budgetCode) {
  const plan = String(planName || '').toLowerCase();
  const code = String(budgetCode || '').replace(/\s/g, '').toLowerCase();

  // E: งบบุคลากร
  if (plan.includes('งบบุคลากร') ||
      plan.includes('เงินเดือน') ||
      plan.includes('พตส.') ||
      plan.includes('ไม่ทำเวชฯ') ||
      plan.includes('ค่าตอบแทนพนักงานราชการ')) {
    return { wtype:'E', btype:'งบบุคลากร' };
  }

  // F: งบลงทุน (ครุภัณฑ์/สิ่งก่อสร้าง)
  if (plan.includes('งบลงทุน') ||
      plan.includes('ครุภัณฑ์') ||
      plan.includes('สิ่งก่อสร้าง') ||
      plan.includes('แอร์') ||
      plan.includes('ตู้เย็น') ||
      plan.includes('สนาม') ||
      plan.includes('ซ่อม') ||
      plan.includes('เตียง') ||
      plan.includes('เครื่อง')) {
    return { wtype:'F', btype:'งบลงทุน' };
  }

  // D: ค่าใช้จ่ายตามสิทธิ์ / เบิกแทนกัน
  if (plan.includes('ค่าใช้จ่ายขั้นต่ำตามสิทธิ์') ||
      plan.includes('ค่าใช้จ่ายตามสิทธิ์') ||
      plan.includes('เบิกแทน') ||
      plan.includes('แทนกัน') ||
      plan.includes('เงินแทนกัน')) {
    return { wtype:'D', btype:'ค่าใช้จ่ายตามสิทธิ์' };
  }

  // C: ค่าใช้จ่ายบริหาร/พื้นฐาน (30%)
  const basicKeys = [
    'ค่าใช้จ่ายพื้นฐาน','ค่าน้ำมันเชื้อเพลิง',
    'ค่าใช้สอยหน่วยงาน','ค่าใช้สอยกลุ่มสื่อสาร',
    'ค่าวัสดุกลุ่มอำนวยการ','ค่าวัสดุกลุ่มสื่อสาร','ค่าสาธารณูปโภค',
    'ค่าไฟฟ้า','ค่าน้ำประปา','ค่าโทรศัพท์','ค่าอินเทอร์เน็ต',
  ];
  if (basicKeys.some(k => plan.includes(k))) {
    return { wtype:'C', btype:'ค่าใช้จ่ายบริหาร/พื้นฐาน' };
  }

  // B: ขับเคลื่อนนโยบายเร่งด่วน/ชาติ (20%)
  const policyKeys = [
    'นโยบายกระทรวง','นโยบายกรมอนามัย','นโยบายผู้อำนวยการ',
    'เร่งด่วน','ระดับชาติ','healthy workplace','g&ch',
    'ขับเคลื่อนคุณธรรม','ขับเคลื่อนhealthy',
    'ภารกิจสร้างความรอบรู้','ภารกิจสนับสนุนและพัฒนาองค์กร',
  ];
  if (policyKeys.some(k => plan.includes(k))) {
    return { wtype:'B', btype:'ขับเคลื่อนนโยบาย' };
  }

  // A: ขับเคลื่อนยุทธศาสตร์กรมอนามัย (50%) — default ของงบดำเนินงาน
  const drivingKeys = [
    'กลุ่มอนามัยแม่และเด็ก','กลุ่มอนามัยวัยรุ่น','กลุ่มอนามัยวัยทำงาน',
    'กลุ่มอนามัยผู้สูงอายุ','กลุ่มอนามัยอนามัยสิ่งแวดล้อม',
    'กลุ่มประเมินผลกระทบ','ขับเคลื่อนยุทธ','ภารกิจสนับสนุนวิชาการ',
    'วัยเรียน','วัยทำงาน','ผู้สูงอายุ','แม่และเด็ก',
  ];
  if (drivingKeys.some(k => plan.includes(k))) {
    return { wtype:'A', btype:'ขับเคลื่อนยุทธศาสตร์' };
  }

  // ตรวจสอบกรณีพิเศษอื่นๆ ที่อาจจะเข้ามา (งบลงทุน/ครุภัณฑ์ = Type C)
  if (plan.includes('งบลงทุน') ||
      plan.includes('ครุภัณฑ์') ||
      plan.includes('สิ่งก่อสร้าง') ||
      plan.includes('แอร์') ||
      plan.includes('ตู้เย็น') ||
      plan.includes('สนาม') ||
      plan.includes('ซ่อม') ||
      plan.includes('เตียง') ||
      plan.includes('เครื่อง')) {
    return { wtype:'C', btype:'งบลงทุน' };
  }

  // X: ไม่นับ/ยกเว้น
  if (plan.includes('เงินนอกงบประมาณ')) {
    return { wtype:'X', btype:'ไม่นำมาคิด' };
  }

  // default: A ขับเคลื่อนยุทธศาสตร์
  return { wtype:'A', btype:'ขับเคลื่อนยุทธศาสตร์' };
}
function _isTrue(v) {
  return String(v || '').toUpperCase() === 'TRUE';
}
function _ensureDs6Schema(ds6) {
  if (!ds6) return;
  const requiredHeaders = [
    'Act_ID','วันที่','กลุ่มงาน','Admin_Line',
    'กิจกรรม','งบประมาณ','เบิกจ่าย','สถานะ','ประเภทงบ',
    'โครงการ','รหัสงบประมาณ',
    'Is_Deleted','Deleted_At','Deleted_By','Delete_Reason',
    'ผู้รับผิดชอบ','Wallet_Type','ระยะเวลา',
  ];
  const needCols = requiredHeaders.length;
  const curCols = ds6.getLastColumn();
  if (curCols < needCols) {
    ds6.insertColumnsAfter(curCols, needCols - curCols);
  }
  const hdr = ds6.getRange(1, 1, 1, needCols).getValues()[0];
  let changed = false;
  for (let i=0; i<needCols; i++) {
    if (String(hdr[i] || '') !== requiredHeaders[i]) {
      hdr[i] = requiredHeaders[i];
      changed = true;
    }
  }
  if (changed) {
    ds6.getRange(1, 1, 1, needCols).setValues([hdr])
      .setBackground('#1a3a5c').setFontColor('#fff').setFontWeight('bold');
    ds6.setFrozenRows(1);
  }
}
function _validateActivityPayload(payload) {
  const p = payload || {};
  const activity = String(p.activity || '').trim();
  const budget = _n(p.budget);
  const paid = _n(p.paid);
  if (!activity) return { success:false, message:'กรุณาระบุชื่อกิจกรรม' };
  if (budget < 0) return { success:false, message:'งบประมาณต้องไม่ติดลบ' };
  if (paid < 0) return { success:false, message:'ยอดเบิกจ่ายต้องไม่ติดลบ' };
  if (paid > budget) return { success:false, message:'ยอดเบิกจ่ายห้ามเกินงบประมาณ' };
  return { success:true, budget, paid };
}
function _toYmd(v) {
  try {
    if (!v) return '';
    const d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  } catch (_) {
    return String(v || '');
  }
}
function _fiscalYearFromDateValue(v) {
  if (!v) return null;
  let d;
  try {
    if (v instanceof Date) d = v;
    else {
      const s = String(v);
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      else {
        const mt = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{3,4})(?:\s+(\d{1,2}):(\d{2}))?/);
        if (mt) {
          const dd = Number(mt[1]);
          const mm = Number(mt[2]) - 1;
          const y  = Number(mt[3]);
          const hh = mt[4] ? Number(mt[4]) : 0;
          const mi = mt[5] ? Number(mt[5]) : 0;
          const gregorianYear = y > 2400 ? y - 543 : y;
          d = new Date(gregorianYear, mm, dd, hh, mi, 0);
        } else d = new Date(v);
      }
    }
  } catch (_) { return null; }
  if (isNaN(d.getTime())) return null;
  const thaiYear = d.getFullYear() + 543;
  const month = d.getMonth();
  return month >= 9 ? thaiYear + 1 : thaiYear;
}
function _getCurrentRatios(fiscalYear) {
  try {
    const fy = fiscalYear ? Number(fiscalYear) : CONFIG.FISCAL_YEAR;
    const ds5 = _ss().getSheetByName('DS5_AdminAlloc');
    if (!ds5) return { success:false, message:'ไม่พบ DS5_AdminAlloc' };
    const rows = ds5.getDataRange().getValues().slice(1)
      .filter(r => r[C5.ID] && Number(r[C5.YEAR]) === fy);
    if (!rows.length) return { success:false, message:`ไม่พบข้อมูล DS5 ของปีงบ ${fy}` };
    const total = rows.reduce((s,r)=>s+_n(r[C5.ALLOC]),0);
    if (total <= 0) return { success:false, message:'ยอดจัดสรรรวมเป็น 0' };
    const sumPool = key => rows
      .filter(r => String(r[C5.POOL] || '').includes(key))
      .reduce((s,r)=>s+_n(r[C5.ALLOC]),0);
    const policy = sumPool('นโยบาย');
    const strategy = sumPool('ยุทธ');
    const basic = sumPool('พื้นฐาน');
    return {
      success:true,
      data:{
        totalAlloc:_r(total),
        policy:_r(policy), strategy:_r(strategy), basic:_r(basic),
        policyPct:_r(policy/total*100),
        strategyPct:_r(strategy/total*100),
        basicPct:_r(basic/total*100),
      }
    };
  } catch (e) {
    return { success:false, message:e.message || String(e) };
  }
}
function _formatMaybeDate(v, pattern) {
  try {
    if (!v) return '-';
    const d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return '-';
    return Utilities.formatDate(d, CONFIG.TIMEZONE, pattern);
  } catch (e) {
    return '-';
  }
}
function _getTarget(sh){
  const d=sh.getDataRange().getValues().slice(1);
  const thai=['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
  const row=d.find(r=>r[0]===thai[(new Date().getMonth()+3)%12]);
  if(!row)return null;
  return{month:row[0],pct:_n(row[2]),cumPct:_n(row[3])};
}
function _log(mod,act,detail,rec,dur,st){
  try{const sh=_ss().getSheetByName('DS4_Logs');if(!sh)return;
  sh.appendRow([Utilities.getUuid().substring(0,8),new Date(),
    Session.getActiveUser().getEmail()||'system',act,mod,
    detail||'',rec||0,st||'OK',dur||0]);}
  catch(_){}
}

// ═══════════════════════════════════════════════════════════════════════
//  cleanSlateAndInitFY2569()
//  ล้างข้อมูลทั้งหมดใน Google Sheet และสร้างตารางใหม่สำหรับปีงบ 2569
//  วิธีใช้: เปิด Apps Script → รัน cleanSlateAndInitFY2569()
//           หรือเรียกผ่านเมนู ⚙️ รีเซต/สร้าง Sheet → "ล้างข้อมูลทั้งหมด (FY2569)"
// ═══════════════════════════════════════════════════════════════════════
function cleanSlateAndInitFY2569() {
  const t0 = Date.now();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(60000);
    const ss = _ss();
    const ui = SpreadsheetApp.getUi ? SpreadsheetApp.getUi() : null;

    // ── 1. ยืนยันก่อนดำเนินการ (ถ้ารันจาก UI) ────────────────────────
    if (ui) {
      const resp = ui.alert(
        '⚠️ ล้างข้อมูลทั้งหมด (FY 2569)',
        'จะลบข้อมูลทุกแถว (ยกเว้น header) ใน DS0–DS7 ทั้งหมด\n' +
        'และสร้างตารางใหม่สำหรับปีงบประมาณ 2569\n\n' +
        'ดำเนินการต่อ?',
        ui.ButtonSet.YES_NO
      );
      if (resp !== ui.Button.YES) {
        ss.toast('ยกเลิกการล้างข้อมูล', 'Clean Slate', 3);
        return { success: false, message: 'ยกเลิกโดยผู้ใช้' };
      }
    }

    ss.toast('⏳ กำลังล้างข้อมูล...', 'Clean Slate FY2569', 30);

    // ── 2. Helper: ล้างแถวข้อมูลคงไว้แค่ header ────────────────────────
    const _clearData = (shName) => {
      const sh = ss.getSheetByName(shName);
      if (!sh) return { cleared: 0, note: 'ไม่พบชีท' };
      const last = sh.getLastRow();
      if (last <= 1) return { cleared: 0, note: 'ว่างอยู่แล้ว' };
      sh.deleteRows(2, last - 1);
      return { cleared: last - 1 };
    };

    // ── 3. ล้างทุก DS sheet ──────────────────────────────────────────────
    const SHEETS_TO_CLEAR = [
      'DS0_Staging',
      'DS1_Transactions',
      'DS2_MasterBudget',
      'DS3_Targets',
      'DS4_Logs',
      'DS5_AdminAlloc',
      'DS6_Activities',
      'DS7_Transfers',
    ];

    const counts = {};
    SHEETS_TO_CLEAR.forEach(name => {
      counts[name] = _clearData(name);
    });

    // ── 4. สร้าง/ตรวจ headers (setupSheets จะไม่ overwrite ถ้ามี header แล้ว)
    //       เราล้างไปแล้ว แต่ header row ยังอยู่ — setupSheets จะสร้างชีทใหม่
    //       ที่ยังไม่มีเท่านั้น (safe to call)
    setupSheets();

    // ── 5. Re-seed DS3_Targets สำหรับปีงบ 2569 ──────────────────────────
    {
      const sh = ss.getSheetByName('DS3_Targets');
      // ล้างอีกครั้งเพื่อให้ _seedTargets เติมใหม่
      const last = sh.getLastRow();
      if (last > 1) sh.deleteRows(2, last - 1);
      [
        ['ต.ค.',2569,11,11,null,''],
        ['พ.ย.',2569,21,21,null,''],
        ['ธ.ค.',2569,35,35,null,''],
        ['ม.ค.',2569,41,41,null,''],
        ['ก.พ.',2569,47,47,null,''],
        ['มี.ค.',2569,58,58,null,''],
        ['เม.ย.',2569,64,64,null,''],
        ['พ.ค.',2569,73,73,null,''],
        ['มิ.ย.',2569,81,81,null,''],
        ['ก.ค.',2569,91,91,null,''],
        ['ส.ค.',2569,99,99,null,''],
        ['ก.ย.',2569,100,100,null,''],
      ].forEach(r => sh.appendRow(r));
      counts['DS3_Targets'].seeded = 12;
    }

    // ── 6. Re-seed source (dropdown reference) ──────────────────────────
    {
      const sh = ss.getSheetByName('source');
      const last = sh.getLastRow();
      if (last > 1) sh.deleteRows(2, last - 1);
      const lines  = ['นโยบาย ผอ.','รองนิพนธ์','รองศุภลักษณ์','รองสิริรัตน์','รองชัยยะ','ผช.ปราณี','ผช.ศตวรรษ','ไปราชการ','ค่าใช้จ่ายตามสิทธิ์'];
      const pools  = ['นโยบาย','>20% นโยบาย/ชาติ','ยุทธศาสตร์','<50% ยุทธ กรมอนามัย','พื้นฐาน','<30% สนับสนุนองค์กร'];
      const wtypes = ['A — ขับเคลื่อนยุทธศาสตร์ (50%)','B — ขับเคลื่อนนโยบายเร่งด่วน (20%)','C — ค่าใช้จ่ายบริหาร/พื้นฐาน (30%)','D — ค่าใช้จ่ายตามสิทธิ์','E — งบบุคลากร','F — งบลงทุน','X — ไม่นับ/ยกเว้น'];
      const stats  = ['เบิกจ่ายแล้ว','กันเงิน','PO แล้ว','รอดำเนินการ','ยกเลิก'];
      const groups = ['ผู้อำนวยการศูนย์','แม่และเด็ก','วัยเรียน','วัยรุ่น','วัยทำงาน','สูงอายุ','สิ่งแวดล้อม','สุขาภิบาล','กลุ่มวิชาการ วิจัย','อำนวยการ'];
      const n = Math.max(lines.length, pools.length, wtypes.length, stats.length, groups.length);
      for (let i = 0; i < n; i++) {
        sh.appendRow([lines[i]||'', pools[i]||'', wtypes[i]||'', stats[i]||'', groups[i]||'', '', '', '']);
      }
      counts['source'] = { cleared: 0, seeded: n };
    }

    // ── 7. Ensure DS6 extended schema ───────────────────────────────────
    _ensureDs6Schema(ss.getSheetByName('DS6_Activities'));

    // ── 8. Format หัวตาราง DS2 ให้สวยงาม (column width) ────────────────
    {
      const sh = ss.getSheetByName('DS2_MasterBudget');
      sh.setColumnWidth(1, 90);   // Budget_ID
      sh.setColumnWidth(2, 160);  // แผนงาน
      sh.setColumnWidth(3, 200);  // รหัสงบ 20 หลัก
      sh.setColumnWidth(4, 140);  // สายบริหาร
      sh.setColumnWidth(5, 120);  // ประเภทงบ
      sh.setColumnWidth(6, 90);   // Wallet_Type
      sh.setColumnWidth(9, 110);  // Alloc_R1
      sh.setColumnWidth(15, 110); // Alloc_Total
      sh.setColumnWidth(19, 110); // PO_Now
      sh.setColumnWidth(20, 110); // Paid_Now
      sh.setColumnWidth(22, 110); // Remaining
    }

    SpreadsheetApp.flush();

    // ── 9. สรุปผล ──────────────────────────────────────────────────────
    const duration = Date.now() - t0;
    const summary = Object.entries(counts)
      .map(([k,v]) => `${k}: ลบ ${v.cleared||0} แถว${v.seeded ? ` | เติม ${v.seeded} แถว` : ''}`)
      .join('\n');

    _log('CLEAN_SLATE','INIT_FY2569',`FY2569 clean slate | ${JSON.stringify(counts)}`,1,duration);

    ss.toast('✅ ล้างข้อมูลและตั้งค่าตาราง FY2569 เรียบร้อย', 'Clean Slate', 5);

    if (ui) {
      ui.alert(
        '✅ เสร็จสิ้น — ตาราง FY2569 พร้อมใช้งาน',
        summary + `\n\nใช้เวลา: ${duration} ms`,
        ui.ButtonSet.OK
      );
    }

    return { success: true, fiscalYear: 2569, counts, duration_ms: duration };

  } catch (e) {
    _log('CLEAN_SLATE','INIT_FY2569_ERROR',e.message,0,Date.now()-t0,'ERROR');
    if (SpreadsheetApp.getUi) {
      try { SpreadsheetApp.getUi().alert('❌ เกิดข้อผิดพลาด', e.message, SpreadsheetApp.getUi().ButtonSet.OK); } catch(_){}
    }
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}