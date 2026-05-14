"""
GFMIS NFMA46 Auto-Downloader
ดึงรายงาน NFMA46 จาก newgfmisthai.gfmis.go.th อัตโนมัติ

Flow:
  1. โหลด session cookie ที่บันทึกไว้ → ถ้ายังใช้ได้ข้ามขั้น login
  2. ถ้า session หมด → เปิด browser → กรอก user/pass → รอ MFA จากมือถือ
  3. บันทึก session ใหม่
  4. นำทางไปรายงาน NFMA46 → download → parse → บันทึก CSV
  5. แสดงสรุปผล
"""

import os
import sys
import json
import time
import csv
import re
from pathlib import Path
from datetime import datetime, date

# ─── ติดตั้ง dependencies อัตโนมัติ ──────────────────────────────────────────
def install(pkg):
    import subprocess
    print(f"  กำลังติดตั้ง {pkg}...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])

try:
    from dotenv import load_dotenv
except ImportError:
    install("python-dotenv")
    from dotenv import load_dotenv

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    install("playwright")
    import subprocess
    print("  กำลังติดตั้ง browser สำหรับ Playwright (ครั้งแรกอาจใช้เวลา 1-2 นาที)...")
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

try:
    import openpyxl
except ImportError:
    install("openpyxl")
    import openpyxl

# ─── Config ──────────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).parent
ENV_FILE     = BASE_DIR / ".env"
SESSION_FILE = BASE_DIR / "session" / "gfmis_session.json"
OUTPUT_DIR   = BASE_DIR / "รายงาน"
GFMIS_URL    = "https://newgfmisthai.gfmis.go.th/"

# ─── โหลด credentials จาก .env ───────────────────────────────────────────────
load_dotenv(ENV_FILE)
USERNAME  = os.getenv("GFMIS_USERNAME", "")
PASSWORD  = os.getenv("GFMIS_PASSWORD", "")
UNIT_CODE = os.getenv("GFMIS_UNIT_CODE", "")  # รหัสหน่วยงาน เช่น 01009

def banner(msg):
    print(f"\n{'═'*55}")
    print(f"  {msg}")
    print(f"{'═'*55}")

def step(msg):
    print(f"\n▶  {msg}")

def ok(msg):
    print(f"  ✅ {msg}")

def warn(msg):
    print(f"  ⚠️  {msg}")

def err(msg):
    print(f"  ❌ {msg}")

# ─── Session helpers ──────────────────────────────────────────────────────────
def save_session(context):
    SESSION_FILE.parent.mkdir(exist_ok=True)
    cookies = context.cookies()
    SESSION_FILE.write_text(json.dumps(cookies, ensure_ascii=False, indent=2), encoding="utf-8")
    ok(f"บันทึก session แล้ว ({len(cookies)} cookies)")

def load_session(context) -> bool:
    if not SESSION_FILE.exists():
        return False
    try:
        cookies = json.loads(SESSION_FILE.read_text(encoding="utf-8"))
        context.add_cookies(cookies)
        ok("โหลด session เก่าสำเร็จ")
        return True
    except Exception:
        return False

def is_logged_in(page) -> bool:
    """ตรวจว่า session ยังใช้ได้ — ปรับ selector ตามหน้า GFMIS จริง"""
    try:
        # ─── TODO: ปรับ selector ให้ตรงกับ element ที่แสดงเมื่อ login แล้ว ───
        # เช่น ถ้า login แล้วจะมีปุ่ม "ออกจากระบบ" หรือชื่อ user แสดง
        page.wait_for_selector("text=ออกจากระบบ", timeout=5000)
        return True
    except PWTimeout:
        return False

# ─── Login ────────────────────────────────────────────────────────────────────
def do_login(page):
    if not USERNAME or not PASSWORD:
        err("ยังไม่ได้ตั้งค่า GFMIS_USERNAME / GFMIS_PASSWORD ใน .env")
        err(f"กรุณาแก้ไขไฟล์: {ENV_FILE}")
        sys.exit(1)

    step("เปิดหน้า Login GFMIS...")
    page.goto(GFMIS_URL, timeout=30000)
    page.wait_for_load_state("networkidle", timeout=20000)

    # ─── TODO: ปรับ selector ให้ตรงกับ input จริงในหน้า login ───────────────
    # ดู selector ได้โดย: คลิกขวาที่ช่อง username → Inspect Element
    try:
        page.fill("input[name='username']", USERNAME)   # ← ปรับ selector
        page.fill("input[name='password']", PASSWORD)   # ← ปรับ selector
        page.click("button[type='submit']")             # ← ปรับ selector
        ok("กรอก username/password แล้ว")
    except Exception as e:
        warn(f"ไม่พบ input field อัตโนมัติ: {e}")
        warn("browser เปิดอยู่ — กรุณา login ด้วยตัวเองในหน้าต่าง browser")

    # ─── รอ MFA จากมือถือ ────────────────────────────────────────────────────
    print()
    print("  📱 กรุณา APPROVE การเข้าสู่ระบบบนมือถือของการเงิน")
    print("     (ถ้ายังไม่ได้รับ notification ให้ตรวจ app บนมือถือ)")
    print()
    input("  ✋ เมื่ออนุมัติแล้ว กด Enter เพื่อดำเนินการต่อ... ")

    # ตรวจว่า login สำเร็จ
    page.wait_for_load_state("networkidle", timeout=15000)
    if not is_logged_in(page):
        warn("อาจ login ไม่สำเร็จ — ตรวจสอบหน้า browser")
        input("  ถ้า login แล้ว กด Enter ต่อ / ถ้าไม่ได้ กด Ctrl+C เพื่อยกเลิก... ")

    ok("Login สำเร็จ")

# ─── นำทางไปรายงาน NFMA46 ───────────────────────────────────────────────────
def navigate_to_nfma46(page):
    step("นำทางไปรายงาน NFMA46...")

    # ─── TODO: กรอก steps การนำทางจริงในระบบ GFMIS ─────────────────────────
    # ตัวอย่าง (ปรับตาม menu จริง):
    #
    #   page.click("text=รายงาน")
    #   page.wait_for_load_state("networkidle")
    #   page.click("text=รายงานงบประมาณ")
    #   page.wait_for_load_state("networkidle")
    #   page.click("text=NFMA46")
    #   page.wait_for_load_state("networkidle")
    #
    # หรือถ้ามี direct URL (ดูจาก browser หลัง login):
    #   page.goto("https://newgfmisthai.gfmis.go.th/report/nfma46", timeout=30000)
    #
    # ─────────────────────────────────────────────────────────────────────────

    warn("⚙️  TODO: ยังไม่ได้กรอก navigation steps สำหรับ NFMA46")
    warn("    กรุณาเปิด browser → login → จด steps การนำทาง → แก้ฟังก์ชัน navigate_to_nfma46()")
    print()

    # ─── TODO: เลือกหน่วยงาน + วันที่ + parameter ก่อน generate รายงาน ──────
    # ตัวอย่าง:
    #   if UNIT_CODE:
    #       page.fill("input[name='unit_code']", UNIT_CODE)
    #   today = date.today().strftime("%d/%m/%Y")
    #   page.fill("input[name='date']", today)
    #   page.click("button:has-text('ค้นหา')")
    #   page.wait_for_load_state("networkidle")

    input("  📋 นำทางในหน้าต่าง browser ไปที่รายงาน NFMA46 แล้วกด Enter เพื่อดาวน์โหลด... ")

# ─── Download รายงาน ─────────────────────────────────────────────────────────
def download_report(page) -> Path | None:
    step("กำลัง download รายงาน...")
    today_str = date.today().strftime("%Y-%m-%d")
    output_dir = OUTPUT_DIR / today_str
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        # ─── TODO: ปรับ selector ของปุ่ม Export/Download ───────────────────
        # ตัวอย่าง 1 — ปุ่ม Export Excel:
        #   with page.expect_download(timeout=60000) as dl_info:
        #       page.click("button:has-text('Export Excel')")  # ← ปรับ
        #   download = dl_info.value
        #   save_path = output_dir / f"NFMA46_{today_str}.xlsx"
        #   download.save_as(save_path)
        #   ok(f"Download สำเร็จ: {save_path.name}")
        #   return save_path
        #
        # ตัวอย่าง 2 — copy ตารางจากหน้าเว็บโดยตรง (ถ้าไม่มีปุ่ม Export):
        #   table_html = page.inner_html("table.report-table")  # ← ปรับ selector
        #   return parse_html_table(table_html, output_dir, today_str)
        # ─────────────────────────────────────────────────────────────────────

        warn("⚙️  TODO: ยังไม่ได้กรอก selector สำหรับปุ่ม Download")
        warn("    ดูปุ่ม Export ในหน้า NFMA46 แล้วแก้ฟังก์ชัน download_report()")
        return None

    except PWTimeout:
        err("Timeout รอ download — ตรวจสอบ selector")
        return None

# ─── Parse Excel → CSV ────────────────────────────────────────────────────────
def parse_excel_to_csv(xlsx_path: Path) -> Path:
    """
    แปลง NFMA46 Excel → CSV format ที่ระบบรับได้
    คอลัมน์ที่ต้องการ: แผนงาน | รหัสงบประมาณ | งบสุทธิ | PO | เบิกจ่าย | คงเหลือ
    """
    step(f"แปลง {xlsx_path.name} → CSV...")

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active

    rows_out = []
    for row in ws.iter_rows(values_only=True):
        # กรองแถวที่มีรหัสงบประมาณ 20 หลัก
        for cell in row:
            val = str(cell or "").strip()
            if re.match(r'^\d{20}$', val):
                # แถวนี้มีรหัสงบ — ดึง field ที่ต้องการ
                # ─── TODO: ปรับ index ให้ตรงกับ column จริงใน Excel GFMIS ───
                cols = [str(c or "").strip() for c in row]
                rows_out.append({
                    "แผนงาน":        cols[1] if len(cols) > 1 else "",
                    "รหัสงบประมาณ":  val,
                    "งบสุทธิ":       cols[2] if len(cols) > 2 else "0",
                    "PO":            cols[3] if len(cols) > 3 else "0",
                    "เบิกจ่าย":      cols[4] if len(cols) > 4 else "0",
                    "คงเหลือ":       cols[5] if len(cols) > 5 else "0",
                })
                break

    if not rows_out:
        warn("ไม่พบแถวที่มีรหัสงบประมาณ 20 หลัก — ตรวจสอบ format Excel จาก GFMIS")
        return None

    csv_path = xlsx_path.with_suffix(".csv")
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=rows_out[0].keys())
        writer.writeheader()
        writer.writerows(rows_out)

    ok(f"บันทึก CSV: {csv_path.name} ({len(rows_out)} แผนงาน)")
    return csv_path

