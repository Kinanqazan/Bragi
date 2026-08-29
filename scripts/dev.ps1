[CmdletBinding()]
param(
    [int]$Port = 4533,
    [int]$BackendPort = 0,
    [string]$CastMediaBaseURL = ''
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$appPath = "/app/#/song"

if ($BackendPort -le 0) {
    $BackendPort = $Port + 100
}

$localUrl = "http://localhost:$Port$appPath"

# Configure portable toolchains when they are present.
$portableGoBin = Join-Path $projectRoot 'tmp\go-portable-1.26.7\go\bin'
$portableZigBin = Join-Path $projectRoot 'tmp\zig-portable\zig-x86_64-windows-0.15.2'

if (Test-Path (Join-Path $portableGoBin 'go.exe')) {
    $env:PATH = "$portableGoBin;$portableZigBin;$env:PATH"
    $env:GOROOT = Join-Path $projectRoot 'tmp\go-portable-1.26.7\go'
}

# Keep the development compiler cache inside the project. This avoids stale or
# locked entries in a user-wide Go cache when the script is restarted quickly.
$env:GOCACHE = Join-Path $projectRoot 'tmp\go-build-cache'
if (-not (Test-Path $env:GOCACHE)) {
    New-Item -ItemType Directory -Path $env:GOCACHE -Force | Out-Null
}

if (Test-Path (Join-Path $portableZigBin 'zig.exe')) {
    $env:CGO_ENABLED = '1'
    $env:CC = 'zig cc'
    $env:CXX = 'zig c++'
    # Zig otherwise writes its cache under the user profile. Keep all build
    # state in this writable project-local tmp directory for repeatable runs.
    $env:ZIG_LOCAL_CACHE_DIR = Join-Path $projectRoot 'tmp\zig-cache'
    $env:ZIG_GLOBAL_CACHE_DIR = Join-Path $projectRoot 'tmp\zig-global-cache'
    foreach ($zigCachePath in @($env:ZIG_LOCAL_CACHE_DIR, $env:ZIG_GLOBAL_CACHE_DIR)) {
        if (-not (Test-Path $zigCachePath)) {
            New-Item -ItemType Directory -Path $zigCachePath -Force | Out-Null
        }
    }
}

function Test-PortAvailable {
    param([int]$CheckPort)

    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return -not ($listeners | Where-Object { $_.Port -eq $CheckPort })
}

function Get-ListeningProcessIds {
    param([int]$CheckPort)

    try {
        $connections = @(
            Get-NetTCPConnection -State Listen -LocalPort $CheckPort -ErrorAction Stop |
                Select-Object -ExpandProperty OwningProcess |
                Select-Object -Unique
        )
        if ($connections.Count -gt 0) {
            return $connections
        }
    } catch {
    }

    # Fall back to netstat for older/minimal PowerShell environments and for
    # listeners that Get-NetTCPConnection does not report in restricted shells.
    $ids = @(netstat -ano -p tcp |
        ForEach-Object {
            $columns = ($_ -replace '^\s+', '').Split([char[]]' ', [System.StringSplitOptions]::RemoveEmptyEntries)
            if ($columns.Count -ge 5 -and $columns[0] -eq 'TCP' -and $columns[1] -match ":$CheckPort$") {
                $columns[$columns.Count - 1]
            }
        })
    return @($ids | Where-Object { $_ -match '^\d+$' } | Select-Object -Unique)
}

function Test-ViteServer {
    param([int]$CheckPort)

    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$CheckPort/app/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return ([string]$response.Content -match '@vite/client')
    } catch {
        return $false
    }
}

function Stop-ProcessTree {
    param(
        [System.Diagnostics.Process]$Process,
        [int]$ListeningPort = 0
    )

    if ($null -ne $Process) {
        try {
            if (-not $Process.HasExited) {
                Stop-Process -Id $Process.Id -Force -ErrorAction Stop
            }
        } catch {
            # Fall back to taskkill when the process is a cmd/npm wrapper.
            try {
                & taskkill.exe /PID $Process.Id /T /F | Out-Null
            } catch {
            }
        }
    }

    # npm and `go run` can leave a child executable behind. Once the parent is
    # gone, close only the listener that belongs to this script's port.
    if ($ListeningPort -gt 0) {
        foreach ($processId in @(Get-ListeningProcessIds -CheckPort $ListeningPort)) {
            try {
                Stop-Process -Id ([int]$processId) -Force -ErrorAction Stop
            } catch {
            }
        }
    }
}

