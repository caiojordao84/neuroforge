# Plano: Parser Rust Completo para Automação Embarcada

## Objetivo
Completar o parser do neuroforge-asl para processar qualquer código Rust embarcado, desde um simples blink até sistemas complexos de automação industrial/residencial com Embassy, esp-hal, e todo o ecossistema embedded-hal.

## Escopo

Suporte a:
- Atributos (`#![no_std]`, `#![no_main]`, `#[esp_hal_embassy::main]`, etc.)
- Funções async (`async fn`, `.await`)
- Imports de embedded-hal, esp-hal, embassy-*
- Mapeamento de periféricos (GPIO, LEDC, UART, I2C, SPI, ADC, Timer)
- Tasks do Embassy

## Tarefas

### Fase 1: Análise e Estrutura

- [ ] Analisar tree-sitter-rust para identificar nodes de atributos e async → Verificar: nodes disponíveis em `attribute_item`, `async_function_item`, `await_expression`
- [ ] Mapear estrutura atual do parser em `rust_parser.rs` → Verificar: código compila sem warnings

### Fase 2: Suporte a Atributos

- [ ] Adicionar handler para `attribute_item` em `rust_parser.rs` → Verificar: parse de `#![no_std]` não dá erro
- [ ] Adicionar handler para `inner_attribute_item` (crate-level) → Verificar: `#[esp_hal_embassy::main]` é reconhecido
- [ ] Criar tipo `AslAttribute` em `asl_types.rs` → Verificar: struct compila e serializa para JSON
- [ ] Armazenar atributos em `AslFunction` e `AslTask` → Verificar: atributos aparecem no AST

### Fase 3: Suporte a Async

- [ ] Adicionar handler para `async_function_item` → Verificar: `async fn main` é parseado
- [ ] Adicionar handler para `await_expression` → Verificar: `.await` é reconhecido
- [ ] Adicionar campo `is_async` em `AslFunction` → Verificar: campo existe e serializa
- [ ] Conectar parser ao generator.async existente → Verificar: código async gera código Embassy

### Fase 4: Mapeamento embedded-hal → ASL

- [ ] Criar mapeamento `embedded_hal::gpio` → `AslGpioStatement` → Verificar: `Output::new()` vira Statement
- [ ] Criar mapeamento `embedded_hal::delay` → `AslDelayStatement` → Verificar: `Delay` trait vira Delay
- [ ] Criar mapeamento `embedded_hal::pwm` → `AslPwmStatement` → Verificar: PWM vira statements
- [ ] Criar mapeamento `embedded_hal::i2c` → `AslI2cStatement` → Verificar: I2C operations
- [ ] Criar mapeamento `embedded_hal::spi` → `AslSpiStatement` → Verificar: SPI operations

### Fase 5: Mapeamento esp-hal → ASL

- [ ] Suportar `esp_hal::ledc` → PWM ALS → Verificar: LEDC vira PWM statements
- [ ] Suportar `esp_hal::gpio` → GPIO ALS → Verificar: GpioPin → Statement
- [ ] Suportar `esp_hal::uart` → Serial ALS → Verificar: UART → Serial statements
- [ ] Suportar `esp_hal::timer` → Timer ALS → Verificar: Timer → Delay/Timer statements

### Fase 6: Suporte a Embassy

- [ ] Reconhecer `embassy_executor::Spawner` → Verificar: Spawner é identificado
- [ ] Mapear `#[esp_hal_embassy::main]` → `AslTask` com is_async=true → Verificar: attribute → task
- [ ] Mapear `Timer::after_millis()` → `AslTimerDelay` → Verificar: .after_millis() vira Delay
- [ ] Mapear tasks assíncronas → Multiple `AslTask` nodes → Verificar: loop assíncronos → tasks

### Fase 7: Testes e Validação

- [ ] Testar código blink simples (LED on/off) → Verificar: transpila para C++ e MicroPython
- [ ] Testar código PWM (fade LED) → Verificar: transpila corretamente
- [ ] Testar código I2C (sensor) → Verificar: transpila corretamente
- [ ] Testar código Embassy (async tasks) → Verificar: gera código funcional
- [ ] Testar script complexo de automação → Verificar: transpilação completa

### Fase 8: Geração de Código

- [ ] Atualizar C++ generator para periféricos → Verificar: gera código Arduino/ESP-IDF
- [ ]Atualizar Python generator para periféricos → Verificar: gera MicroPython (machine.PWM, etc.)
- [ ] Adicionar shims para APIs não suportadas → Verificar: shims compilam

## Feito Quando

- [ ] Código com `#![no_std]` + esp-hal + Embassy transpila sem erros
- [ ] Saída C++ compila para ESP32
- [ ] Saída MicroPython compila para ESP32
- [ ] Script de automação de 1000+ linhas transpila corretamente

## Notas

- Usar tree-sitter-rust para parsing, mas transformar para ASL intermedária
- Manter compatibilidade com parser atual para código Rust padrão
- Focar primeiro em esp-hal pois foi o exemplo do usuário, depois expandir para outros HALs
- ASL deve ser abstrata o suficiente para qualquer plataforma (não só ESP32)
