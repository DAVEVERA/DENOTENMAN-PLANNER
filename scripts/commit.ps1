param(
  [Parameter(Mandatory = $true)]
  [Alias("m")]
  [string]$Message,

  [Alias("f")]
  [string[]]$Files = @(),

  [switch]$All,
  [switch]$Push,
  [switch]$Build,
  [switch]$AllowEmpty,
  [switch]$DryRun,

  [string]$Remote = "origin",
  [string]$Branch = ""
)

$ErrorActionPreference = "Stop"

function Run($Command, [string[]]$CommandArgs) {
  Write-Host "> $Command $($CommandArgs -join ' ')" -ForegroundColor DarkGray
  if ($DryRun) { return }
  & $Command @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command $($CommandArgs -join ' ')"
  }
}

function CurrentBranch() {
  $current = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($current)) {
    throw "Could not determine current git branch."
  }
  return $current
}

Run "git" @("status", "--short")

if ($Build) {
  Run "npm" @("run", "build")
}

if ($All) {
  Run "git" @("add", "-A")
} elseif ($Files.Count -gt 0) {
  Run "git" (@("add", "--") + $Files)
} else {
  Write-Host "No files staged by this script. Use -All or -Files path1,path2." -ForegroundColor Yellow
  Write-Host "Already staged files will still be committed." -ForegroundColor Yellow
}

if ($DryRun) {
  Write-Host "Dry run complete. No files were staged, committed, or pushed." -ForegroundColor Green
  exit 0
}

$staged = (& git diff --cached --name-only)
if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace(($staged -join ""))) {
  Write-Host "No staged changes. Nothing to commit." -ForegroundColor Yellow
  exit 0
}

$commitArgs = @("commit", "-m", $Message)
if ($AllowEmpty) {
  $commitArgs += "--allow-empty"
}
Run "git" $commitArgs

if ($Push) {
  $targetBranch = $Branch
  if ([string]::IsNullOrWhiteSpace($targetBranch)) {
    $targetBranch = CurrentBranch
  }
  Run "git" @("push", $Remote, $targetBranch)
}

Run "git" @("status", "--short")
