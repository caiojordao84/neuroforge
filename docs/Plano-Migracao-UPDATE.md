Agora tenho toda a informação necessária. Vou criar uma análise completa e estruturada.

## Análise de Cobertura de Protocolos — ASL Engine (Migração para Rust)

Com base no estado actual do motor ASL (secção 1.1 do plano v4.2) , aqui está o mapeamento completo de todos os protocolos listados — os que já estão cobertos, os que precisam de novos tipos ASL, e os que são protocolos de camada superior (encapsulados sobre os físicos já existentes).

***

## Protocolos Já Cobertos (total ou parcialmente)

| Protocolo | Tipos ASL Actuais | Estado |
|---|---|---|
| **UART / Serial** | `serialBegin`, `print`, `uartWrite`, `uartRead` | ✅ Coberto |
| **SPI** | `spiTransfer` | ⚠️ Parcial — falta `spiBegin`, `spiConfig`, `spiTransferFull` |
| **I2C** | `i2cWrite`, `i2cRead` | ⚠️ Parcial — falta `i2cBegin`, `i2cScan` |
| **PWM** | `pwmInit`, `pwmSetDuty`, `pwmSetFreq`, `pwmStop` | ✅ Coberto |

Para SPI e I2C, o `embedded-hal` v1.0  define traits padrão (`SpiBus`, `I2c`) que devem guiar a expansão dos tipos ASL no crate Rust.

***

## Protocolos Físicos Sem Cobertura ASL — Prioritários

Estes protocolos têm relevância directa em MCUs e PLCs e devem ter novos tipos `AslXxx` no crate `neuroforge-asl`:

### RS485 / RS232
Ambos são UART com camada física diferente — RS232 usa ±12 V, RS485 usa par diferencial A/B com 120 Ω de terminação . No Rust, a `serialport` crate (já no `neuroforge-transport`) cobre ambos via configuração de flow control e linha DE/RE. Novos tipos ASL sugeridos:

```rust
// asl_transport_types.rs
pub struct AslRs485Begin { pub port: String, pub baud: u32, pub de_pin: Option<u8> }
pub struct AslRs485Write { pub data: AslExpr }
pub struct AslRs485Read  { pub timeout_ms: u32, pub result: String }
// RS232 partilha os tipos UART existentes — apenas diferencia o physical layer no gerador
```

### CAN Bus / DeviceNet / NMEA 2000
CAN usa par diferencial CANH/CANL . DeviceNet e NMEA 2000 **correm sobre CAN** com perfis de aplicação diferentes. O `embedded-hal` tem o crate separado `embedded-can` para traits CAN . Novos tipos ASL:

```rust
pub struct AslCanBegin    { pub baud: u32, pub mode: CanMode }
pub struct AslCanSend     { pub id: AslExpr, pub data: AslExpr }
pub struct AslCanReceive  { pub filter: Option<u32>, pub result: String, pub timeout_ms: u32 }
// DeviceNet e NMEA2000: encapsulados sobre AslCanSend/Receive com shims de camada de aplicação
```

### 1-Wire
Protocolo single-wire com pull-up, identifica dispositivos por ID de 64 bits (ex: DS18B20) . Existe o crate `embedded-onewire` com traits `no_std` e async . Novos tipos ASL:

```rust
pub struct AslOneWireBegin  { pub pin: u8 }
pub struct AslOneWireSearch { pub result: String }  // retorna lista de IDs 64-bit
pub struct AslOneWireRead   { pub device_id: AslExpr, pub result: String }
pub struct AslOneWireWrite  { pub device_id: AslExpr, pub data: AslExpr }
```

### LIN Bus
Protocolo single-wire master/slave, típico em automóvel a 12 V/24 V . Novos tipos ASL:

```rust
pub struct AslLinBegin  { pub baud: u32 }  // tipicamente 9600–20000
pub struct AslLinSend   { pub id: u8, pub data: AslExpr }
pub struct AslLinRead   { pub id: u8, pub result: String }
```

### I2S (Áudio)
Protocolo síncrono serial para áudio — SCK (bit clock), WS (word select), SD (dados) . Relevante para ESP32 e RP2040. Novos tipos ASL:

```rust
pub struct AslI2sBegin  { pub sample_rate: u32, pub bits: u8, pub mode: I2sMode }
pub struct AslI2sWrite  { pub samples: AslExpr }
pub struct AslI2sRead   { pub samples: u16, pub result: String }
```

### USB (controlo a nível de firmware)
Diferente de "USB como transporte de flash" — aqui refere-se a implementar um dispositivo USB (HID, CDC, bulk) no MCU. O `usb-device` crate é o padrão `no_std` . Novos tipos ASL:

```rust
pub struct AslUsbBegin    { pub class: UsbClass }  // UsbClass: HID | CDC | Bulk
pub struct AslUsbWrite    { pub data: AslExpr }
pub struct AslUsbRead     { pub result: String }
```

***

## Protocolos de Camada Superior — Implementados via Shims

