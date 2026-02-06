<#
.SYNOPSIS
    Monitor serial TCP do Renode (RP2040)

.DESCRIPTION
    Conecta ao UART TCP e exibe output formatado.
    Destaca eventos GPIO (G:pin=X,v=Y).

.PARAMETER Port
    Porta TCP (padrão: 1234)

.EXAMPLE
    .\monitor-serial.ps1
    .\monitor-serial.ps1 -Port 1234

.NOTES
    Autor: NeuroForge Team
    Data: 06/02/2026
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [int]$Port = 1234,
    
    [Parameter(Mandatory=$false)]
    [string]$Host = "localhost"
)

$ErrorActionPreference = "Stop"

# Cores
$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorGpio = "Magenta"
$ColorTimestamp = "Gray"
$ColorError = "Red"

function Write-Header {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $ColorInfo
    Write-Host "  📡 NeuroForge Serial Monitor - RP2040" -ForegroundColor $ColorInfo
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $ColorInfo
    Write-Host "  Host: $Host" -ForegroundColor $ColorTimestamp
    Write-Host "  Port: $Port" -ForegroundColor $ColorTimestamp
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor $ColorInfo
}

Write-Header

try {
    Write-Host "🔄 Conectando a $Host`:$Port..." -ForegroundColor $ColorInfo
    
    $client = New-Object System.Net.Sockets.TcpClient($Host, $Port)
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    
    Write-Host "✅ Conectado!" -ForegroundColor $ColorSuccess
    Write-Host "📡 Aguardando dados (Ctrl+C para sair)...`n" -ForegroundColor $ColorInfo
    
    $lineCount = 0
    $gpioCount = 0
    $startTime = Get-Date
    
    while ($true) {
        try {
            $line = $reader.ReadLine()
            
            if ($line) {
                $timestamp = Get-Date -Format "HH:mm:ss.fff"
                
                # GPIO events
                if ($line -match "G:pin=(\d+),v=([01])") {
                    $pin = $matches[1]
                    $value = $matches[2]
                    $state = if ($value -eq "1") { "HIGH" } else { "LOW " }
                    
                    Write-Host "[$timestamp] " -NoNewline -ForegroundColor $ColorTimestamp
                    Write-Host "🔌 GPIO Pin $pin = $state" -ForegroundColor $ColorGpio
                    $gpioCount++
                }
                # Outras linhas
                else {
                    Write-Host "[$timestamp] " -NoNewline -ForegroundColor $ColorTimestamp
                    Write-Host $line -ForegroundColor White
                }
                
                $lineCount++
            }
        } catch [System.IO.IOException] {
            Write-Host "`n⚠️ Conexão perdida" -ForegroundColor Yellow
            break
        }
    }
} catch [System.Net.Sockets.SocketException] {
    Write-Host "❌ Erro ao conectar em $Host`:$Port" -ForegroundColor $ColorError
    Write-Host "Certifique-se de que o Renode está rodando" -ForegroundColor Yellow
    exit 1
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor $ColorError
    exit 1
} finally {
    if ($client) {
        $client.Close()
        
        $duration = (Get-Date) - $startTime
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $ColorInfo
        Write-Host "📊 Estatísticas" -ForegroundColor $ColorInfo
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $ColorInfo
        Write-Host "Linhas: $lineCount" -ForegroundColor $ColorTimestamp
        Write-Host "GPIO Events: $gpioCount" -ForegroundColor $ColorGpio
        Write-Host "Duração: $([math]::Round($duration.TotalSeconds, 1))s" -ForegroundColor $ColorTimestamp
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor $ColorInfo
    }
}
