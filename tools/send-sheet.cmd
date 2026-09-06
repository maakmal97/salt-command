@echo off
rem  Send Statement: open the newest send sheet.
rem
rem  SOURCE OF TRUTH. The Desktop shortcut (Desktop\Shortcuts\Send Statement.lnk) points at
rem  THIS file; the Desktop lives in OneDrive, which is no place for an original.
rem
rem  The sheet is written beside each issue as statements\<YYYY-MM>\_send_<date>.html and is
rem  gitignored, because it carries every password in the issue. Its name changes every month,
rem  so a shortcut to the file itself would go stale on the first of the next month. This finds
rem  the newest one by name (the folders and the dates both sort), and opens it in the default
rem  browser. Nothing is generated here: if the newest issue has no sheet yet, it says which
rem  command makes one, and stops.
setlocal
set "REPO=%~dp0.."
set "SHEET="
for /f "delims=" %%f in ('dir /b /s /o-n "%REPO%\statements\_send_*.html" 2^>nul') do (
  if not defined SHEET set "SHEET=%%f"
)
if not defined SHEET (
  echo No send sheet found under %REPO%\statements.
  echo Make one with:  node tools\stmt-send.mjs statements\YYYY-MM YYYY-MM-DD
  pause
  exit /b 1
)
start "" "%SHEET%"