function Stop-StaleViteServer {
    param([int]$CheckPort)

    if (Test-PortAvailable -CheckPort $CheckPort -or -not (Test-ViteServer -CheckPort $CheckPort)) {
        return
    }

    $processIds = @(Get-ListeningProcessIds -CheckPort $CheckPort)
    if ($processIds.Count -eq 0) {
        throw "Port $CheckPort is occupied by a Vite server, but its process could not be identified. Stop it manually."
    }

    foreach ($processId in $processIds) {
        Write-Host "Stopping stale Vite process (PID $processId) on port $CheckPort..." -ForegroundColor DarkYellow
        try {
            Stop-Process -Id ([int]$processId) -Force -ErrorAction Stop
        } catch {
            try {
                & taskkill.exe /PID ([int]$processId) /T /F | Out-Null
            } catch {
            }
        }
    }

    for ($attempt = 0; $attempt -lt 10 -and -not (Test-PortAvailable -CheckPort $CheckPort); $attempt++) {
        Start-Sleep -Milliseconds 200
    }
}

function Get-LanIPv4Addresses {
    $addresses = @()

    try {
        $addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.AddressState -eq 'Preferred'
            } |
            Select-Object -ExpandProperty IPAddress)
    } catch {
        $addresses = @()
    }

    if (-not $addresses -or $addresses.Count -eq 0) {
        # Fall back to ipconfig for older/minimal PowerShell environments.
        $addresses = @(ipconfig |
            ForEach-Object {
                if ($_ -match 'IPv4[^:]*:\s*(\d{1,3}(?:\.\d{1,3}){3})') {
                    $Matches[1]
                }
            } |
            Where-Object { $_ -notlike '127.*' -and $_ -notlike '169.254.*' })
    }

    return @($addresses | Select-Object -Unique)
}

function Wait-ForVite {
    param(
        [int]$CheckPort,
        [System.Diagnostics.Process]$Process,
        [string]$ErrorLog
    )

    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        if ($Process.HasExited) {
            $details = if (Test-Path $ErrorLog) { Get-Content $ErrorLog -Tail 20 | Out-String } else { '' }
            throw "Vite exited before becoming ready. See $ErrorLog`n$details"
        }

        if (Test-ViteServer -CheckPort $CheckPort) {
            return
        }

        Start-Sleep -Milliseconds 500
    }

    throw "Vite did not become ready on port $CheckPort. See $ErrorLog"
}