Estes protocolos **correm sobre** os físicos já existentes ou em implementação e devem ser tratados como **shims de geração de código** no `ShimManager`, não como novos tipos ASL base:

| Protocolo | Corre sobre | Estratégia Rust | Crate Sugerido |
|---|---|---|---|
| **Modbus RTU** | RS485 | `tokio-modbus` (já no plano)  | `tokio-modbus = "0.5"` |
| **Modbus ASCII** | UART | `tokio-modbus` | já incluído |
| **Modbus TCP** | Ethernet | `tokio-modbus` | já incluído |
| **DMX512** | RS485 | Shim sobre `AslRs485Write` | `dmx` crate ou impl manual |
| **MIDI** | UART a 31.25 kbps | Shim sobre `AslUartWrite/Read` | `midi-types` crate |
| **Firmata** | Serial (UART) | Shim sobre `serialBegin`/`uartWrite` | `firmata` crate |
| **rosserial** | Serial (UART) | Shim sobre `serialBegin`/`uartWrite` | impl manual |
| **S.N.A.P / YASP / LOP / ICSC** | Serial (UART) | Shims sobre UART existente | impl manual |
| **netstring / JSON-over-serial** | Serial (UART) | Shim + `serde_json` | `serde_json` (já no workspace) |
| **IP over Serial (SLIP/PPP)** | Serial (UART) | Shim | `smoltcp` crate |
| **DeviceNet** | CAN | Shim sobre `AslCanSend/Receive` | impl manual |
| **NMEA 2000** | CAN | Shim sobre `AslCanSend/Receive` | `nmea` crate |

***

## Protocolos de Conectividade Wireless e Alta-Performance

| Protocolo | Estratégia ASL | Crate Rust | Prioridade |
|---|---|---|---|
| **Bluetooth (BLE/Classic)** | Novos tipos: `AslBleBegin`, `AslBleScan`, `AslBleConnect`, `AslBleWrite`, `AslBleRead` | `btleplug` (host) / `embassy-bluetooth` (MCU) | Fase 3/4 |
| **ZigBee** | `AslZigbeeBegin`, `AslZigbeeSend`, `AslZigbeeRead` | Depende de módulo XBee/CC2530 via UART | Fase 5 |
| **IR (InfraRed)** | `AslIrSend { protocol, code }`, `AslIrRead { result }` | `infrared` crate (`no_std`) | Fase 3 |
| **Ethernet** | `AslEthernetBegin`, `AslEthernetConnect`; TCP/UDP via `AslTcpWrite`/`AslTcpRead` | `smoltcp` (MCU) / `tokio::net` (Desktop) | Fase 3 |
| **JTAG** | Não é protocolo de aplicação — é modo de debug/flash | Coberto por `probe-rs` no `neuroforge-firmware`  | N/A — não precisa tipos ASL |
| **Audio over Ethernet / Myrinet / InfiniBand** | Fora do scope de MCUs/PLCs | N/A para ASL | Fora do scope |
| **NTSC/PAL** | `AslVideoBegin { format, pin }`, `AslVideoSync` | `esp-idf-hal` (ESP32 tem DAC) | Fase 6 |

***

## Protocolos de Camada de Aplicação IEEE e Industriais

| Protocolo | Estratégia |
|---|---|
| **IEEE 1451 (Sensor Transducer Interface)** | Define comunicação sobre I2C/SPI existentes — implementar como shim que gera código de inicialização de TEDS (Transducer Electronic Data Sheet) sobre `AslI2cWrite/Read` ou `AslSpiTransfer` |
| **Tiny Embedded Network / MINES** | Shims sobre UART existente — protocolos minimalistas orientados a bytes |

***

## Proposta de Expansão de `asl_transport_types.rs`

Com base nesta análise, sugere-se a seguinte adição ao crate `neuroforge-asl` na **Fase 3**, com bump de versão ASL para `4.4.0`:

