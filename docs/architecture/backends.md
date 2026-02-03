# Arquitetura de Execução: AVR, ESP32 e Futuros MCUs

Este documento descreve como a NeuroForge executa firmwares para diferentes microcontroladores usando QEMU (e, no futuro, outros emuladores), mantendo uma camada unificada de simulação para makers, uso doméstico e industrial.

## Camadas da Arquitetura

A arquitetura é dividida em três camadas principais:

1. **Board / Device (Descritiva)**  
   - Cada placa é descrita em JSON em `docs/boards/`.  
   - Campos típicos:
     - `mcuFamily`: `avr`, `esp32`, `rp2040`, etc.
     - `framework`: `arduino`, `esp-idf`, `micropython`, `bare-metal`.  
     - Mapeamento de pinos, periféricos, tamanho de flash/RAM.  
   - Esta camada não sabe nada de QEMU; apenas descreve capacidades e pinout.

2. **Backend de Execução (CPU / QEMU)**  
   - Implementações específicas por família de MCU, todas expõem uma interface comum:
     - `start(firmware | flashImage, options) => handle`
     - `stop(handle)`
     - `getSerialStream(handle) => Readable`
   - Backends atuais e planeados:
     - `AvrBackend` → usa QEMU AVR para UNO/Nano/Mega.
     - `Esp32Backend` → usa QEMU ESP32 da Espressif (`qemu-system-xtensa -M esp32 ...`) para ESP32 e placas Arduino‑ESP32.
     - `Rp2040Backend` (planeado) → usará QEMU com suporte RP2040 ou outro emulador equivalente.
   - Cada backend sabe:
     - Como iniciar o emulador com os argumentos corretos.
     - Como expor a UART/serial via stdio ou TCP.
     - Como lidar com imagens de flash, eFuse e layout de partições quando necessário.

3. **Camada de Framework/Runtime**  
   - Esta camada traduz a experiência do desenvolvedor (Arduino, ESP‑IDF, etc.) para os artefactos que o backend precisa.
   - Exemplos:
     - **Arduino AVR**:
       - Compilação via Arduino CLI / avr‑gcc → ELF AVR.
       - O `AvrBackend` recebe o ELF e arranca QEMU AVR com a máquina correta (ex.: `-machine uno`).
     - **Arduino‑ESP32**:
       - Uso do core `arduino-esp32` como componente ESP‑IDF ou da toolchain Arduino que gera binários baseados em ESP‑IDF.
       - Resultado final: imagem de flash (`qemu_flash.bin` + `qemu_efuse.bin`) que o `Esp32Backend` executa em QEMU ESP32.
     - **ESP‑IDF puro**:
       - Projetos ESP‑IDF compilados diretamente (sem camada Arduino).
       - Permite cenários industriais com uso completo da API ESP‑IDF (Wi‑Fi, BLE, segurança, etc.).
     - Futuro: MicroPython, Rust, TinyGo, etc., desde que gerem binários suportados pelo backend.

## Backend ESP32 (QEMU)

O backend ESP32 integra o QEMU fornecido pela Espressif, que suporta `-M esp32` e é instalado através das ferramentas oficiais do ESP‑IDF.

- Artefactos esperados:
  - `qemu_flash.bin` (imagem de flash com bootloader, partições e app).
  - `qemu_efuse.bin` (imagem de eFuse usada pelo emulador).
- Comando base (simplificado):

```bash
qemu-system-xtensa \
  -M esp32 \
  -m 4M \
  -drive file=qemu_flash.bin,if=mtd,format=raw \
  -drive file=qemu_efuse.bin,if=none,format=raw,id=efuse \
  -global driver=nvram.esp32.efuse,property=drive,value=efuse \
  -global driver=timer.esp32.timg,property=wdt_disable,value=true \
  -nic user,model=open_eth \
  -nographic \
  -serial tcp::5555,server
```

- O `Esp32Backend` parametriza este comando:
  - Caminhos dos ficheiros de flash/eFuse.
  - Porta TCP para a UART (ex.: 5555).
  - Caminho do binário `qemu-system-xtensa` (via config/env).

## Serial e Protocolo de Simulação

A camada de simulação da NeuroForge não depende diretamente de AVR vs ESP32; ela consome **linhas de log estruturadas** vindas da UART/serial (stdio ou socket TCP):

- Exemplo de protocolo atual para GPIO:
  - `G:pin=13,v=1`
  - `G:pin=13,v=0`
- Serviços reutilizáveis:
  - `GPIOService`: extrai eventos `pin/value` de qualquer backend/framework.
  - Futuro:
    - `ADCService` com linhas `A:adc=...,v=...`.
    - `NetworkService` com linhas `N:topic=...,payload=...` para MQTT/HTTP simulados.

Esta abordagem permite que:
- Firmwares Arduino (AVR ou ESP32) e ESP‑IDF puros emitam o mesmo protocolo de alto nível.
- A UI, APIs WebSocket/REST e integrações industriais vejam uma interface unificada, independentemente de como/onde o firmware foi compilado.

## Visão de Expansão

A arquitetura foi desenhada para crescer em três eixos:

1. **Mais MCUs**  
   - Adicionar um novo MCU significa adicionar:
     - Uma entrada `mcuFamily` e boards JSON.
     - Um novo backend (ex.: `Stm32Backend`).
   - A camada de simulação e UIs permanece a mesma.

2. **Mais Frameworks**  
   - O mesmo MCU pode ter:
     - Preset "maker" (Arduino).
     - Preset "industrial" (ESP‑IDF, Zephyr, etc.).
   - Cada preset só precisa garantir que emite o protocolo de simulação acordado.

3. **Mais capacidades de simulação**  
   - Conforme surgem necessidades:
     - Injeção de falhas (watchdog, brown‑out, interrupções).
     - Simulação de rede, sensores, barramentos (I2C, SPI, CAN, Modbus).
     - Observabilidade (logs estruturados, métricas, tracing) para uso industrial.

Esta base garante que Arduinos **não serão "ESP32 maquiados"**: cada MCU usa o seu backend apropriado; o que é comum é a linguagem de observabilidade e controle da simulação.
