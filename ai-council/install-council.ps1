# Installs the Decision Council for Claude Code on Windows.
#
# Run it in PowerShell with:
#   irm https://raw.githubusercontent.com/OtterYes/suckers/claude/epic-faraday-o3kzvu/ai-council/install-council.ps1 | iex
#
# What it does:
#   1. Downloads the council's four member subagents and the /council command
#      into your user folder (%USERPROFILE%\.claude), so /council works in any folder.
#   2. Checks for ANTHROPIC_API_KEY, which would make Claude Code bill API credits
#      instead of your subscription, and asks before removing it.
#   3. Checks that Claude Code is installed.
# It needs no administrator rights and changes nothing else.

function Install-DecisionCouncil {
    $ErrorActionPreference = 'Stop'
    # Older Windows PowerShell versions may not enable TLS 1.2 by default.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $base = 'https://raw.githubusercontent.com/OtterYes/suckers/claude/epic-faraday-o3kzvu/.claude'
    $claudeDir = Join-Path $env:USERPROFILE '.claude'
    $files = @(
        @{ Url = "$base/agents/council-researcher.md"; Path = Join-Path $claudeDir 'agents\council-researcher.md' },
        @{ Url = "$base/agents/council-strategist.md"; Path = Join-Path $claudeDir 'agents\council-strategist.md' },
        @{ Url = "$base/agents/council-critic.md";     Path = Join-Path $claudeDir 'agents\council-critic.md' },
        @{ Url = "$base/agents/council-verifier.md";   Path = Join-Path $claudeDir 'agents\council-verifier.md' },
        @{ Url = "$base/skills/council/SKILL.md";      Path = Join-Path $claudeDir 'skills\council\SKILL.md' }
    )

    Write-Host ''
    Write-Host 'Installing the Decision Council for Claude Code...' -ForegroundColor Cyan
    foreach ($f in $files) {
        New-Item -ItemType Directory -Force -Path (Split-Path $f.Path) | Out-Null
        try {
            Invoke-WebRequest -Uri $f.Url -OutFile $f.Path -UseBasicParsing
        } catch {
            Write-Host "  Could not download $($f.Url)" -ForegroundColor Red
            Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
            Write-Host '  Check your internet connection and run the install command again.'
            return
        }
        Write-Host "  Installed $($f.Path)"
    }

    # An API key makes Claude Code bill API credits instead of your subscription.
    $userKey = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY', 'User')
    $machineKey = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY', 'Machine')
    if ($userKey -or $env:ANTHROPIC_API_KEY) {
        Write-Host ''
        Write-Host 'ANTHROPIC_API_KEY is set on this computer.' -ForegroundColor Yellow
        Write-Host 'While it is set, Claude Code uses that key and bills API credits instead of your subscription.'
        $answer = Read-Host 'Remove it so Claude Code uses your subscription? [y/N]'
        if ($answer -match '^(y|yes)$') {
            [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')
            Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
            Write-Host '  Removed. Close this window and open a new one before starting Claude Code.'
        } else {
            Write-Host '  Left in place. Claude Code will bill API credits while it is set.'
        }
    }
    if ($machineKey) {
        Write-Host ''
        Write-Host 'ANTHROPIC_API_KEY is also set for all users on this computer.' -ForegroundColor Yellow
        Write-Host 'Removing that needs administrator rights: search Windows for "Edit the system environment variables".'
    }

    Write-Host ''
    if (Get-Command claude -ErrorAction SilentlyContinue) {
        Write-Host 'Claude Code is installed.' -ForegroundColor Green
    } else {
        Write-Host 'Claude Code was not found in this window.' -ForegroundColor Yellow
        Write-Host 'If you have not installed it yet, run:   irm https://claude.ai/install.ps1 | iex'
        Write-Host 'If you just installed it, close this window and open a new one.'
    }

    Write-Host ''
    Write-Host 'Done. Next steps:' -ForegroundColor Cyan
    Write-Host '  1. Open a new PowerShell window.'
    Write-Host '  2. Run:   mkdir $HOME\council -Force; cd $HOME\council; claude'
    Write-Host '  3. The first time, log in with your Claude account in the browser.'
    Write-Host '  4. Type:  /council followed by your decision.'
    Write-Host ''
}

Install-DecisionCouncil
