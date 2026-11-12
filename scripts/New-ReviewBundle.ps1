#requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Baseline,
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$OutputDirectory,
    [ValidateSet('Section', 'Complete')][string]$Boundary = 'Section',
    [ValidateSet('ProtectPersonal', 'ApprovedScripts', 'Incorporated')][string]$PackageJsonPolicy = 'ProtectPersonal',
    [string]$ScriptsCheckpoint,
    [string[]]$ExcludePath = @()
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$git = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$repo = (Get-Location).ProviderPath
$outputCreated = $false
$out = $null
$gitOverrides = [Collections.Generic.List[string]]::new()
$phase = 'input/baseline validation'

function Invoke-Git([string[]]$Arguments) {
    $info = [Diagnostics.ProcessStartInfo]::new($git)
    $info.WorkingDirectory = $repo
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    # Do not inherit alternate indexes/worktrees or launch fsmonitor/external diff helpers.
    foreach ($key in @($info.Environment.Keys)) {
        if ($key -like 'GIT_*') { $info.Environment.Remove($key) | Out-Null }
    }
    $info.Environment['GIT_OPTIONAL_LOCKS'] = '0'
    $info.Environment['GIT_TERMINAL_PROMPT'] = '0'
    foreach ($arg in @('--no-pager', '--no-optional-locks', '--literal-pathspecs', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'diff.autoRefreshIndex=false') + $gitOverrides.ToArray() + $Arguments) {
        $info.ArgumentList.Add($arg)
    }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw 'Cannot start Git.' }
        $errors = $process.StandardError.ReadToEndAsync()
        $bytes = [IO.MemoryStream]::new()
        try {
            $process.StandardOutput.BaseStream.CopyTo($bytes)
            $process.WaitForExit()
            $null = $errors.GetAwaiter().GetResult() # Never expose Git diagnostics containing private paths/content.
            if ($process.ExitCode -ne 0) { throw 'Read-only Git command failed (invalid reference or unsupported repository state).' }
            return ,$bytes.ToArray()
        } finally { $bytes.Dispose() }
    } finally { $process.Dispose() }
}
function Git-Text([string[]]$Arguments) { $utf8.GetString((Invoke-Git $Arguments)) }
function Digest([byte[]]$Bytes) { [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)) }
function Is-Within([string]$Child, [string]$Parent) {
    $comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
    $Child.Equals($Parent, $comparison) -or $Child.StartsWith($Parent.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar, $comparison)
}
function Assert-NoLinks([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -Force -LiteralPath $cursor
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unsafe link/reparse path rejected.' }
        }
        # A dangling link must also be rejected.
        elseif ($null -ne (Get-Item -Force -LiteralPath $cursor -ErrorAction SilentlyContinue)) { throw 'Unsafe dangling link rejected.' }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
function Relative-Path([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path) -or $Path.Contains('\') -or $Path.Contains(':') -or
        $Path -match '[\x00-\x1f\x7f]' -or [IO.Path]::IsPathRooted($Path) -or
        @($Path.Split('/') | Where-Object { $_ -in @('', '.', '..', '.git') -or $_ -match '[. ]$' }).Count) {
        throw 'Unsafe repository-relative path rejected.'
    }
    $full = [IO.Path]::GetFullPath([IO.Path]::Combine($repo, $Path))
    if (-not (Is-Within $full $repo)) { throw 'Path escapes repository.' }
    Assert-NoLinks $full
    return $full
}
function Nul-Items([byte[]]$Bytes) {
    @($utf8.GetString($Bytes).Split([char]0, [StringSplitOptions]::RemoveEmptyEntries))
}
function Changes([string[]]$Refs, [bool]$Renames = $false) {
    $mode = if ($Renames) { '--find-renames' } else { '--no-renames' }
    $parts = @(Nul-Items (Invoke-Git (@('diff', '--no-ext-diff', '--no-textconv', '--name-status', '-z', $mode) + $Refs + @('--'))))
    # With autoRefreshIndex disabled, name-status can include racy-clean entries.
    # numstat forces Git to compare content without exporting it or refreshing index.
    $actual = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    if (-not $Renames) {
        foreach ($record in @(Nul-Items (Invoke-Git (@('diff', '--no-ext-diff', '--no-textconv', '--numstat', '-z', '--no-renames') + $Refs + @('--'))))) {
            $columns = $record -split "`t", 3
            if ($columns.Count -ne 3) { throw 'Unexpected Git numstat metadata.' }
            $null = $actual.Add($columns[2])
        }
    }
    $items = [Collections.Generic.List[object]]::new()
    for ($i = 0; $i -lt $parts.Count;) {
        $state = $parts[$i++]
        $path = $parts[$i++]
        $null = Relative-Path $path
        if ($state -match '^[RC]') {
            $other = $parts[$i++]
            $null = Relative-Path $other
            $items.Add([pscustomobject]@{ State = $state; Path = $path; Other = $other })
        } elseif ($Renames -or $actual.Contains($path)) { $items.Add([pscustomobject]@{ State = $state; Path = $path; Other = $null }) }
    }
    $items.ToArray()
}
function Resolve-Commit([string]$Ref) {
    if ([string]::IsNullOrWhiteSpace($Ref) -or $Ref.StartsWith('-') -or $Ref -match '[\x00-\x20]') { throw 'Invalid explicit commit reference.' }
    (Git-Text @('rev-parse', '--verify', '--end-of-options', "$Ref^{commit}")).Trim()
}
function Read-Package([string]$Ref) {
    try { Parse-PackageJson (Git-Text @('show', "${Ref}:package.json")) }
    catch { throw 'package.json is missing or invalid at a required checkpoint.' }
}
function Parse-PackageJson([string]$Text) {
    # ConvertFrom-Json alone accepts duplicate keys/comments. Never authorize a raw
    # package diff whose ignored text could contain an unrelated personal value.
    $document = [Text.Json.JsonDocument]::Parse($Text)
    try {
        $pending = [Collections.Generic.Stack[Text.Json.JsonElement]]::new()
        $pending.Push($document.RootElement)
        while ($pending.Count) {
            $value = $pending.Pop()
            if ($value.ValueKind -eq [Text.Json.JsonValueKind]::Object) {
                $keys = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
                foreach ($property in $value.EnumerateObject()) {
                    if (-not $keys.Add($property.Name)) { throw 'Duplicate package.json keys rejected.' }
                    $pending.Push($property.Value)
                }
            } elseif ($value.ValueKind -eq [Text.Json.JsonValueKind]::Array) {
                foreach ($element in $value.EnumerateArray()) { $pending.Push($element) }
            }
        }
        return ($Text | ConvertFrom-Json -AsHashtable)
    } finally { $document.Dispose() }
}
function Canonical($Value) {
    if ($Value -is [Collections.IDictionary]) {
        $ordered = [ordered]@{}
        foreach ($key in @($Value.Keys | Sort-Object -CaseSensitive)) { $ordered[$key] = Canonical $Value[$key] }
        return $ordered
    }
    if ($Value -is [array]) { return ,@($Value | ForEach-Object { Canonical $_ }) }
    return $Value
}
function Json-Equal($A, $B) {
    (ConvertTo-Json -InputObject (Canonical $A) -Depth 100 -Compress) -ceq (ConvertTo-Json -InputObject (Canonical $B) -Depth 100 -Compress)
}
function Assert-ApprovedScripts($Original, $Candidate) {
    if (-not ($Original -is [Collections.IDictionary]) -or -not ($Original['scripts'] -is [Collections.IDictionary])) { throw 'Invalid package baseline.' }
    # Clone so validation never mutates the object used by later checks.
    $expected = ($Original | ConvertTo-Json -Depth 100) | ConvertFrom-Json -AsHashtable
    $expected.scripts['android'] = 'expo run:android'
    $expected.scripts['ios'] = 'expo run:ios'
    $expected.scripts['android:start'] = 'expo start --android'
    $expected.scripts['ios:start'] = 'expo start --ios'
    if (-not (Json-Equal $expected $Candidate)) { throw 'ApprovedScripts permits only the four approved script values; unrelated package changes rejected.' }
}
function Snapshot {
    # Include metadata and candidate file bytes; do not persist secret content or hashes.
    $data = [Collections.Generic.List[string]]::new()
    $data.Add((Git-Text @('rev-parse', 'HEAD')).Trim())
    $data.Add((Digest (Invoke-Git @('ls-files', '--stage', '-z'))))
    $data.Add((Digest (Invoke-Git @('status', '--porcelain=v1', '-z', '--untracked-files=all'))))
    $data.Add((Digest (Invoke-Git @('ls-files', '-v', '-z'))))
    $indexPath = (Git-Text @('rev-parse', '--path-format=absolute', '--git-path', 'index')).Trim()
    $data.Add((Digest ([IO.File]::ReadAllBytes($indexPath))))
    foreach ($path in @((@($candidates) + @($identitySources)) | Sort-Object -Unique -CaseSensitive)) {
        $file = Relative-Path $path
        if ([IO.File]::Exists($file)) {
            $item = Get-Item -Force -LiteralPath $file
            $data.Add("$path|$($item.Length)|$($item.LastWriteTimeUtc.Ticks)|$(Digest ([IO.File]::ReadAllBytes($file)))")
        } else { $data.Add("$path|absent") }
    }
    Digest $utf8.GetBytes(($data -join "`n"))
}
function Safe-Label([string]$Path) {
    if ($denied.ContainsKey($Path)) { return '[excluded path]' }
    # JSON string quoting keeps Markdown/newlines/control syntax from forging manifest sections.
    ConvertTo-Json -InputObject $Path -Compress
}
function Protection-Reason([string]$Path) {
    $reason = $null
    if ($Path -match '(?i)(^|/)(\.env[^/]*|\.aws|\.ssh|node_modules|\.expo|\.git|dist|web-build|android|ios|backups?|dumps?|profiles?|logs?|credentials?[^/]*|secrets?[^/]*|tokens?[^/]*)(/|$)' -or
        $Path -match '(?i)(\.(sqlite[^/]*|db(?:-wal|-shm|-journal)?|pem|key|p12|p8|jks|keystore|mobileprovision|log|bak|dump|sql)$|(^|/)[^/]*(?:backup|credential|secret|token)[^/]*$)') {
        $reason = 'sensitive/generated default'
    }
    foreach ($exclude in $exclusions) {
        if ($Path.Equals($exclude, [StringComparison]::OrdinalIgnoreCase) -or $Path.StartsWith($exclude + '/', [StringComparison]::OrdinalIgnoreCase)) { $reason = 'explicit path exclusion' }
    }
    if ($Path -ieq 'package.json' -and $PackageJsonPolicy -eq 'ProtectPersonal') { $reason = 'protected personal package.json (scripts review incomplete)' }
    return $reason
}
function Write-External([string]$Path, [byte[]]$Bytes) {
    if (-not (Is-Within $Path $out)) { throw 'Output escapes bundle.' }
    Assert-NoLinks $Path
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Path)) | Out-Null
    Assert-NoLinks $Path
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($Bytes) } finally { $stream.Dispose() }
}

