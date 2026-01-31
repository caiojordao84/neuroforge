# NeuroForge - Arduino/ESP32 Simulator

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/QEMU-FF6600?style=for-the-badge&logo=qemu&logoColor=white" />
</div>

---

## 🚀 Visão Geral

NeuroForge é um simulador de microcontroladores **baseado em QEMU real** para Arduino Uno, ESP32 e outras placas. Diferente de simuladores online que interpretam código, o NeuroForge executa firmware compilado em máquinas virtuais ARM/AVR.

### ✨ Características

- 🎨 **Editor Visual**: Arraste e conecte componentes (LEDs, botões, sensores)
- 💻 **Editor de Código**: Monaco Editor com syntax highlighting
- ⚡ **QEMU Backend**: Execução real de firmware ELF/HEX
- 📊 **Serial Monitor**: Captura UART em tempo real
- 🔌 **GPIO Polling**: Atualização visual de pinos (20 FPS)
- 🛠️ **Multi-Board**: Arduino Uno, ESP32, Raspberry Pi Pico

---

## 📦 Instalação Rápida

### Windows (PowerShell)

```powershell
git clone https://github.com/caiojordao84/neuroforge.git
cd neuroforge
.\install-deps.ps1
```

### Linux/macOS (Bash)

```bash
git clone https://github.com/caiojordao84/neuroforge.git
cd neuroforge
chmod +x install-deps.sh
./install-deps.sh
```

### Manual

```bash
# 1. Remover src/engine duplicado
rm -rf src/engine

# 2. Instalar dependências frontend
npm install @xyflow/react @radix-ui/react-accordion class-variance-authority clsx tailwind-merge cmdk react-day-picker recharts sonner next-themes vaul embla-carousel-react react-hook-form react-resizable-panels input-otp
# ... (veja install-deps.sh para lista completa)

# 3. Instalar dependências servidor
cd server && npm install && cd ..

# 4. Build
npm run build
```

---

## 🏃 Executando

### Frontend (Interface Visual)

```bash
npm run dev
# Abre http://localhost:5173
```

### Backend (Servidor QEMU)

```bash
cd server
npm run dev
```

---

## 📁 Estrutura do Projeto

```
neuroforge/
├── src/                    # Frontend React
│   ├── components/         # UI Components (LEDNode, ButtonNode, etc)
│   ├── store/              # Zustand state management
│   └── App.tsx             # Main app
├── server/                 # Backend Node.js
│   ├── QEMURunner.ts       # QEMU process manager
│   ├── QEMUSimulationEngine.ts  # Simulation engine
│   ├── example.ts          # Exemplo de uso
│   └── README.md           # Documentação QEMU
├── poc/                    # Provas de conceito
│   └── qemu-avr-test/      # Testes QEMU + Arduino
├── install-deps.ps1        # Script instalação Windows
└── install-deps.sh         # Script instalação Linux/macOS
```

---

## 🎯 Roadmap

### ✅ Fase 1: QEMU Integration (Atual)
- [x] QEMURunner (spawn process)
- [x] Serial Monitor (UART TX)
- [x] GPIO Polling (mock)
- [ ] GPIO Real (QEMU monitor)
- [ ] Serial RX (input)

### 🔄 Fase 2: Componentes
- [ ] PWM para servos
- [ ] ADC para potenciômetros
- [ ] I2C/SPI displays
- [ ] Sensores (DHT, ultrasonic)

### 🚀 Fase 3: Multi-Board
- [ ] ESP32 (QEMU xtensa)
- [ ] Raspberry Pi Pico (QEMU ARM)
- [ ] STM32 (QEMU Cortex-M)

### 🌐 Fase 4: Backend de Compilação
- [ ] API REST para compilar código
- [ ] arduino-cli integration
- [ ] PlatformIO support
- [ ] MicroPython cross-compilation

---

## 🧪 Testando QEMU

```bash
cd poc/qemu-avr-test

# Compilar sketch
arduino-cli compile --fqbn arduino:avr:uno serial_test

# Rodar no QEMU
qemu-system-avr -machine uno -bios build/serial_test.ino.elf -serial stdio -nographic

# Ou usar servidor Node.js
cd ../../server
npm run dev
```

---

## 📚 Documentação

- **QEMU Integration**: [`server/README.md`](server/README.md)
- **API Reference**: (em breve)
- **Component Guide**: (em breve)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## 🙏 Agradecimentos

- [QEMU](https://www.qemu.org/) - Machine emulator
- [Arduino CLI](https://github.com/arduino/arduino-cli) - Arduino toolchain
- [AVR8js](https://github.com/wokwi/avr8js) - AVR simulator (inspiração)
- [Wokwi](https://wokwi.com/) - Arduino simulator (inspiração)

---

<div align="center">
  <strong>Made with ❤️ by <a href="https://github.com/caiojordao84">caiojordao84</a></strong>
</div>