```rust
// crates/neuroforge-asl/src/types/asl_transport_types.rs  (EXPANDIDO)

// === NOVOS TIPOS — Fase 3 ===

// RS485
pub struct AslRs485Begin  { pub port: String, pub baud: u32, pub de_re_pin: Option<u8> }
pub struct AslRs485Write  { pub data: AslExpr }
pub struct AslRs485Read   { pub timeout_ms: u32, pub result: String }

// CAN Bus (base para DeviceNet e NMEA2000)
pub struct AslCanBegin    { pub baud: u32, pub mode: CanMode }  // CanMode: Normal | Loopback | Silent
pub struct AslCanSend     { pub id: AslExpr, pub data: AslExpr, pub is_extended: bool }
pub struct AslCanReceive  { pub filter_id: Option<u32>, pub filter_mask: Option<u32>, pub result: String, pub timeout_ms: u32 }

// 1-Wire
pub struct AslOneWireBegin  { pub pin: u8 }
pub struct AslOneWireSearch { pub result: String }
pub struct AslOneWireWrite  { pub device_id: AslExpr, pub command: AslExpr }
pub struct AslOneWireRead   { pub device_id: AslExpr, pub bytes: u8, pub result: String }

// LIN Bus
pub struct AslLinBegin  { pub baud: u32 }
pub struct AslLinSend   { pub frame_id: u8, pub data: AslExpr }
pub struct AslLinRead   { pub frame_id: u8, pub result: String }

// I2S (Áudio)
pub struct AslI2sBegin  { pub sample_rate: u32, pub bits_per_sample: u8, pub channel: I2sChannel }
pub struct AslI2sWrite  { pub buffer: AslExpr }
pub struct AslI2sRead   { pub num_samples: u16, pub result: String }

// USB Device (HID/CDC a nível firmware)
pub struct AslUsbBegin  { pub class: UsbDeviceClass }  // HID | CDC | Vendor
pub struct AslUsbWrite  { pub endpoint: u8, pub data: AslExpr }
pub struct AslUsbRead   { pub endpoint: u8, pub result: String }

// IR
pub struct AslIrSend  { pub pin: u8, pub protocol: IrProtocol, pub code: AslExpr }
// IrProtocol: NEC | RC5 | RC6 | Sony | Samsung | Raw
pub struct AslIrRead  { pub pin: u8, pub result: String }

// Ethernet (TCP/UDP a nível MCU — smoltcp)
pub struct AslEthernetBegin  { pub mac: [u8; 6], pub ip: Option<String> }
pub struct AslTcpConnect     { pub host: AslExpr, pub port: u16, pub result: String }
pub struct AslTcpWrite       { pub conn: AslExpr, pub data: AslExpr }
pub struct AslTcpRead        { pub conn: AslExpr, pub result: String }
pub struct AslUdpSend        { pub host: AslExpr, pub port: u16, pub data: AslExpr }
pub struct AslUdpReceive     { pub port: u16, pub result: String }

// Bluetooth LE (MCU — Embassy BLE / btleplug para Desktop)
pub struct AslBleBegin     { pub device_name: String }
pub struct AslBleScan      { pub duration_ms: u32, pub result: String }
pub struct AslBleConnect   { pub address: AslExpr }
pub struct AslBleWrite     { pub char_uuid: String, pub data: AslExpr }
pub struct AslBleRead      { pub char_uuid: String, pub result: String }

// Enums auxiliares
pub enum CanMode      { Normal, Loopback, Silent }
pub enum I2sChannel   { Stereo, LeftOnly, RightOnly }
pub enum UsbDeviceClass { HID, CDC, Vendor(u8) }
pub enum IrProtocol   { Nec, Rc5, Rc6, Sony, Samsung, Raw }
```

***

## Mapeamento de Crates Rust por Protocolo

Para que a implementação seja **robusta e livre de falhas**, aqui estão as dependências concretas a adicionar ao `neuroforge-asl` e ao `neuroforge-transport` :

```toml
# Adicionar a crates/neuroforge-transport/Cargo.toml — Fase 3

# CAN Bus
embedded-can = "0.4"         # Traits CAN (embedded-hal ecosystem) [cite:web:4]

# 1-Wire
embedded-onewire = "0.1"     # Traits 1-Wire no_std + async [cite:web:24]
ds18b20 = "0.2"              # Driver DS18B20 (crate mais comum para 1-Wire)

# I2S
i2s = "0.1"                  # ou via embedded-hal-async

# USB Device (MCU)
usb-device = "0.3"           # Padrão no_std para dispositivos USB
usbd-serial = "0.2"          # Classe CDC-ACM

# IR
infrared = "0.14"            # no_std, suporta NEC/RC5/RC6/Sony/Samsung [cite:web:21]

# Ethernet MCU
smoltcp = { version = "0.12", features = ["socket-tcp", "socket-udp"] }

# Bluetooth Desktop
btleplug = "0.11"            # BLE host para Desktop (Windows/macOS/Linux)

# MIDI
midi-types = "0.4"           # Tipos MIDI no_std

# DMX512
dmx = "0.1"                  # ou impl sobre serialport com baud=250000
```

***

## Resumo de Prioridades por Fase

| Fase | Protocolos a Adicionar | `asl_version` |
|---|---|---|
| **Fase 3** | RS485, CAN Bus, 1-Wire, LIN, IR, Ethernet TCP/UDP | `4.4.0` |
| **Fase 3** | Shims: Modbus RTU/TCP (já parcial), DMX512, MIDI, Firmata | shims, sem bump |
| **Fase 4** | USB Device (HID/CDC), I2S, BLE | `4.5.0` |
| **Fase 5** | ZigBee, NTSC/PAL | `4.6.0` |
| **Fora de scope ASL** | JTAG (→ `probe-rs` firmware), Myrinet, InfiniBand, AoE | — |

O protocolo **JTAG não precisa de tipos ASL**  — já está coberto pelo `probe-rs = "0.24"` no `neuroforge-firmware` como ferramenta de flash/debug, não como protocolo de aplicação para o utilizador final.

