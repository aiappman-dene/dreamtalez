param(
  [Parameter(Mandatory=$true)][string]$KeystorePath,
  [Parameter(Mandatory=$true)][string]$Alias,
  [string]$StorePass
)

if (-not (Test-Path $KeystorePath)) {
  Write-Error "Keystore not found: $KeystorePath"
  exit 2
}

if (-not $StorePass) {
  $StorePass = Read-Host -AsSecureString "Keystore password"
  $StorePass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($StorePass))
}

$output = & keytool -list -v -keystore $KeystorePath -alias $Alias -storepass $StorePass 2>&1
$line = $output | Select-String 'SHA256:' -SimpleMatch
if ($line) {
  $parts = $line -split ':'
  $fingerprint = $parts[-1].Trim()
  Write-Output $fingerprint
} else {
  Write-Error "SHA256 fingerprint not found in keytool output"
  exit 3
}
