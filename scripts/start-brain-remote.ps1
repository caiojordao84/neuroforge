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

$cfTokenLine = Get-Content .env | Select-String "CF_TUNNEL_TOKEN="
$CF_TUNNEL_TOKEN = $cfTokenLine.ToString().Split("=")[1].Trim()

# 2. Start MCP Server in FastAPI Streamable HTTP mode (Background)
Write-Host "🚀 Starting Brain MCP Server (/mcp endpoint)..." -ForegroundColor Green
$serverJob = Start-Job -ScriptBlock {
    param($root, $token)
    cd $root
    python scripts/brain_mcp/brain_mcp.py --transport sse --port 8080 --token $token > scripts/brain_mcp/server.log 2>&1
} -ArgumentList (Get-Location).Path, $BRAIN_TOKEN

# Wait a few seconds for server to bind
Start-Sleep -Seconds 3

# 3. Start Cloudflare Tunnel
Write-Host "🌉 Opening Permanent Secure Tunnel..." -ForegroundColor Green
Write-Host "---------------------------------------------------"
Write-Host "PUBLIC ACCESS DETAILS:" -ForegroundColor Yellow
Write-Host "Auth Bearer Token: $BRAIN_TOKEN" -ForegroundColor White
Write-Host "---------------------------------------------------"

# Run cloudflared with the permanent token
./bin/cloudflared.exe tunnel run --token $CF_TUNNEL_TOKEN

# Cleanup on exit
Stop-Job $serverJob
Write-Host "🛑 Bridge Closed." -ForegroundColor Red