def clean_number(s: str) -> float:
    """แปลง '1,234,567.89' → 1234567.89"""
    try:
        return float(str(s).replace(",", "").replace(" ", "") or "0")
    except ValueError:
        return 0.0

# ─── Summary ──────────────────────────────────────────────────────────────────
def print_summary(csv_path: Path):
    if not csv_path or not csv_path.exists():
        return
    step("สรุปผล")
    with open(csv_path, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    total_budget = sum(clean_number(r.get("งบสุทธิ", "0")) for r in rows)
    total_po     = sum(clean_number(r.get("PO", "0"))      for r in rows)
    total_paid   = sum(clean_number(r.get("เบิกจ่าย", "0")) for r in rows)
    total_remain = sum(clean_number(r.get("คงเหลือ", "0")) for r in rows)

    print(f"  จำนวนแผนงาน : {len(rows):>4} รายการ")
    print(f"  งบสุทธิรวม  : {total_budget:>15,.2f} บาท")
    print(f"  PO รวม      : {total_po:>15,.2f} บาท")
    print(f"  เบิกจ่ายรวม : {total_paid:>15,.2f} บาท")
    print(f"  คงเหลือรวม  : {total_remain:>15,.2f} บาท")
    if total_budget > 0:
        pct = total_paid / total_budget * 100
        print(f"  % เบิกจ่าย  : {pct:>14.1f} %")
    print(f"\n  📁 ไฟล์ CSV: {csv_path}")

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    banner(f"GFMIS NFMA46 Auto-Downloader  {date.today():%d/%m/%Y}")

    if not ENV_FILE.exists():
        err(f"ไม่พบไฟล์ .env — กรุณาสร้างจาก .env.example")
        err(f"path: {ENV_FILE}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=False,       # แสดง browser ให้เห็น (สำคัญสำหรับ MFA)
            slow_mo=300,          # ชะลอ action เล็กน้อยให้มองเห็น
        )
        context = browser.new_context(
            locale="th-TH",
            timezone_id="Asia/Bangkok",
            accept_downloads=True,
        )
        page = context.new_page()

        # ─── 1. ลอง restore session ───────────────────────────────────────
        session_loaded = load_session(context)
        logged_in = False

        if session_loaded:
            step("ตรวจสอบ session เก่า...")
            page.goto(GFMIS_URL, timeout=30000)
            page.wait_for_load_state("networkidle", timeout=15000)
            logged_in = is_logged_in(page)
            if logged_in:
                ok("Session ยังใช้ได้ — ข้าม login ✨")
            else:
                warn("Session หมดอายุ — ต้อง login ใหม่")

        # ─── 2. Login (ถ้าจำเป็น) ─────────────────────────────────────────
        if not logged_in:
            do_login(page)
            save_session(context)

        # ─── 3. ไปที่ NFMA46 ──────────────────────────────────────────────
        navigate_to_nfma46(page)

        # ─── 4. Download ──────────────────────────────────────────────────
        xlsx_path = download_report(page)

        # ─── 5. Parse → CSV ───────────────────────────────────────────────
        csv_path = None
        if xlsx_path and xlsx_path.exists():
            csv_path = parse_excel_to_csv(xlsx_path)

        # ─── 6. Summary ───────────────────────────────────────────────────
        print_summary(csv_path)

        context.close()
        browser.close()

    banner("เสร็จสิ้น 🎉")
    if csv_path:
        print(f"  นำ CSV ไปใช้ในระบบ Smart ติดตามกำกับ งบประมาณ ศอ.10 ได้เลย")
    print()
    input("  กด Enter เพื่อปิดหน้าต่างนี้...")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  ยกเลิกโดยผู้ใช้")
    except Exception as e:
        print(f"\n  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        input("\n  กด Enter เพื่อปิด...")
