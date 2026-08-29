param(
    [string[]]$Packages = @('./conf', './cmd/...')
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$portableGoBin = Join-Path $projectRoot 'tmp\go-portable-1.26.7\go\bin'
$portableZigBin = Join-Path $projectRoot 'tmp\zig-portable\zig-x86_64-windows-0.15.2'

$env:PATH = "$portableGoBin;$portableZigBin;$env:PATH"
$env:GOROOT = Join-Path $projectRoot 'tmp\go-portable-1.26.7\go'
$env:GOCACHE = Join-Path $projectRoot 'tmp\go-build-cache'
$env:CGO_ENABLED = '1'
$env:CC = 'zig cc'
$env:CXX = 'zig c++'
$env:ZIG_LOCAL_CACHE_DIR = Join-Path $projectRoot 'tmp\zig-cache'
$env:ZIG_GLOBAL_CACHE_DIR = Join-Path $projectRoot 'tmp\zig-global-cache'

& (Join-Path $portableGoBin 'go.exe') test -tags 'netgo,sqlite_fts5' @Packages