function Wait-ForBackend {
    param(
        [int]$CheckPort,
        [System.Diagnostics.Process]$Process,
        [string]$ErrorLog
    )

    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        if ($Process.HasExited) {
            $details = if (Test-Path $ErrorLog) { Get-Content $ErrorLog -Tail 20 | Out-String } else { '' }
            throw "Go backend exited before becoming ready. See $ErrorLog`n$details"
        }

        try {
            Invoke-WebRequest -Uri "http://127.0.0.1:$CheckPort/ping" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
            return
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    throw "Go backend did not become ready on port $CheckPort. See $ErrorLog"
}

Stop-StaleViteServer -CheckPort $Port

if (-not (Test-PortAvailable -CheckPort $Port)) {
    throw "Port $Port is already in use. Stop the previous test server before running this script."
}

if (-not (Test-PortAvailable -CheckPort $BackendPort)) {
    throw "Backend port $BackendPort is already in use. Stop the previous test server before running this script."
}

$env:ND_MUSICFOLDER = Join-Path $projectRoot 'tests\fixtures\test_songs files'
$env:ND_DATAFOLDER = Join-Path $projectRoot 'tmp\navidrome-data'
$env:ND_PORT = "$BackendPort"
$env:ND_DEVACTIVITYPANEL = 'true'
$env:PORT = "$Port"
$env:BACKEND_PORT = "$BackendPort"

if ([string]::IsNullOrWhiteSpace($CastMediaBaseURL)) {
    $CastMediaBaseURL = $env:ND_CASTMEDIABASEURL
}
if ([string]::IsNullOrWhiteSpace($CastMediaBaseURL)) {
    $lanAddress = @(Get-LanIPv4Addresses) | Select-Object -First 1
    if (-not [string]::IsNullOrWhiteSpace($lanAddress)) {
        $CastMediaBaseURL = "http://$lanAddress`:$Port"
    }
}
if (-not [string]::IsNullOrWhiteSpace($CastMediaBaseURL)) {
    $env:ND_CASTMEDIABASEURL = $CastMediaBaseURL.TrimEnd('/')
}
# Keep the development manifest and service worker available so this exact URL
# can be installed as a PWA while the UI still uses Vite's hot reload.
$env:VITE_ENABLE_DEV_PWA = 'true'

if (-not (Test-Path $env:ND_DATAFOLDER)) {
    New-Item -ItemType Directory -Path $env:ND_DATAFOLDER -Force | Out-Null
}

$tmpPath = Join-Path $projectRoot 'tmp'
$viteStdoutLog = Join-Path $tmpPath 'vite-dev.stdout.log'
$viteStderrLog = Join-Path $tmpPath 'vite-dev.stderr.log'
$backendStdoutLog = Join-Path $tmpPath 'navidrome-dev.stdout.log'
$backendStderrLog = Join-Path $tmpPath 'navidrome-dev.stderr.log'

Write-Host '=================================================' -ForegroundColor Cyan
Write-Host '  Starting Navidrome live single-origin test server' -ForegroundColor Cyan
Write-Host "  UI + API: $localUrl" -ForegroundColor Cyan
foreach ($address in (Get-LanIPv4Addresses)) {
    Write-Host "  LAN URL:   http://$address`:$Port$appPath" -ForegroundColor Cyan
}
Write-Host "  Reverse-proxy upstream: http://<this-machine-ip>:$Port" -ForegroundColor Cyan
if (-not [string]::IsNullOrWhiteSpace($CastMediaBaseURL)) {
    Write-Host "  Cast media URL: $($env:ND_CASTMEDIABASEURL)" -ForegroundColor Cyan
} else {
    Write-Host '  Cast media URL: not set (the receiver cannot use localhost)' -ForegroundColor DarkYellow
}
Write-Host "  Go backend (internal): http://127.0.0.1:$BackendPort" -ForegroundColor DarkGray
Write-Host '  UI edits are live via Vite HMR; restart this script only for Go changes.' -ForegroundColor Green
Write-Host '=================================================' -ForegroundColor Cyan

$viteProcess = $null
$backendProcess = $null

try {
    # Use npm.cmd so PowerShell execution-policy settings cannot block npm.ps1.
    $npmExecutable = (Get-Command npm.cmd -ErrorAction Stop).Source
    $goExecutable = (Get-Command go.exe -ErrorAction Stop).Source

    Write-Host "`n[1/2] Starting Go backend on port $BackendPort..." -ForegroundColor Yellow
    $backendProcess = Start-Process -FilePath $goExecutable `
        -ArgumentList @('run', '-tags', 'netgo,sqlite_fts5', 'main.go') `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $backendStdoutLog `
        -RedirectStandardError $backendStderrLog `
        -PassThru

    Write-Host "[2/2] Starting Vite UI on port $Port..." -ForegroundColor Yellow
    $viteProcess = Start-Process -FilePath $npmExecutable `
        -ArgumentList @('run', 'start', '--', '--host', '0.0.0.0', '--port', "$Port") `
        -WorkingDirectory (Join-Path $projectRoot 'ui') `
        -WindowStyle Hidden `
        -RedirectStandardOutput $viteStdoutLog `
        -RedirectStandardError $viteStderrLog `
        -PassThru

    Wait-ForBackend -CheckPort $BackendPort -Process $backendProcess -ErrorLog $backendStderrLog
    Wait-ForVite -CheckPort $Port -Process $viteProcess -ErrorLog $viteStderrLog

    Write-Host "`nReady. Open $localUrl" -ForegroundColor Green
    Write-Host 'Vite and Go logs are in tmp\vite-dev.*.log and tmp\navidrome-dev.*.log.' -ForegroundColor DarkGray
    try {
        Start-Process $localUrl | Out-Null
    } catch {
        Write-Host "Could not open a browser automatically. Open $localUrl manually." -ForegroundColor DarkYellow
    }

    while (-not $viteProcess.HasExited -and -not $backendProcess.HasExited) {
        Start-Sleep -Seconds 1
    }

    if ($viteProcess.HasExited) {
        throw "Vite stopped unexpectedly. See $viteStderrLog"
    }

    throw "Go backend stopped unexpectedly. See $backendStderrLog"
} finally {
    Stop-ProcessTree -Process $viteProcess -ListeningPort $Port
    Stop-ProcessTree -Process $backendProcess -ListeningPort $BackendPort
}
