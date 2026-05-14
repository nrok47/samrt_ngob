/**
 * ======================================================================
 *  smart budget · Google Apps Script — JSON API
 *  ศูนย์อนามัยที่ 10 อุบลราชธานี
 * ----------------------------------------------------------------------
 *  วิธีติดตั้ง:
 *  1) เปิด Google Sheet ที่ทีมกรอกข้อมูล (https://docs.google.com/spreadsheets/...)
 *  2) เมนู Extensions → Apps Script
 *  3) ลบโค้ดเดิมออกทั้งหมด แล้ววางโค้ดนี้ลงไป
 *  4) แก้ค่าที่ "CONFIG" ด้านล่างให้ตรงกับชื่อชีตจริง
 *  5) Save (ดิสเก็ต) → ตั้งชื่อโปรเจกต์ "smart-budget-api"
 *  6) Deploy → New deployment
 *       - Type: Web app
 *       - Execute as: Me
 *       - Who has access: Anyone (จำเป็น เพื่อให้ dashboard อ่านได้)
 *  7) คัดลอก "Web app URL" ที่ขึ้นมา — เอาไปใส่ใน dashboard.html
 * ======================================================================
 */

// ====== CONFIG · ปรับให้ตรงกับชื่อชีตจริงของคุณ ======================
const CONFIG = {
  // ชื่อแท็บใน Google Sheet (ดูที่ tab ด้านล่างของ Sheet)
  SHEET_BUDGET_SUMMARY: 'สรุปเบิกจ่าย',     // tab สรุปยอดรวม
  SHEET_BY_LINE:        'รายสายงาน',         // tab รายสายบังคับบัญชา
  SHEET_CASH_FLOW:      'เงินบำรุง',          // tab รับ-จ่ายเงินบำรุง
  SHEET_INCOME_CAT:     'รายรับแยกประเภท',  // tab สัดส่วนรายรับ
  SHEET_EXPENSE_CAT:    'รายจ่ายแยกประเภท', // tab สัดส่วนรายจ่าย
  SHEET_ACTIVITY:       'Activity',            // tab log การอัปเดต
};
// ====================================================================

/**
 * Web App entry point — ตอบกลับเป็น JSON
 * ทดสอบได้โดยเปิด Web App URL ตรงๆ บน browser
 */
function doGet(e) {
  try {
    const data = {
      meta: {
        lastUpdated: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        source: 'GFMIS + Manual entry',
      },
      summary:    readSummary_(),
      byLine:     readByLine_(),
      cashFlow:   readCashFlow_(),
      incomeCat:  readCategoryShare_(CONFIG.SHEET_INCOME_CAT),
      expenseCat: readCategoryShare_(CONFIG.SHEET_EXPENSE_CAT),
      activity:   readActivity_(),
    };
    return jsonResponse_(data);
  } catch (err) {
    return jsonResponse_({ error: err.message, stack: err.stack });
  }
}

/* ==================================================================== */
/* Sheet readers                                                        */
/* ==================================================================== */

/**
 * tab "สรุปเบิกจ่าย" — โครงสร้าง 2 คอลัมน์: key | value
 * ตัวอย่าง:
 *   งบดำเนินงาน_pct       | 65.58
 *   งบดำเนินงาน_actual    | 5015168.94
 *   งบดำเนินงาน_budget    | 7647300
 *   งบลงทุน_pct           | 100
 *   งบลงทุน_actual        | 1032482
 *   งบลงทุน_budget        | 1032500
 *   ยอดรวม_pct            | 69.68
 *   ยอดรวม_actual         | 6047650.94
 *   ยอดรวม_budget         | 8679800
 *   เป้ากรม               | 69
 *   เป้าศอ                | 75
 *   asOfDate              | 2026-05-05
 */
function readSummary_() {
  const sheet = ss_().getSheetByName(CONFIG.SHEET_BUDGET_SUMMARY);
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const out = {};
  // skip header row
  for (let i = 1; i < rows.length; i++) {
    const [key, val] = rows[i];
    if (!key) continue;
    out[String(key).trim()] = val;
  }
  return out;
}

/**
 * tab "รายสายงาน" — header: name | pct
 * ตัวอย่าง:
 *   ผู้อำนวยการ                 | 49.13
 *   ภารกิจส่งเสริมสุขภาพ        | 82.79
 *   ...
 */
function readByLine_() {
  const sheet = ss_().getSheetByName(CONFIG.SHEET_BY_LINE);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1)
    .filter(r => r[0])
    .map(r => ({ name: String(r[0]).trim(), pct: toNum_(r[1]) }));
}

/**
 * tab "เงินบำรุง" — โครงสร้าง 2 คอลัมน์: key | value
 *   savings_balance       | 2752260.86
 *   treasury_balance      | 11896355.15
 *   total_balance         | 14648616.01
 *   income_ytd            | 13689187.88
 *   expense_ytd           | 12242892.24
 *   profit_ytd            | 1446295.64
 *   today_income          | 12227.50
 *   today_expense         | 56404.00
 *   asOfDate              | 2026-05-07
 */
function readCashFlow_() {
  const sheet = ss_().getSheetByName(CONFIG.SHEET_CASH_FLOW);
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const [key, val] = rows[i];
    if (!key) continue;
    out[String(key).trim()] = val;
  }
  return out;
}

/**
 * tab "รายรับแยกประเภท" / "รายจ่ายแยกประเภท"
 * header: label | percent | color (color เป็น optional, hex format เช่น #5aa463)
 */
function readCategoryShare_(sheetName) {
  const sheet = ss_().getSheetByName(sheetName);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1)
    .filter(r => r[0])
    .map(r => ({
      l: String(r[0]).trim(),
      v: toNum_(r[1]),
      c: r[2] ? String(r[2]).trim() : null,
    }));
}

/**
 * tab "Activity" — log การอัปเดต
 * header: timestamp | who | verb | what | amount | tag
 * ตัวอย่าง 1 row:
 *   2026-05-07 09:18  | ทีมการเงิน | ส่งรายงาน | รับ-จ่ายเงินบำรุง | (เว้นว่าง) | @All คกก.
 */
function readActivity_() {
  const sheet = ss_().getSheetByName(CONFIG.SHEET_ACTIVITY);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1)
    .filter(r => r[0])
    .map(r => ({
      timestamp: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      who:  String(r[1] || '').trim(),
      verb: String(r[2] || '').trim(),
      what: String(r[3] || '').trim(),
      amt:  r[4] ? toNum_(r[4]) : 0,
      tag:  r[5] ? String(r[5]).trim() : '',
    }))
    // เรียงใหม่ → เก่า, เอา 20 รายการแรก
    .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))
    .slice(0, 20);
}

/* ==================================================================== */
/* helpers                                                              */
/* ==================================================================== */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function toNum_(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ==================================================================== */
/* OPTIONAL · ทดสอบในหน้า Apps Script editor ก่อน deploy                  */
/* กดปุ่ม Run แล้วดูที่ View → Logs                                       */
/* ==================================================================== */
function testRead() {
  const data = {
    summary:   readSummary_(),
    byLine:    readByLine_(),
    cashFlow:  readCashFlow_(),
    incomeCat: readCategoryShare_(CONFIG.SHEET_INCOME_CAT),
    expense:   readCategoryShare_(CONFIG.SHEET_EXPENSE_CAT),
    activity:  readActivity_(),
  };
  Logger.log(JSON.stringify(data, null, 2));
}
