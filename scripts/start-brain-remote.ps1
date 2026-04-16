# NeuroForge Remote Brain Bridge
# Starts the Brain MCP Server and a Secure Tunnel

Write-Host "🌐 Initializing Remote Brain Bridge..." -ForegroundColor Cyan

# 1. Load Token
if (!(Test-Path ".env")) {
    Write-Host "❌ Error: .env file missing. Run setup first." -ForegroundColor Red
    exit 1
}
$tokenLine = Get-Content .env | Select-String "BRAIN_TOKEN="
$BRAIN_TOKEN = $tokenLine.ToString().Split("=")[1].Trim()

# 2. Start MCP Server in SSE mode (Background)
Write-Host "🚀 Starting Brain MCP Server (SSE mode)..." -ForegroundColor Green
$serverJob = Start-Job -ScriptBlock {
    param($root, $token)
    cd $root
    python scripts/brain-mcp/brain_mcp.py --transport sse --port 8080 --token $token
} -ArgumentList (Get-Location).Path, $BRAIN_TOKEN

# 3. Start Cloudflare Tunnel
Write-Host "🌉 Opening Secure Tunnel..." -ForegroundColor Green
Write-Host "---------------------------------------------------"
Write-Host "PUBLIC ACCESS DETAILS:" -ForegroundColor Yellow
Write-Host "Token: $BRAIN_TOKEN" -ForegroundColor White
Write-Host "---------------------------------------------------"

# Run cloudflared (this will stay in foreground to show the URL)
./bin/cloudflared.exe tunnel --url http://localhost:8080

# Cleanup on exit
Stop-Job $serverJob
Write-Host "🛑 Bridge Closed." -ForegroundColor Red
