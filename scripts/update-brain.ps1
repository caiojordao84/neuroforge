# NeuroForge Brain Update Script
# Updates the Graphify context and ensures it stays inside the Digital Brain vault.

Write-Host "Syncing Graphify to Digital Brain..."

# Run graphify update
# This typically creates 'graphify-out' at the root
graphify update .

# Relocate the output to the notes vault
if (Test-Path "graphify-out") {
    Write-Host "Relocating Graphify output to notes/graphify..."
    
    # Remove old version in notes if it exists
    if (Test-Path "notes/graphify") {
        Remove-Item "notes/graphify" -Recurse -Force
    }
    
    # Move the new output
    Move-Item -Path "graphify-out" -Destination "notes/graphify" -Force
}

Write-Host "Brain Updated Successfully."
