@echo off
rem Writes manifest.json (alphabetical list of names in this folder) next to this script.
setlocal DisableDelayedExpansion
chcp 65001 >nul
pushd "%~dp0"
set "line=["
set "first=1"
for /f "delims=" %%F in ('dir /b /on') do (
  if /i not "%%F"=="manifest.json" if /i not "%%F"=="%~nx0" (
    if defined first (
      call set "line=%%line%%"%%F""
      set "first="
    ) else (
      call set "line=%%line%%, "%%F""
    )
  )
)
> manifest.json echo(%line%]
popd
endlocal
