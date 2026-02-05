Aqui estão as localizações das pastas e arquivos do QEMU separadas por plataforma:

    ##### 🇦 🏁 Arduino (AVR)
No Projeto (NeuroForge):
server/cores/neuroforge_qemu/: Esta pasta contém a definição da "board" customizada do NeuroForge para o QEMU (boards.txt, etc).
server/QEMURunner.ts: O código principal que configura e lança o processo do QEMU para AVR.
No PC:
Binário: C:\Program Files\qemu\qemu-system-avr.exe
Configuração: O arquivo server/.env usa a variável QEMU_PATH=qemu-system-avr (pegando do PATH do Windows).

    ##### 🚀 ESP32 (Xtensa)
No Projeto (NeuroForge):
server/test-firmware/esp32/: Pasta onde você deve colocar as imagens de firmware (qemu_flash.bin e qemu_efuse.bin) para testar a simulação do ESP32.
server/src/services/Esp32Backend.ts: O serviço que gerencia a execução do QEMU específico para ESP32.
No PC:
Binário: C:\qemu-project\builds\esp32\bin\qemu-system-xtensa.exe
Configuração: O arquivo server/.env define o binário em ESP32_QEMU_PATH=qemu-system-xtensa.

    ##### Componentes do QEMU no Projeto
No Projeto (NeuroForge):
server/cores/neuroforge_qemu/: Esta pasta contém a definição da "board" customizada do NeuroForge para o QEMU (boards.txt, etc).
server/QEMURunner.ts: O código principal que configura e lança o processo do QEMU para AVR.
server/QEMUSimulationEngine.ts: O motor de simulação que orquestra a compilação e execução do QEMU.
server/QEMUMonitorService.ts: O serviço que monitora os registradores do QEMU para obter o estado dos pinos GPIO.
server/test-firmware/esp32/: Pasta onde você deve colocar as imagens de firmware (qemu_flash.bin e qemu_efuse.bin) para testar a simulação do ESP32.
server/src/services/Esp32Backend.ts: O serviço que gerencia a execução do QEMU específico para ESP32.

    ##### NEUROFORGE_TIME
- **Localização:** `server/src/services/NeuroForgeTime.ts` (ou similar, ver `server/src/`)
- **Propósito:** Implementação de clock virtual compartilhado para garantir sincronia entre diferentes arquiteturas (AVR, ESP32) e o frontend.
- **Dica:** É o único código (junto com o protocolo Serial GPIO) que é compartilhado diretamente entre os backends.

    ##### Detalhes Técnicos para Integração ESP32
- **Protocolo de Comunicação:** Usa o padrão `G:pin=X,v=Y` (v1.0) via stream Serial.
- **Porta Serial (TCP):** O ESP32 no QEMU expõe a UART via rede. A porta padrão é **5555** (`tcp://localhost:5555`).
- **Arquivos de Integração:**
  - `server/src/services/Esp32Backend.ts`: Gerencia o processo `qemu-system-xtensa`.
  - `server/src/services/Esp32SerialClient.ts`: Conecta no socket TCP para ler os dados do MCU.
- **Arquivos de Firmware Necessários:**
  - `qemu_flash.bin`: Imagem da memória Flash (inclui bootloader + app).
  - `qemu_efuse.bin`: Imagem dos e-fuses do chip.
- **Diferença Chave:** Enquanto o AVR usa `stdio` para serial, o ESP32 usa **Sockets TCP**, o que permite simular comunicações mais complexas no futuro.

    ##### Próximos Passos (Resumo)
1. Completar a lógica de start/stop no `Esp32Backend.ts`.
2. Habilitar o `Esp32SerialClient.ts` para converter o stream TCP em eventos GPIO.
3. Conectar esses serviços no `QEMUSimulationEngine.ts` quando a board detectada for ESP32.
