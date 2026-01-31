#!/bin/bash
# NeuroForge QEMU Core - Installation Script (Linux/macOS)
# 
# Este script instala o core neuroforge_qemu no arduino-cli.
# Copia o core Arduino padrão e adiciona os arquivos NeuroForge Time.

set -e

echo "========================================"
echo "NeuroForge QEMU Core - Installation"
echo "========================================"
echo ""

# 1. Detectar diretório do arduino-cli
ARDUINO_DATA="$HOME/.arduino15"

if [ ! -d "$ARDUINO_DATA" ]; then
    echo "❌ Arduino15 não encontrado em: $ARDUINO_DATA"
    echo "💡 Instale arduino-cli primeiro: https://arduino.github.io/arduino-cli/"
    exit 1
fi

echo "✅ Arduino15 encontrado: $ARDUINO_DATA"

# 2. Encontrar versão do core AVR instalado
AVR_BASE="$ARDUINO_DATA/packages/arduino/hardware/avr"

if [ ! -d "$AVR_BASE" ]; then
    echo "❌ Core Arduino AVR não encontrado!"
    echo "💡 Instale com: arduino-cli core install arduino:avr"
    exit 1
fi

AVR_VERSION=$(ls -1 "$AVR_BASE" | sort -V | tail -1)
AVR_DIR="$AVR_BASE/$AVR_VERSION"

echo "✅ Core Arduino AVR encontrado: $AVR_VERSION"

# 3. Criar diretório do core neuroforge_qemu
NF_CORE_DIR="$AVR_DIR/cores/neuroforge_qemu"

echo "📁 Criando diretório: $NF_CORE_DIR"

if [ -d "$NF_CORE_DIR" ]; then
    echo "⚠️  Core já existe, removendo versão antiga..."
    rm -rf "$NF_CORE_DIR"
fi

mkdir -p "$NF_CORE_DIR"

# 4. Copiar core Arduino padrão
echo "📋 Copiando core Arduino padrão..."

ARDUINO_CORE_DIR="$AVR_DIR/cores/arduino"
cp -r "$ARDUINO_CORE_DIR"/* "$NF_CORE_DIR/"

echo "✅ Core Arduino copiado"

# 5. Adicionar arquivos NeuroForge Time
echo "⏱️  Adicionando NeuroForge Time..."

REPO_CORE="$(dirname "$0")/neuroforge_qemu"

cp "$REPO_CORE/nf_time.h" "$NF_CORE_DIR/"
cp "$REPO_CORE/nf_time.cpp" "$NF_CORE_DIR/"
cp "$REPO_CORE/nf_arduino_time.cpp" "$NF_CORE_DIR/"

echo "✅ NeuroForge Time adicionado"

# 6. Registrar board no boards.txt
echo "📦 Registrando board unoqemu..."

BOARDS_FILE="$AVR_DIR/boards.txt"

if grep -q "unoqemu.name" "$BOARDS_FILE"; then
    echo "⚠️  Board unoqemu já registrado, ignorando..."
else
    echo "" >> "$BOARDS_FILE"
    echo "# NeuroForge QEMU Boards" >> "$BOARDS_FILE"
    cat "$REPO_CORE/boards.txt" >> "$BOARDS_FILE"
    echo "✅ Board unoqemu registrado"
fi

# 7. Verificar instalação
echo ""
echo "🔍 Verificando instalação..."

for file in nf_time.h nf_time.cpp nf_arduino_time.cpp; do
    if [ -f "$NF_CORE_DIR/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file"
    fi
done

# 8. Testar arduino-cli
echo ""
echo "🧪 Testando arduino-cli..."

if arduino-cli board listall | grep -q "unoqemu"; then
    echo "✅ Board unoqemu disponível no arduino-cli!"
    arduino-cli board listall | grep "unoqemu"
else
    echo "⚠️  Board unoqemu não detectado"
    echo "💡 Tente: arduino-cli core update-index"
fi

# 9. Sucesso!
echo ""
echo "========================================"
echo "✅ Instalação concluída com sucesso!"
echo "========================================"
echo ""
echo "Próximos passos:"
echo "1. Compilar sketch: arduino-cli compile --fqbn arduino:avr:unoqemu sketch/"
echo "2. Executar no QEMU: qemu-system-avr -machine arduino-uno -bios sketch.elf -serial stdio"
echo "3. Testar no NeuroForge: npm run dev (backend + frontend)"
echo ""
