import multiprocessing

from fastapi import FastAPI
from nicegui import ui

# Configuração da API FastAPI
app = FastAPI(title="DendriForge API", version="0.1.0")

@app.get("/api/v1/status")
def read_root():
    return {"status": "Sovereign Engine Active"}

# Configuração do NiceGUI (Dashboard Interno)
ui.label("DendriForge Developer Dashboard").classes("text-h4")
ui.button("Start Engine", on_click=lambda: ui.notify("Engine initialization sequence started..."))

# Bind do NiceGUI à instância do FastAPI
# NiceGUI controla o servidor internamente
ui.run_with(app, mount_path="/ui", storage_secret="dendriforge_secret")

if __name__ == '__main__':
    multiprocessing.freeze_support()
