import sys
import fastapi
import nicegui
import lark
import pydantic
import serial
import PySpice
from dotenv import load_dotenv
import pytest

def main():
    print("="*50)
    print("DendriForge Environment Diagnostics")
    print("="*50)
    print(f"Python Version: {sys.version}")
    print(f"FastAPI Version: {fastapi.__version__}")
    print(f"NiceGUI Version: {nicegui.__version__}")
    print(f"Lark Version: {lark.__version__}")
    print(f"Pydantic Version: {pydantic.__version__}")
    print(f"PySerial Version: {serial.__version__}")
    # PySpice uses a different version string location or might not have one exposed simply
    print("PySpice Module: Successfully loaded")
    print("pytest Module: Successfully loaded")
    print("="*50)
    print("✅ Ambiente Python Perfeito e Ativo!")
    print("="*50)

if __name__ == "__main__":
    main()
