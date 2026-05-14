# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Python automation tool that scrapes NFMA46 financial reports from Thailand's GFMIS system (`newgfmisthai.gfmis.go.th`) and exports them as CSV files for the "Smart ติดตามกำกับ งบประมาณ ศอ.10" budget tracking system.

## Running the Scraper

```powershell
# Command line
C:\Python314\python.exe gfmis_scraper.py

# Or via the Windows launcher (double-click or terminal)
.\ดึงรายงาน_GFMIS.bat
```

Dependencies install automatically on first run (`python-dotenv`, `playwright`, `openpyxl`, Chromium). No manual `pip install` needed.

## Setup

Copy `.env.example` to `.env` and fill in:
```
GFMIS_USERNAME=...
GFMIS_PASSWORD=...
GFMIS_UNIT_CODE=01009   # 01009 = Health Office 10 (ศอ.10)
```

## Architecture

All logic is in the single file `gfmis_scraper.py` (~357 lines). The workflow is linear:

1. **Session restore** — loads cookies from `session/gfmis_session.json`; skips login if session is still valid
2. **Authentication** — browser runs visible (`headless=False`) so the user can approve the MFA prompt on their mobile app
3. **Report navigation & download** — navigates GFMIS to the NFMA46 report and triggers Excel export
4. **Excel → CSV conversion** — uses `openpyxl` to extract rows that have 20-digit budget codes, maps Thai column headers to output fields
5. **Summary** — prints budget totals and payment percentage to the console

Output is written to `รายงาน/{YYYY-MM-DD}/NFMA46_{date}.csv` (UTF-8 BOM for Thai Excel compatibility).

## Known Incomplete Areas

The following sections contain `TODO` / stub code that requires GFMIS UI inspection to complete:

- Login form field selectors (lines ~121–123)
- Session validity check selector (line ~102) — must match the logout button in the live UI
- GFMIS navigation path to the NFMA46 report (lines ~148–164)
- Download button selector (lines ~186–207)

Use `headless=False` + `slow_mo=300` (already set) to observe the live GFMIS UI while filling in selectors.

## Parent System Context

This scraper is one component of a larger Google Apps Script system. The parent directory (`c:\xampp\htdocs\samrt_ngob`) contains:

- `Code.gs` — Google Apps Script backend; imports the CSV into a Google Sheet (`18YMnEE-HTnOn3tgDQM0tzcu3k1EDteBA5COhoojutPg`)
- `system_flow.md` — full architecture for the 9-sheet data model (DS0_Staging → DS8/DS9)
- `คู่มือ.md` — Thai-language user manual

The CSV produced here feeds into `DS0_Staging` → `DS2_MasterBudget` via the Apps Script import pipeline.
