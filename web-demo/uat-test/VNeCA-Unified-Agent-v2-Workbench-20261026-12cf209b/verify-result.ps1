param([Parameter(Mandatory=$true)][ValidateSet('PDF','CMS','XML')][string]$Format,[Parameter(Mandatory=$true)][string]$Artifact,[Parameter(Mandatory=$true)][string]$Original,[Parameter(Mandatory=$true)][string]$Leaf,[Parameter(Mandatory=$true)][string]$TrustedRoots,[Parameter(Mandatory=$true)][string]$Intermediates,[Parameter(Mandatory=$true)][string]$Crls,[string]$PdfBoxJar=(Join-Path $PSScriptRoot 'verify/pdfbox-app-3.0.8.jar'),[string]$JavaHome=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
if(!$JavaHome){throw 'Set JAVA_HOME to an installed JDK21; no automatic trust installation.'}
$expected='768847238f683568507bf73570a2b6fedcbe58b25c7b4f97fba536ba110b290fe96ba065aed58629d41fb94857d76bc1978c2f31d294b553c69f287f71ee9600'
if((Get-FileHash -LiteralPath $PdfBoxJar -Algorithm SHA512).Hash.ToLowerInvariant() -ne $expected){throw 'Pinned Apache PDFBox3.0.8 checksum mismatch'}
$taskClasses=Join-Path ([IO.Path]::GetTempPath()) ('vneca-independent-verify-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskClasses|Out-Null
$sources=@(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'verify') -Filter '*.java'|ForEach-Object FullName)
$taskPriorError=$ErrorActionPreference;$ErrorActionPreference='Continue'
$taskCompileOutput=(& (Join-Path $JavaHome 'bin/javac.exe') -cp $PdfBoxJar -d $taskClasses $sources 2>&1|Out-String);$taskCompileExit=$LASTEXITCODE
$ErrorActionPreference=$taskPriorError
if($taskCompileExit -ne 0){Write-Output $taskCompileOutput;throw 'Independent verifier compile failed; NOT_CHECKED'}
$ErrorActionPreference='Continue'
$taskVerifyOutput=(& (Join-Path $JavaHome 'bin/java.exe') -cp ($taskClasses+[IO.Path]::PathSeparator+$PdfBoxJar) dev.vneca.test.unified.VerifyResult $Format $Artifact $Original $Leaf $TrustedRoots $Intermediates $Crls 2>&1|Out-String);$taskVerifyExit=$LASTEXITCODE
$ErrorActionPreference=$taskPriorError
$taskJson=@($taskVerifyOutput -split '\r?\n'|Where-Object {$_ -match '^\{"status"'})
if($taskVerifyExit -ne 0 -or $taskJson.Count -ne 1){throw 'Independent verification FAIL; do not mark cryptography PASS'}
$taskResult=$taskJson[0]|ConvertFrom-Json
if($taskResult.status -ne 'PASS'){throw 'Independent verification FAIL'}
Write-Output $taskJson[0]
# Retain the uniquely named compiled source output for review; no input/history is deleted.