try {
    $repo = (Git-Text @('rev-parse', '--show-toplevel')).Trim()
    $repo = [IO.Path]::GetFullPath($repo)
    Assert-NoLinks $repo
    if ((Git-Text @('rev-parse', '--is-bare-repository')).Trim() -ne 'false') { throw 'Working tree required.' }
    $base = Resolve-Commit $Baseline
    $head = Resolve-Commit 'HEAD'
    $branch = (Git-Text @('rev-parse', '--abbrev-ref', 'HEAD')).Trim()
    # Even --no-textconv does not disable clean/process attribute filters. Override
    # registered drivers for child Git processes only; never change Git configuration.
    foreach ($setting in @(Nul-Items (Invoke-Git @('config', '--null', '--list')))) {
        $key = ($setting -split "`n", 2)[0]
        if ($key -match '^(filter\..+)\.(clean|process|smudge|required)$') {
            $driver = $Matches[1]
            foreach ($suffix in @('clean', 'process', 'smudge', 'required')) {
                $gitOverrides.Add('-c')
                $gitOverrides.Add("$driver.$suffix=$(if ($suffix -eq 'required') { 'false' } else { '' })")
            }
        }
    }
    $inventoryStart = (Git-Text @('rev-parse', 'HEAD')) + (Digest (Invoke-Git @('ls-files', '--stage', '-z'))) + (Digest (Invoke-Git @('status', '--porcelain=v1', '-z', '--untracked-files=all')))
    $out = [IO.Path]::GetFullPath($OutputDirectory)
    Assert-NoLinks $out
    if (Test-Path -LiteralPath $out) { throw 'OutputDirectory must not already exist.' }
    foreach ($protectedRoot in @($repo, (Git-Text @('rev-parse', '--path-format=absolute', '--git-common-dir')).Trim(), (Git-Text @('rev-parse', '--absolute-git-dir')).Trim())) {
        if (Is-Within $out $protectedRoot) { throw 'OutputDirectory must be external to working tree and Git metadata.' }
    }
    $exclusions = @($ExcludePath | ForEach-Object {
        $path = $_.TrimEnd('/')
        $null = Relative-Path $path
        $path
    })
    $layers = [ordered]@{
        committed = @(Changes @($base, $head))
        staged = @(Changes @('--cached', $head))
        unstaged = @(Changes @())
        net = @(Changes @($base))
    }
    $phase = 'inventory, exclusion and consistency checks'
    $newFiles = @(Nul-Items (Invoke-Git @('ls-files', '--others', '--exclude-standard', '-z')))
    $candidates = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($layer in $layers.Values) { foreach ($entry in $layer) { $null = $candidates.Add($entry.Path) } }
    foreach ($path in $newFiles) { $null = Relative-Path $path; $null = $candidates.Add($path) }
    # Identity sources are independent of changed/exportable candidates. Enumerate
    # metadata only: unchanged protected tracked sources must also protect exact copies.
    $identitySources = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $trackedByRef = @{}
    # Reject unmerged, sparse, assume-unchanged, symlink and submodule candidates: no incomplete claims.
    if ((Invoke-Git @('ls-files', '--unmerged', '-z')).Length) { throw 'Unmerged index not supported.' }
    foreach ($entry in @(Nul-Items (Invoke-Git @('ls-files', '-v', '-z')))) {
        if ($entry[0] -ceq 'S' -or [char]::IsLower($entry[0])) { throw 'Sparse/assume-unchanged index not supported.' }
    }
    foreach ($ref in @($base, $head)) {
        $trackedByRef[$ref] = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($entry in @(Nul-Items (Invoke-Git @('ls-tree', '-r', '-z', $ref)))) {
            if ($entry -notmatch '^(\d{6}) \S+ [0-9a-f]+\t(.+)$') { throw 'Unexpected tree metadata.' }
            $mode = $Matches[1]; $path = $Matches[2]
            $null = $trackedByRef[$ref].Add($path)
            $protected = Protection-Reason $path
            if ($mode -in @('120000', '160000') -and ($candidates.Contains($path) -or $protected)) { throw 'Historical links/submodules cannot be exported or used as identity sources.' }
            if ($protected) { $null = $identitySources.Add($path) }
        }
    }
    $trackedByRef[''] = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($entry in @(Nul-Items (Invoke-Git @('ls-files', '--stage', '-z')))) {
        if ($entry -notmatch '^(\d{6}) [0-9a-f]+ \d\t(.+)$') { throw 'Unexpected index metadata.' }
        $mode = $Matches[1]; $path = $Matches[2]
        $null = $trackedByRef[''].Add($path)
        $protected = Protection-Reason $path
        if ($mode -in @('120000', '160000') -and ($candidates.Contains($path) -or $protected)) { throw 'Index links/submodules cannot be exported or used as identity sources.' }
        if ($protected) { $null = $identitySources.Add($path) }
    }
    $before = Snapshot
    $inventoryNow = (Git-Text @('rev-parse', 'HEAD')) + (Digest (Invoke-Git @('ls-files', '--stage', '-z'))) + (Digest (Invoke-Git @('status', '--porcelain=v1', '-z', '--untracked-files=all')))
    if ($inventoryNow -cne $inventoryStart -or (Resolve-Commit 'HEAD') -ne $head) { throw 'Concurrent modification detected during inventory.' }
    $denied = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    foreach ($path in $candidates) {
        $reason = Protection-Reason $path
        if ($reason) { $denied[$path] = $reason }
    }
    $renamePairs = @(
        @(Changes @($base, $head) $true)
        @(Changes @('--cached', $head) $true)
        @(Changes @() $true)
        @(Changes @($base) $true)
    ) | Where-Object { $_.Other }
    do {
        $propagated = $false
        foreach ($pair in $renamePairs) {
            if ($denied.ContainsKey($pair.Path) -or $denied.ContainsKey($pair.Other)) {
                foreach ($path in @($pair.Path, $pair.Other)) {
                    if (-not $denied.ContainsKey($path)) { $denied[$path] = 'protected rename endpoint'; $propagated = $true }
                }
            }
        }
    } while ($propagated)
    # Keep sources/bytes/hashes in memory, never add unchanged sources to exported
    # inventories or exclusions. Include baseline, HEAD, index and present working bytes.
    $privateHashes = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($path in @((@($identitySources) + @($denied.Keys)) | Sort-Object -Unique -CaseSensitive)) {
        foreach ($ref in @($base, $head, '')) {
            if ($trackedByRef[$ref].Contains($path)) {
                # An existing protected version that cannot be read is a failure,
                # not a missing source that can be silently ignored.
                $null = $privateHashes.Add((Digest (Invoke-Git @('show', "${ref}:$path"))))
            }
        }
        $file = Relative-Path $path
        if ([IO.File]::Exists($file)) { $null = $privateHashes.Add((Digest ([IO.File]::ReadAllBytes($file)))) }
    }
    foreach ($path in $candidates) {
        if ($denied.ContainsKey($path)) { continue }
        $file = Relative-Path $path
        if ([IO.File]::Exists($file) -and $privateHashes.Contains((Digest ([IO.File]::ReadAllBytes($file))))) { $denied[$path] = 'protected content identity'; continue }
        foreach ($ref in @($base, $head, '')) {
            try {
                if ($privateHashes.Contains((Digest (Invoke-Git @('show', "${ref}:$path"))))) { $denied[$path] = 'protected historical content identity'; break }
            } catch { }
        }
    }
    if ($PackageJsonPolicy -eq 'ApprovedScripts') {
        $phase = 'ApprovedScripts policy validation'
        $original = Read-Package $base
        $current = Parse-PackageJson ([IO.File]::ReadAllText((Relative-Path 'package.json'), $utf8))
        Assert-ApprovedScripts $original $current
        # Any exported baseline content is authorized by the explicit policy; historical
        # HEAD/index content must be either baseline or that same approved scripts state.
        foreach ($ref in @($head, '')) {
            $version = Read-Package $ref
            if (-not (Json-Equal $original $version)) { Assert-ApprovedScripts $original $version }
        }
    }
    if ($PackageJsonPolicy -eq 'Incorporated') {
        $phase = 'Incorporated checkpoint validation'
        $checkpoint = Resolve-Commit $ScriptsCheckpoint
        $null = Invoke-Git @('merge-base', '--is-ancestor', $checkpoint, $head)
        $parents = (Git-Text @('rev-list', '--parents', '-n', '1', $checkpoint)).Trim().Split(' ')
        if ($parents.Count -ne 2) { throw 'ScriptsCheckpoint must be a non-merge incorporation commit.' }
        Assert-ApprovedScripts (Read-Package $parents[1]) (Read-Package $checkpoint)
        $null = Invoke-Git @('merge-base', '--is-ancestor', $base, $checkpoint)
    }
    if ($Boundary -eq 'Complete') {
        $phase = 'Complete boundary validation'
        if ($PackageJsonPolicy -ne 'Incorporated') { throw 'Complete requires Incorporated and a valid ScriptsCheckpoint.' }
        # Complete is specific to this approved feature, not an arbitrary smaller boundary.
        if ($base -ne 'f234faaa2955ee2ce5ed2da95bd2a69c026a482f') { throw 'Complete requires the integrated feature baseline f234faa.' }
        if ($denied.Count) { throw 'Complete rejected: changed paths are excluded; request an honest partial Section bundle.' }
    }
    if ((Snapshot) -ne $before) { throw 'Concurrent modification detected before export.' }
    $phase = 'external export and consistency verification'
    Assert-NoLinks $out
    [IO.Directory]::CreateDirectory($out) | Out-Null
    $outputCreated = $true
    [IO.Directory]::CreateDirectory([IO.Path]::Combine($out, 'untracked')) | Out-Null
    $patch = [IO.MemoryStream]::new()
    try {
        # Per-path invocation avoids Windows command-line limits. No content is requested
        # from Git for excluded paths, and no unfiltered temporary patch is created.
        foreach ($path in @($layers.net | ForEach-Object { $_.Path } | Sort-Object -CaseSensitive)) {
            if ($denied.ContainsKey($path)) { continue }
            $null = Relative-Path $path
            $bytes = Invoke-Git @('diff', '--no-ext-diff', '--no-textconv', '--binary', '--full-index', '--no-renames', '--no-color', '--src-prefix=a/', '--dst-prefix=b/', $base, '--', $path)
            $patch.Write($bytes)
        }
        Write-External ([IO.Path]::Combine($out, 'net.patch')) $patch.ToArray()
    } finally { $patch.Dispose() }
    $hashes = [Collections.Generic.List[string]]::new()
    foreach ($path in $newFiles) {
        if ($denied.ContainsKey($path)) { continue }
        $bytes = [IO.File]::ReadAllBytes((Relative-Path $path))
        Write-External ([IO.Path]::Combine($out, 'untracked', $path)) $bytes
        $hashes.Add("- $(Safe-Label $path): SHA256 $(Digest $bytes)")
    }
    if ((Snapshot) -ne $before) { throw 'Concurrent modification detected during export; bundle INVALID.' }
    $lines = [Collections.Generic.List[string]]::new()
    $lines.Add('# Review bundle')
    $lines.Add("Boundary: $Boundary; $(if ($denied.Count -or $PackageJsonPolicy -eq 'ProtectPersonal') { 'PARTIAL / incomplete' } else { 'permitted scope; external reviewer must confirm scope' })")
    $lines.Add("Branch: $(ConvertTo-Json -InputObject $branch -Compress)")
    $lines.Add("HEAD: $head; baseline: $base")
    $lines.Add("PowerShell: $($PSVersionTable.PSVersion); Git: $((Git-Text @('--version')).Trim())")
    $lines.Add("PackageJsonPolicy: $PackageJsonPolicy; ScriptsCheckpoint: $(if ($PackageJsonPolicy -eq 'Incorporated') { $checkpoint } else { 'not incorporated' })")
    $lines.Add('net.patch is the FINAL tracked result, NOT intermediate content/history. Renames are D+A. Layer lists are inventories, not concatenable patches. Ignored untracked files are not exported.')
    foreach ($name in $layers.Keys) {
        $lines.Add("`n## $name")
        foreach ($entry in $layers[$name]) { $lines.Add("- $($entry.State) $(Safe-Label $entry.Path)") }
    }
    $lines.Add("`n## Cancelled in net")
    $netPaths = @($layers.net | ForEach-Object { $_.Path })
    foreach ($path in @($candidates | Sort-Object -CaseSensitive)) {
        if ($path -notin $netPaths -and $path -notin $newFiles) { $lines.Add("- $(Safe-Label $path)") }
    }
    $lines.Add("`n## Git status (sanitized; layer inventories above provide affected paths)")
    $status = @(Nul-Items (Invoke-Git @('status', '--porcelain=v1', '-z', '--untracked-files=all')))
    for ($i = 0; $i -lt $status.Count; $i++) {
        $entry = $status[$i]; $code = $entry.Substring(0, 2); $path = $entry.Substring(3)
        $lines.Add("- [$code] $(Safe-Label $path)")
        if ($code -match '[RC]') { $lines.Add("  from $(Safe-Label $status[++$i])") }
    }
    $lines.Add("`n## Untracked allowed bytes")
    foreach ($entry in $hashes) { $lines.Add($entry) }
    $lines.Add("`n## Exclusions")
    foreach ($path in @($denied.Keys | Sort-Object -CaseSensitive)) { $lines.Add("- [excluded path]: $($denied[$path])") }
    foreach ($exclude in $exclusions) { $lines.Add('- Explicit file/subtree exclusion supplied (path redacted).') }
    $lines.Add('Protection is path-based plus detected rename/content identity, not universal secret discovery. Exact copies from protected tracked sources include unchanged sources. Modified copies and copies from ignored/untracked secret sources may evade identity checks: declare exclusions with -ExcludePath and manually inspect the bundle. No tests/user commands ran; no source/index writes. Capture is not atomic; detected concurrent changes invalidate it.')
    $lines.Add("net.patch SHA256: $(Digest ([IO.File]::ReadAllBytes([IO.Path]::Combine($out, 'net.patch'))))")
    Write-External ([IO.Path]::Combine($out, 'manifest.md')) $utf8.GetBytes(($lines -join "`n") + "`n")
    if ((Snapshot) -ne $before) { throw 'Concurrent modification detected at final check; bundle INVALID.' }
    Write-Output "Review bundle created: $out"
} catch {
    if ($outputCreated) {
        # Keep evidence, never recursively delete a user-supplied destination.
        $manifest = [IO.Path]::Combine($out, 'manifest.md')
        try {
            Assert-NoLinks $manifest
            [IO.File]::WriteAllText($manifest, "# INVALID / INCOMPLETE bundle`nGeneration failed; do not use these artifacts for review. Re-run into a new external directory.`n", $utf8)
        } catch { }
    }
    # Parser/I/O exceptions may contain private content or filenames. Export only a
    # fixed phase diagnostic, never the raw exception message or Git stderr.
    Write-Error "Review bundle failed during $phase. Invalid input/policy, unsafe or unsupported state, I/O failure or concurrent changes; no valid complete bundle was produced." -ErrorAction Continue
    exit 1
}
