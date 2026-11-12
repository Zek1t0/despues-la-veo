#requires -Version 7.2
[CmdletBinding()]
param([string]$EvidenceDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('dlv-review-tests-' + [guid]::NewGuid().ToString('N'))))
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$helper = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../scripts/New-ReviewBundle.ps1'))
$root = [IO.Path]::GetFullPath($EvidenceDirectory)
if (Test-Path -LiteralPath $root) { throw 'EvidenceDirectory must be new.' }
if ($root.StartsWith([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..')) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixtures must be external.' }
[IO.Directory]::CreateDirectory($root) | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false)
$checks = [Collections.Generic.List[string]]::new()
$skips = [Collections.Generic.List[string]]::new()
$git = (Get-Command git -CommandType Application | Select-Object -First 1).Source
$env:GIT_OPTIONAL_LOCKS = '0'
$pwsh = (Get-Process -Id $PID).Path
function Assert([bool]$Condition, [string]$Name) {
    if (-not $Condition) { throw "FAIL: $Name" }
    $checks.Add($Name); Write-Host "PASS: $Name"
}
function Git([string[]]$Arguments) {
    $result = & $git -C $script:fixture -c core.autocrlf=false -c core.fsmonitor=false -c filter.fixture.clean= -c filter.fixture.process= -c filter.fixture.required=false @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Fixture Git failed: $($Arguments[0]) $result" }
    return ($result -join "`n")
}
function Put([string]$Name, [string]$Text) {
    $p = Join-Path $script:fixture $Name
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($p)) | Out-Null
    [IO.File]::WriteAllText($p, $Text, $utf8)
}
function Bytes([string]$Name, [byte[]]$Data) { [IO.File]::WriteAllBytes((Join-Path $script:fixture $Name), $Data) }
function Hash([string]$Path) { [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($Path))) }
function State {
    $lines = @((Git @('rev-parse', 'HEAD')), (Hash (Join-Path $script:fixture '.git/index')), (Hash (Join-Path $script:fixture '.git/config')), (Git @('status', '--porcelain=v1', '--untracked-files=all')))
    foreach ($f in Get-ChildItem -LiteralPath $script:fixture -Recurse -File -Force | Where-Object { $_.FullName -notlike '*\.git\*' -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | Sort-Object FullName -CaseSensitive) {
        $lines += $f.FullName + '=' + (Hash $f.FullName)
    }
    $lines -join "`n"
}
function Start-Helper([string]$Destination, [string[]]$Extra = @(), [string]$Ref = $script:base) {
    $info = [Diagnostics.ProcessStartInfo]::new($pwsh)
    $info.WorkingDirectory = $script:fixture
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    foreach ($arg in @('-NoProfile', '-File', $helper, '-Baseline', $Ref, '-OutputDirectory', $Destination) + $Extra) { $info.ArgumentList.Add($arg) }
    $p = [Diagnostics.Process]::new(); $p.StartInfo = $info
    $null = $p.Start()
    return $p
}
function Finish-Helper($Process, [string]$Name) {
    $stdout = $Process.StandardOutput.ReadToEndAsync()
    $stderr = $Process.StandardError.ReadToEndAsync()
    $Process.WaitForExit()
    $text = $stdout.GetAwaiter().GetResult() + $stderr.GetAwaiter().GetResult()
    [IO.File]::WriteAllText((Join-Path $root ($Name + '.log')), $text, $utf8)
    $code = $Process.ExitCode; $Process.Dispose()
    return $code
}
function Run([string]$Name, [string[]]$Extra = @(), [string]$Ref = $script:base, [string]$Destination = (Join-Path $root $Name)) {
    $old = State
    $code = Finish-Helper (Start-Helper $Destination $Extra $Ref) $Name
    $after = State
    if ($after -cne $old) {
        # State contains synthetic private-source hashes. Keep even failure diagnostics
        # free of those values; comparisons stay in memory.
        [IO.File]::WriteAllText((Join-Path $root ($Name + '-state-mismatch.txt')), 'Fixture state changed; raw state/hash snapshots intentionally not logged.', $utf8)
    }
    Assert ($after -ceq $old) "$Name preserves HEAD/index/working bytes"
    return [pscustomobject]@{ Code = [int]$code[-1]; Path = $Destination }
}
function Check-Run([string]$Name, [string[]]$Extra = @(), [string]$Ref = $script:base, [bool]$Success = $true, [string]$Destination = (Join-Path $root $Name)) {
    $r = Run $Name $Extra $Ref $Destination
    Assert (($r.Code -eq 0) -eq $Success) "$Name expected exit $(if ($Success) { '0' } else { 'nonzero' })"
    return $r
}
function Manifest($Result) { [IO.File]::ReadAllText((Join-Path $Result.Path 'manifest.md')) }
function No-Marker($Result, [string]$Marker) {
    foreach ($f in Get-ChildItem -LiteralPath $Result.Path -Recurse -File) {
        if ([Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($f.FullName)).Contains($Marker)) { throw 'Sensitive marker exported.' }
    }
    Assert $true 'sensitive marker absent from ALL bundle outputs'
}
try {
    $script:fixture = Join-Path $root 'fixture'
    [IO.Directory]::CreateDirectory($script:fixture) | Out-Null
    $null = Git @('init', '-q')
    $null = Git @('config', 'user.name', 'Disposable Review Test')
    $null = Git @('config', 'user.email', 'fixture@example.invalid')
    Put 'package.json' '{"name":"fixture","scripts":{"start":"expo start","android":"expo start --android","ios":"expo start --ios","web":"expo start --web"},"dependencies":{"example":"1.0.0"}}'
    Put 'package-lock.json' '{"fixture":true}'
    Put 'layer.txt' "base`n"; Put 'cancel.txt' "base`n"; Put 'delete.txt' "delete`n"; Put 'old name.txt' "rename`n"
    Put '.env.private' 'SYNTHETIC_PRIVATE_MARKER_84'; Put 'local.sqlite' 'SYNTHETIC_PRIVATE_MARKER_84'
    Put 'backups/personal.json' 'SYNTHETIC_PRIVATE_MARKER_84'; Put 'move.env' 'base'
    # DISTINCT from all changed sensitive files: this source stays tracked and unchanged.
    $unchangedMarker = 'SYNTHETIC_UNCHANGED_SOURCE_9F8C3A21_UNIQUE'
    Put '.env.identity-stable' $unchangedMarker
    Bytes 'binary.bin' ([byte[]](0..255))
    $null = Git @('add', '.'); $null = Git @('commit', '-qm', 'fixture baseline')
    $script:base = Git @('rev-parse', 'HEAD')
    # Match the real starting point: native run preferences are personal/uncommitted.
    $personal = [IO.File]::ReadAllText((Join-Path $script:fixture 'package.json')) | ConvertFrom-Json -AsHashtable
    $personal.scripts.android = 'expo run:android'; $personal.scripts.ios = 'expo run:ios'
    Put 'package.json' ($personal | ConvertTo-Json -Depth 10)
    Put 'layer.txt' "committed`n"; Put 'cancel.txt' "committed`n"
    $null = Git @('add', 'layer.txt', 'cancel.txt'); $null = Git @('commit', '-qm', 'fixture committed layer')
    Put 'layer.txt' "staged`n"; Put 'cancel.txt' "staged`n"
    $null = Git @('add', 'layer.txt', 'cancel.txt')
    Put 'layer.txt' "final`n"; Put 'cancel.txt' "base`n"
    Remove-Item -LiteralPath (Join-Path $script:fixture 'delete.txt')
    Move-Item -LiteralPath (Join-Path $script:fixture 'old name.txt') -Destination (Join-Path $script:fixture 'new ñ name.txt')
    $null = Git @('add', '--all', '--', 'old name.txt', 'new ñ name.txt')
    Put 'nuevo 日本語 file.txt' "new Unicode`n"
    Bytes 'binary.bin' ([byte[]](255..0)); Bytes 'new binary.bin' ([byte[]](0,255,0,128,13,10))
    Put '.env.private' 'SYNTHETIC_PRIVATE_MARKER_84 changed'; Put '.env.new' 'SYNTHETIC_PRIVATE_MARKER_84'
    # Stage a sensitive rename; endpoints are both denied even when the new name is innocent.
    $null = Git @('mv', '.env.private', 'innocent.txt')
    Put 'credentials.json' 'SYNTHETIC_PRIVATE_MARKER_84'
    Remove-Item -LiteralPath (Join-Path $script:fixture 'local.sqlite')
    Put 'innocent-untracked.txt' 'SYNTHETIC_PRIVATE_MARKER_84'
    $stableSource = Join-Path $script:fixture '.env.identity-stable'
    $stableHash = Hash $stableSource
    $stableBlob = Git @('rev-parse', "${script:base}:.env.identity-stable")
    Bytes 'ordinary-copy.txt' ([IO.File]::ReadAllBytes($stableSource))
    Put 'ordinary-note.txt' "Unrelated allowed content, not a private source.`n"
    $null = Check-Run 'invalid-baseline' @() 'missing-ref' $false
    $blob = Git @('rev-parse', 'HEAD:layer.txt')
    $null = Check-Run 'noncommit-baseline' @() $blob $false
    $null = Check-Run 'internal-output' @() $script:base $false (Join-Path $script:fixture 'unsafe-output')
    $existing = Join-Path $root 'existing'; [IO.Directory]::CreateDirectory($existing) | Out-Null
    $null = Check-Run 'existing-output' @() $script:base $false $existing
    $null = Check-Run 'invalid-exclusion' @('-ExcludePath', '../outside') $script:base $false
    $r = Check-Run 'layers-and-safety'
    $m = Manifest $r
    Assert ($m.Contains('PARTIAL') -and $m.Contains('protected personal package.json')) 'default personal protection is honest partial'
    Assert ($m.Contains('## committed') -and $m.Contains('## staged') -and $m.Contains('## unstaged') -and $m.Contains('## Cancelled in net')) 'separate layer inventories'
    $cancelSection = ($m -split '## Cancelled in net')[1] -split '## Git status'
    Assert ($cancelSection[0].Contains('cancel.txt')) 'cancelled net changes remain in manifest'
    Assert (-not ([IO.File]::ReadAllText((Join-Path $r.Path 'net.patch'))).Contains('cancel.txt')) 'net patch omits cancelled content'
    Assert (((Get-ChildItem -LiteralPath $r.Path).Name | Sort-Object) -join ',' -eq 'manifest.md,net.patch,untracked') 'exactly three deliverables'
    Assert ((Hash (Join-Path $r.Path 'untracked/new binary.bin')) -eq (Hash (Join-Path $script:fixture 'new binary.bin'))) 'untracked binary bytes preserved'
    Assert (Test-Path -LiteralPath (Join-Path $r.Path 'untracked/nuevo 日本語 file.txt')) 'Unicode and spaces preserved'
    No-Marker $r 'SYNTHETIC_PRIVATE_MARKER_84'
    Assert (-not (Test-Path -LiteralPath (Join-Path $r.Path 'untracked/innocent-untracked.txt'))) 'protected delete/untracked content move excluded'
    Assert ((Git @('diff', '--name-only', $script:base, '--', '.env.identity-stable')) -eq '') 'distinct sensitive source is tracked and unchanged'
    $identity = Check-Run 'unchanged-protected-copy'
    Assert (-not (Test-Path -LiteralPath (Join-Path $identity.Path 'untracked/ordinary-copy.txt'))) 'unchanged protected source copy excluded'
    No-Marker $identity $unchangedMarker
    $outputs = @(Get-ChildItem -LiteralPath $identity.Path -Recurse -File)
    $leakedHash = $false
    foreach ($file in $outputs) {
        $text = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($file.FullName)).ToUpperInvariant()
        if ($text.Contains($stableHash.ToUpperInvariant()) -or $text.Contains($stableBlob.ToUpperInvariant())) { $leakedHash = $true }
    }
    Assert (-not $leakedHash) 'protected SHA256 and Git blob identity absent from ALL outputs'
    $identityLog = [IO.File]::ReadAllText((Join-Path $root 'unchanged-protected-copy.log')).ToUpperInvariant()
    Assert (-not ($identityLog.Contains($unchangedMarker) -or $identityLog.Contains($stableHash.ToUpperInvariant()) -or $identityLog.Contains($stableBlob.ToUpperInvariant()))) 'unchanged private marker and hashes absent from invocation log'
    Assert ((Hash $stableSource) -eq $stableHash) 'unchanged protected source bytes preserved'
    Assert ((Hash (Join-Path $identity.Path 'untracked/ordinary-note.txt')) -eq (Hash (Join-Path $script:fixture 'ordinary-note.txt'))) 'ordinary unrelated untracked bytes still exported'
    # Reconstruct the final permitted tracked tree in a SECOND disposable repo.
    $originalFixture = $script:fixture
    $reconstructed = Join-Path $root 'reconstructed'
    [IO.Directory]::CreateDirectory($reconstructed) | Out-Null
    # Copy ONLY the synthetic fixture metadata; avoid local-clone shell transports.
    Copy-Item -LiteralPath (Join-Path $originalFixture '.git') -Destination (Join-Path $reconstructed '.git') -Recurse
    $script:fixture = $reconstructed
    $null = Git @('checkout', '-q', '-f', $script:base)
    $null = Git @('apply', '--binary', (Join-Path $r.Path 'net.patch'))
    Assert ((Hash (Join-Path $reconstructed 'binary.bin')) -eq (Hash (Join-Path $originalFixture 'binary.bin'))) 'binary net patch reconstruction'
    Assert ([IO.File]::ReadAllText((Join-Path $reconstructed 'layer.txt')) -eq "final`n") 'net patch reconstructs final tracked layer'
    Assert ((-not (Test-Path -LiteralPath (Join-Path $reconstructed 'delete.txt'))) -and (Test-Path -LiteralPath (Join-Path $reconstructed 'new ñ name.txt'))) 'deletion and rename reconstructed'
    $script:fixture = $originalFixture
    $explicit = Check-Run 'explicit-exclusion' @('-ExcludePath', 'layer.txt')
    Assert (-not ([IO.File]::ReadAllText((Join-Path $explicit.Path 'net.patch'))).Contains('layer.txt')) 'explicit path excluded before patch'
    $null = Check-Run 'complete-protected' @('-Boundary', 'Complete') $script:base $false
    $null = Check-Run 'scripts-not-yet-approved' @('-PackageJsonPolicy', 'ApprovedScripts') $script:base $false
    $package = [IO.File]::ReadAllText((Join-Path $script:fixture 'package.json')) | ConvertFrom-Json -AsHashtable
    $package.scripts.android = 'expo run:android'; $package.scripts.ios = 'expo run:ios'
    $package.scripts['android:start'] = 'expo start --android'; $package.scripts['ios:start'] = 'expo start --ios'
    Put 'package.json' ($package | ConvertTo-Json -Depth 10)
    $approved = Check-Run 'approved-scripts' @('-PackageJsonPolicy', 'ApprovedScripts')
    Assert (([IO.File]::ReadAllText((Join-Path $approved.Path 'net.patch'))).Contains('expo run:android')) 'approved scripts real content exported'
    $validPackage = $package | ConvertTo-Json -Depth 10
    Put 'package.json' ($validPackage -replace '^\{', '{"name":"SYNTHETIC_PRIVATE_MARKER_DUPLICATE",')
    $null = Check-Run 'duplicate-package-key' @('-PackageJsonPolicy', 'ApprovedScripts') $script:base $false
    Assert (-not ([IO.File]::ReadAllText((Join-Path $root 'duplicate-package-key.log'))).Contains('SYNTHETIC_PRIVATE_MARKER_DUPLICATE')) 'invalid package diagnostics do not leak values'
    Put 'package.json' $validPackage
    $package.dependencies.example = '2.0.0'; Put 'package.json' ($package | ConvertTo-Json -Depth 10)
    $null = Check-Run 'scripts-extra-dependency-rejected' @('-PackageJsonPolicy', 'ApprovedScripts') $script:base $false
    $package.dependencies.example = '1.0.0'; Put 'package.json' ($package | ConvertTo-Json -Depth 10)
    # Incorporation fixture must have only the script changes in its parent package diff.
    $null = Git @('add', 'package.json'); $null = Git @('commit', '-qm', 'fixture scripts incorporation')
    $checkpoint = Git @('rev-parse', 'HEAD')
    $null = Check-Run 'incorporated-invalid' @('-PackageJsonPolicy', 'Incorporated', '-ScriptsCheckpoint', $script:base) $script:base $false
    $null = Check-Run 'incorporated-missing' @('-PackageJsonPolicy', 'Incorporated') $script:base $false
    $package.dependencies.example = '2.0.0'; Put 'package.json' ($package | ConvertTo-Json -Depth 10)
    $inc = Check-Run 'incorporated-dependency-diff' @('-PackageJsonPolicy', 'Incorporated', '-ScriptsCheckpoint', $checkpoint)
    Assert (([IO.File]::ReadAllText((Join-Path $inc.Path 'net.patch'))).Contains('2.0.0')) 'incorporated includes later dependency content'
    $null = Check-Run 'complete-wrong-feature-baseline' @('-Boundary', 'Complete', '-PackageJsonPolicy', 'Incorporated', '-ScriptsCheckpoint', $checkpoint) $script:base $false
    Put 'index-link.txt' '/synthetic/external/target'
    $linkBlob = Git @('hash-object', '-w', (Join-Path $script:fixture 'index-link.txt'))
    $null = Git @('update-index', '--add', '--cacheinfo', "120000,$linkBlob,index-link.txt")
    $null = Check-Run 'index-symlink' @() $script:base $false
    $null = Git @('rm', '--cached', '--', 'index-link.txt')
    Remove-Item -LiteralPath (Join-Path $script:fixture 'index-link.txt')
    # Prove configured content filters are disabled in helper child Git processes.
    $null = Git @('config', 'filter.fixture.clean', 'this-command-must-never-run')
    $null = Git @('config', 'filter.fixture.required', 'true')
    Put '.gitattributes' 'layer.txt filter=fixture'
    $null = Check-Run 'content-filter-disabled'
    $null = Git @('config', '--remove-section', 'filter.fixture')
    Remove-Item -LiteralPath (Join-Path $script:fixture '.gitattributes')
    # Actual junction/symlink creation can be forbidden by the host. Record that limit.
    $link = Join-Path $script:fixture 'linked'
    $external = Join-Path $root 'external-target'; [IO.Directory]::CreateDirectory($external) | Out-Null
    [IO.File]::WriteAllText((Join-Path $external 'file.txt'), 'external fixture')
    $linkCreated = $false
    try {
        $null = New-Item -ItemType $(if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }) -Path $link -Target $external
        $linkCreated = $true
    } catch { $skips.Add('Filesystem input junction/symlink creation denied by host; not validated.'); Write-Host 'SKIP: filesystem input link creation denied' }
    if ($linkCreated) {
        $null = Check-Run 'reparse-input' @() $script:base $false
        # Remove only the known link itself, never recurse into its target.
        [IO.Directory]::Delete($link)
    }
    $outputLink = Join-Path $root 'output-link'
    $linkCreated = $false
    try {
        $null = New-Item -ItemType $(if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }) -Path $outputLink -Target $external
        $linkCreated = $true
    } catch { $skips.Add('Filesystem output junction/symlink creation denied by host; not validated.'); Write-Host 'SKIP: filesystem output link creation denied' }
    if ($linkCreated) { $null = Check-Run 'reparse-output' @() $script:base $false (Join-Path $outputLink 'bundle') }
    # Concurrent mutation is intentionally external to the helper; no test hook/user command parameter.
    $destination = Join-Path $root 'concurrent'
    $process = Start-Helper $destination
    $counter = 0
    while (-not $process.HasExited) {
        try { Put 'layer.txt' ("concurrent-$counter`n"); $counter++ }
        catch [IO.IOException] { } # A reader may temporarily hold a non-writable share.
        Start-Sleep -Milliseconds 15
    }
    $code = Finish-Helper $process 'concurrent'
    Assert ($code -ne 0) 'concurrent tracked modifications rejected'
    if (Test-Path -LiteralPath (Join-Path $destination 'manifest.md')) {
        Assert (([IO.File]::ReadAllText((Join-Path $destination 'manifest.md'))).Contains('INVALID')) 'failed capture marked INVALID'
    }
    Assert ((Git @('rev-parse', 'HEAD')) -eq $checkpoint) 'concurrency test helper did not create commits'
    $summary = [ordered]@{ passed = $checks.Count; failed = 0; checks = $checks; skipped = $skips; limitations = @('Fixtures only; no actual project bundle generated.', 'Complete positive path requires the real f234faa baseline and a later reviewed incorporation commit; not fabricated in fixtures.', 'Concurrent mutation test intentionally changes fixture working bytes; invariance assertions apply to all other invocations.'); evidence = $root }
    [IO.File]::WriteAllText((Join-Path $root 'result.json'), ($summary | ConvertTo-Json -Depth 6), $utf8)
    Write-Output "PASS: $($checks.Count) checks. Evidence: $root"
} catch {
    [IO.File]::WriteAllText((Join-Path $root 'failure.txt'), $_.ToString() + "`n" + $_.ScriptStackTrace, $utf8)
    Write-Error $_ -ErrorAction Continue
    exit 1
}
