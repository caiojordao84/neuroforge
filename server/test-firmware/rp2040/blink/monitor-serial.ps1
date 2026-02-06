<#
.SYNOPSIS
    Monitor serial TCP do Renode para RP2040

.DESCRIPTION
    Conecta ao terminal serial TCP do Renode e exibe output formatado.
    Destaca eventos GPIO do protocolo NeuroForge (G:pin=X,v=Y).

.PARAMETER Port
    Porta TCP do serial (padrão: 1234)

.PARAMETER Host
    Host do Renode (padrão: localhost)

.EXAMPLE
    .\monitor-serial.ps1
    .\monitor-serial.ps1 -Port 1234
    .\monitor-serial.ps1 -Host 192.168.1.100 -Port 5555

.NOTES
    Autor: NeuroForge Team
    Data: 06/02/2026
    Requer: PowerShell 5.1+, Renode rodando
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
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorGpio = "Magenta"
$ColorTimestamp = "Gray"

function Write-Header {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $ColorInfo
    Write-Host "  📡 NeuroForge Serial Monitor - RP2040" -ForegroundColor $ColorInfo
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $ColorInfo
    Write-Host "  Host: $Host" -ForegroundColor $ColorTimestamp
    Write-Host "  Port: $Port" -ForegroundColor $ColorTimestamp
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor $ColorInfo
}

function Format-SerialLine {
    param(
        [string]$Line,
        [string]$Timestamp
    )
    
    # Detectar protocolo GPIO
    if ($Line -match "G:pin=(\d+),v=([01])") {
        $pin = $matches[1]
        $value = $matches[2]
        $state = if ($value -eq "1") { "HIGH" } else { "LOW " }
        
        Write-Host "[$Timestamp] " -NoNewline -ForegroundColor $ColorTimestamp
        Write-Host "🔌 GPIO " -NoNewline -ForegroundColor $ColorGpio
        Write-Host "Pin $pin = $state" -ForegroundColor $ColorGpio
    }
    # Detectar mensagens de erro
    elseif ($Line -match "(error|fail|exception)") {
        Write-Host "[$Timestamp] " -NoNewline -ForegroundColor $ColorTimestamp
        Write-Host $Line -ForegroundColor $ColorError
    }
    # Detectar mensagens de aviso
    elseif ($Line -match "(warn|warning)") {
        Write-Host "[$Timestamp] " -NoNewline -ForegroundColor $ColorTimestamp
        Write-Host $Line -ForegroundColor $ColorWarning
    }
    # Linhas normais
    else {
        Write-Host "[$Timestamp] " -NoNewline -ForegroundColor $ColorTimestamp
        Write-Host $Line -ForegroundColor White
    }
}

Write-Header

try {
    Write-Host "🔄 Conectando a $Host`:$Port..." -ForegroundColor $ColorInfo
    
    $client = New-Object System.Net.Sockets.TcpClient($Host, $Port)
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    
    Write-Host "✅ Conectado com sucesso!" -ForegroundColor $ColorSuccess
    Write-Host "📡 Aguardando dados (Ctrl+C para sair)...`n" -ForegroundColor $ColorInfo
    
    # Estatísticas
    $lineCount = 0
    $gpioCount = 0
    $startTime = Get-Date
    
    while ($true) {
        try {
            $line = $reader.ReadLine()
            
            if ($line) {
                $timestamp = Get-Date -Format "HH:mm:ss.fff"
                Format-SerialLine -Line $line -Timestamp $timestamp
                
                $lineCount++
                if ($line -match "G:pin=") {
                    $gpioCount++
                }
            }
        } catch [System.IO.IOException] {
            Write-Host "`n⚠️ Conexão perdida com o servidor" -ForegroundColor $ColorWarning
            break
        }
    }
} catch [System.Net.Sockets.SocketException] {
    Write-Host "❌ Erro ao conectar em $Host`:$Port" -ForegroundColor $ColorError
    Write-Host "Certifique-se de que o Renode está rodando e a porta está correta" -ForegroundColor $ColorWarning
    exit 1
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor $ColorError
    exit 1
} finally {
    if ($client) {
        $client.Close()
        
        # Mostrar estatísticas
        $duration = (Get-Date) - $startTime
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $ColorInfo
        Write-Host "📊 Estatísticas da Sessão" -ForegroundColor $ColorInfo
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $ColorInfo
        Write-Host "Linhas recebidas: $lineCount" -ForegroundColor $ColorTimestamp
        Write-Host "Eventos GPIO: $gpioCount" -ForegroundColor $ColorGpio
        Write-Host "Duração: $([math]::Round($duration.TotalSeconds, 1))s" -ForegroundColor $ColorTimestamp
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor $ColorInfo
    }
}
