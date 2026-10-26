param([Parameter(Mandatory=$true)][string]$PdfBoxJar,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$expected='768847238f683568507bf73570a2b6fedcbe58b25c7b4f97fba536ba110b290fe96ba065aed58629d41fb94857d76bc1978c2f31d294b553c69f287f71ee9600'
if((Get-FileHash -LiteralPath $PdfBoxJar -Algorithm SHA512).Hash.ToLowerInvariant() -ne $expected){throw 'Pinned independent verifier checksum mismatch'}
$base=[IO.Path]::GetFullPath($PSScriptRoot);$dest=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $dest){throw 'Deliverable exists; choose a new version, never overwrite evidence'}
$files=@(Get-ChildItem -LiteralPath $base -Recurse -File|Where-Object {$_.FullName -notmatch '[\\/]node_modules[\\/]' -and $_.Extension -in '.mjs','.cjs','.js','.json','.md','.ps1','.java','.pdf','.xml','.bin'}|Sort-Object FullName)
$inventory=@()
foreach($file in $files){
 if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'No symlink/reparse source in export'}
 if($file.Extension -in '.json','.md','.mjs','.cjs','.js','.ps1','.java'){
  $raw=[IO.File]::ReadAllText($file.FullName)
  if($raw -match 'agc_[a-f0-9]{64}|-----BEGIN (RSA |EC )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.') {throw ('Secret-like material rejected: '+$file.Name)}
 }
 $relative=$file.FullName.Substring($base.Length+1).Replace('\','/')
 $inventory+=@{path=$relative;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant();bytes=$file.Length}
}
$revision=(& git -C $base rev-parse HEAD).Trim();if($LASTEXITCODE -ne 0){throw 'Source revision required'}
$manifest=@{schemaVersion='UnifiedWorkbenchPackage/v1';generatedAt=[DateTimeOffset]::UtcNow.ToString('o');sourceRevision=$revision;files=$inventory;verifier=@{path='verify/pdfbox-app-3.0.8.jar';sha512=$expected;source='https://repo.maven.apache.org/maven2/org/apache/pdfbox/pdfbox-app/3.0.8/pdfbox-app-3.0.8.jar'};signingStarts=0;secretsIncluded=0;realProviderUat='NOT_EXECUTED'}|ConvertTo-Json -Depth 12
[IO.Directory]::CreateDirectory((Split-Path -Parent $dest))|Out-Null
$stream=[IO.File]::Open($dest,[IO.FileMode]::CreateNew)
$zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create,$false)
try{
 foreach($file in $files){$relative=$file.FullName.Substring($base.Length+1).Replace('\','/');[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal)|Out-Null}
 [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$PdfBoxJar,'verify/pdfbox-app-3.0.8.jar',[IO.Compression.CompressionLevel]::Optimal)|Out-Null
 $entry=$zip.CreateEntry('PACKAGE-MANIFEST.json');$writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false));try{$writer.Write($manifest)}finally{$writer.Dispose()}
 $jar=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $PdfBoxJar))
 try{foreach($name in @('META-INF/LICENSE','META-INF/NOTICE')){$source=$jar.GetEntry($name);if($source){$target=$zip.CreateEntry('verify/'+$name.Replace('/','-')+'.txt');$input=$source.Open();$output=$target.Open();try{$input.CopyTo($output)}finally{$input.Dispose();$output.Dispose()}}}}finally{$jar.Dispose()}
}finally{$zip.Dispose();$stream.Dispose()}
# Re-open and verify every exported source byte against the manifest.
$proof=[IO.Compression.ZipFile]::OpenRead($dest)
try{foreach($file in $inventory){$entry=$proof.GetEntry($file.path);if(!$entry){throw 'Missing ZIP entry'};$input=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create();try{$digest=([BitConverter]::ToString($sha.ComputeHash($input))).Replace('-','').ToLowerInvariant();if($digest -ne $file.sha256){throw 'ZIP entry hash mismatch'}}finally{$input.Dispose();$sha.Dispose()}}}finally{$proof.Dispose()}
[ordered]@{status='PACKAGE_VERIFIED';path=$dest;sha256=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant();sourceRevision=$revision;files=$files.Count;bytes=(Get-Item -LiteralPath $dest).Length;signingStarts=0;secretsIncluded=0}|ConvertTo-Json
