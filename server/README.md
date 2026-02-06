# 🚀 NeuroForge Backend Server

Backend API para compilação e simulação de Arduino usando QEMU real.

---

## 🛠️ Arquitetura

```
server/
├── src/
│   ├── api/
│   │   ├── routes.ts          # REST API endpoints
│   │   └── websocket.ts       # WebSocket server (Socket.IO)
│   ├── services/
│   │   ├── CompilerService.ts      # arduino-cli wrapper
│   │   ├── QEMURunner.ts           # QEMU process manager
│   │   └── QEMUSimulationEngine.ts # High-level API
│   └── server.ts          # Express app entry point
├── dist/                  # Compiled JavaScript (build output)
├── package.json
├── tsconfig.json
└── .env                   # Environment variables
```

---

## 💻 Instalação

### 1️⃣ Pré-requisitos

#### Windows:
```powershell
# Instalar Arduino CLI
winget install Arduino.ArduinoCLI

# Instalar QEMU AVR
winget install qemu

# Verificar instalação
arduino-cli version
qemu-system-avr --version
```

#### Linux/Mac:
```bash
# Ubuntu/Debian
sudo apt install arduino-cli qemu-system-avr

# macOS
brew install arduino-cli qemu

# Verificar
arduino-cli version
qemu-system-avr --version
```

### 2️⃣ Configurar Arduino CLI

```bash
# Inicializar arduino-cli
arduino-cli config init

# Instalar core AVR (Arduino Uno, Mega, etc.)
arduino-cli core install arduino:avr

# Instalar core ESP32 (opcional)
arduino-cli core install esp32:esp32 --additional-urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json

# Listar placas instaladas
arduino-cli board listall
```

### 3️⃣ Instalar Dependências do Servidor

```bash
cd server
npm install
```

### 4️⃣ Configurar Variáveis de Ambiente

```bash
cp .env.example .env
# Editar .env conforme necessário
```

**`.env` padrão:**
```bash
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ARDUINO_CLI_PATH=arduino-cli
QEMU_PATH=qemu-system-avr
```

---

## ▶️ Executar Servidor

### Modo Desenvolvimento (com hot-reload):
```bash
npm run dev
```

### Modo Produção:
```bash
npm run build
npm start
```

**Output esperado:**
```
✅ NeuroForge Backend running on http://localhost:3000
📡 WebSocket server ready
🔧 API available at http://localhost:3000/api
```

---

## 📡 API Endpoints

### REST API

| Método   | Endpoint                  | Descrição               |
| -------- | ------------------------- | ----------------------- |
| `GET`    | `/health`                 | Health check            |
| `POST`   | `/api/compile`            | Compilar código Arduino |
| `POST`   | `/api/simulate/start`     | Iniciar simulação QEMU  |
| `POST`   | `/api/simulate/stop`      | Parar simulação         |
| `GET`    | `/api/simulate/status`    | Status da simulação     |
| `GET`    | `/api/simulate/pins/:pin` | Ler estado de pino      |
| `POST`   | `/api/simulate/pins/:pin` | Escrever estado de pino |
| `GET`    | `/api/simulate/serial`    | Obter buffer serial     |
| `DELETE` | `/api/simulate/serial`    | Limpar buffer serial    |

### WebSocket Events

**Server → Client:**
- `serial` - Linha de saída serial
- `pinChange` - Mudança de estado de pino
- `simulationStarted` - Simulação iniciada
- `simulationStopped` - Simulação parada
- `simulationPaused` - Simulação pausada
- `simulationResumed` - Simulação retomada
- `status` - Status inicial ao conectar

---

## 📝 Exemplos de Uso

### 1. Compilar Sketch

```bash
curl -X POST http://localhost:3000/api/compile \
  -H "Content-Type: application/json" \
  -d '{
    "code": "void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); }",
    "board": "arduino-uno"
  }'
```

**Response:**
```json
{
  "success": true,
  "firmwarePath": "/tmp/neuroforge-compile/sketch_1234567890/sketch.ino.hex",
  "stdout": "Sketch uses 1234 bytes..."
}
```

### 2. Iniciar Simulação

