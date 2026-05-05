import multiprocessing

import uvicorn
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
ui.run_with(app, mount_path="/ui", storage_secret="dendriforge_secret")

if __name__ == '__main__':
    # Preparação para multiprocessing do simulador PySpice
    multiprocessing.freeze_support()
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
