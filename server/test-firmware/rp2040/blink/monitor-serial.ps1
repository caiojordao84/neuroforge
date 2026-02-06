[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [int]$Port = 1234,
    [Parameter(Mandatory = $false)]
    [string]$RemoteHost = "localhost"
)

$ErrorActionPreference = "Stop"

# Cores
$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorGpio = "Magenta"
$ColorTimestamp = "Gray"
$ColorError = "Red"

Write-Host "-----------------------------------------------------" -ForegroundColor $ColorInfo
Write-Host "  Serial Monitor - RP2040" -ForegroundColor $ColorInfo
Write-Host "-----------------------------------------------------" -ForegroundColor $ColorInfo

$client = $null
try {
    Write-Host "Connecting to $RemoteHost`:$Port..." -ForegroundColor $ColorInfo
    $client = New-Object System.Net.Sockets.TcpClient($RemoteHost, $Port)
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    
    Write-Host "Connected! (Ctrl+C to exit)`n" -ForegroundColor $ColorSuccess
    
    $lineCount = 0
    $gpioCount = 0
    $startTime = Get-Date
    
    while ($client.Connected) {
        $line = $null
        try {
            $line = $reader.ReadLine()
        }
        catch {
            Write-Host "`nConnection interupted." -ForegroundColor Yellow
            break
        }

        if ($null -eq $line) { break }

        $timestamp = Get-Date -Format "HH:mm:ss.fff"
        
        # Regex com aspas simples para evitar problemas de parsing
        if ($line -match 'G:pin=(\d+),v=([01])') {
            $pin = $Matches[1]
            $val = $Matches[2]
            $st = if ($val -eq '1') { 'HIGH' } else { 'LOW ' }
            Write-Host "[$timestamp] " -NoNewline -ForegroundColor $ColorTimestamp
            Write-Host "GPIO Pin $pin = $st" -ForegroundColor $ColorGpio
            $gpioCount++
        }
        else {
            Write-Host "[$timestamp] " -NoNewline -ForegroundColor $ColorTimestamp
            Write-Host $line -ForegroundColor White
        }
        $lineCount++
    }
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor $ColorError
}
finally {
    if ($null -ne $client) { 
        $client.Close() 
        Write-Host "`nSession ended. Lines: $lineCount, GPIO: $gpioCount" -ForegroundColor $ColorInfo
    }
}