```bash
curl -X POST http://localhost:3000/api/simulate/start \
  -H "Content-Type: application/json" \
  -d '{
    "firmwarePath": "/tmp/neuroforge-compile/sketch_1234567890/sketch.ino.hex",
    "board": "arduino-uno"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Simulation started"
}
```

### 3. Ler Estado de Pino

```bash
curl http://localhost:3000/api/simulate/pins/13
```

**Response:**
```json
{
  "success": true,
  "pin": 13,
  "mode": "OUTPUT",
  "value": 1
}
```

### 4. WebSocket (JavaScript)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Listen to serial output
socket.on('serial', (line) => {
  console.log('Serial:', line);
});

// Listen to pin changes
socket.on('pinChange', ({ pin, mode, value }) => {
  console.log(`Pin ${pin} changed: ${value}`);
});

// Listen to simulation events
socket.on('simulationStarted', () => {
  console.log('Simulation started!');
});
```

---

## 🛠️ Desenvolvimento

### Estrutura de Serviços

#### **CompilerService**
Gerencia compilação de sketches usando `arduino-cli`.

```typescript
const compiler = new CompilerService();
const result = await compiler.compile(code, 'arduino-uno');
```

#### **QEMURunner**
Gerencia processo QEMU (low-level).

```typescript
const runner = new QEMURunner();
await runner.start(firmwarePath, 'arduino-uno');
runner.on('serial', (line) => console.log(line));
```

#### **QEMUSimulationEngine**
API high-level para controlar simulação.

```typescript
const engine = new QEMUSimulationEngine();
await engine.loadFirmware(firmwarePath, 'arduino-uno');
await engine.start();

const pinState = engine.getPinState(13);
await engine.setPinState(2, 1); // Simular botão pressionado
```

---

## 🐛 Debug

### Verificar se QEMU está funcionando:

```bash
# Testar QEMU manualmente
cd poc/qemu-avr-test
./compile.ps1
./run-qemu.ps1
```

### Logs do Servidor:

```bash
# Rodar com logs detalhados
DEBUG=* npm run dev
```

### Testar Compilação:

```bash
# Compilar sketch manualmente
arduino-cli compile --fqbn arduino:avr:uno ./test-sketch
```

---

## 📊 Performance

- **Compilação:** ~2-5 segundos (depende do tamanho do sketch)
- **Startup QEMU:** ~500ms
- **Pin Polling:** 100ms (configurável)
- **WebSocket Latency:** <10ms (rede local)

---

## 🔐 Segurança

⚠️ **Importante:**
- Este servidor executa código arbitrário via `arduino-cli` e `QEMU`
- **NÃO exponha diretamente à internet sem autenticação**
- Use apenas em ambiente local ou atrás de firewall/VPN
- Implemente autenticação (JWT, OAuth) antes de deploy público

---

## 📦 Docker (Futuro)

```dockerfile
# Dockerfile
FROM node:20-alpine

# Install QEMU and Arduino CLI
RUN apk add --no-cache qemu-system-avr arduino-cli

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - FRONTEND_URL=http://localhost:5173
    volumes:
      - ./server:/app
      - /app/node_modules
```

---

## ❓ FAQ

**Q: O QEMU não inicia. O que fazer?**  
A: Verifique se `qemu-system-avr` está no PATH: `qemu-system-avr --version`

**Q: Compilação falha com erro 404.**  
A: Instale o core AVR: `arduino-cli core install arduino:avr`

**Q: WebSocket não conecta.**  
A: Verifique se o `FRONTEND_URL` no `.env` está correto (CORS)

**Q: Como debugar GPIO?**  
A: Use `console.log` no `QEMURunner.writeGPIO()` / `readGPIO()`

---

## 📢 Próximos Passos

- [ ] Implementar comunicação real com QEMU Monitor (GPIO read/write)
- [ ] Suporte a ESP32 via QEMU
- [ ] Cache de compilação (evitar recompilar mesmo código)
- [ ] Rate limiting e autenticação
- [ ] Logs estruturados (Winston/Pino)
- [ ] Testes unitários (Jest)
- [ ] Docker image oficial
- [ ] Deploy na Railway/Heroku

---

**Última atualização:** 31/01/2026  
**Autor:** @caiojordao84
