# The daily X update (decision 0030), run once a day by Windows Task Scheduler:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\x_daily.ps1
# It starts Claude Code without a window, with Chrome, and lets it use only the tools the
# routine in scripts/x_daily_prompt.md needs. The log and the report go to work/x/daily/.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:PYTHONUTF8 = "1"
$day = Get-Date -Format "yyyy-MM-dd"
$dir = Join-Path $root "work\x\daily"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$allowed = @(
  "Read", "Edit(work/x/**)", "ToolSearch",
  "mcp__claude-in-chrome__tabs_context_mcp", "mcp__claude-in-chrome__tabs_create_mcp",
  "mcp__claude-in-chrome__tabs_close_mcp", "mcp__claude-in-chrome__navigate",
  "mcp__claude-in-chrome__javascript_tool", "mcp__claude-in-chrome__browser_batch",
  "mcp__claude-in-chrome__computer",
  "Bash(git branch --show-current)", "Bash(git status:*)", "Bash(git add data/memo)",
  "Bash(git commit data/memo:*)", "Bash(git push origin renewal)",
  "Bash(python scripts/x_daily.py:*)", "Bash(python scripts/check.py --all)"
)
$prompt = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot "x_daily_prompt.md")
# claude writes notices to stderr; with "Stop" PowerShell 5 would treat them as a failure
$ErrorActionPreference = "Continue"
# Out-File: a plain *> would write the log in UTF-16 (PowerShell 5)
claude -p $prompt --chrome --allowedTools $allowed 2>&1 | Out-File -Encoding utf8 (Join-Path $dir "$day.log")
