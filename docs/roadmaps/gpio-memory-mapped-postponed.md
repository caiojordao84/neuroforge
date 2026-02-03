# GPIO via Memory-Mapped I/O (QEMU AVR) - POSTPONED

## ⚠️ Status: ADIADO

**Data**: 2026-02-03  
**Motivo**: Mapeamento de memória do `qemu-system-avr -machine uno` não é confiável/documentado.

---

## Contexto

Esta abordagem visava ler o estado de GPIO diretamente dos registradores de I/O mapeados na memória do QEMU AVR, usando o comando `xp` do monitor.

### Tentativas realizadas

1. **Leitura direta via `xp /1bx 0x25`** (endereço I/O de PORTB)
   - Resultado: Byte estático (0x94), não reflete mudanças no firmware

2. **Leitura com offset +0x20** (`xp /1bx 0x45`)
   - Baseado em documentação AVR: I/O space 0x00-0x3F mapeado em data memory 0x20-0x5F
   - Resultado: Byte continua estático (0x94)

3. **Shadow em RAM** (`__nf_portb_shadow`)
   - Firmware copia PORTB para variável global em RAM
   - Resolvido endereço via `avr-nm` (0x800150)
   - Resultado: Byte sempre 0x00, mesmo com firmware escrevendo PORTB = 0xFF/0x00

### Logs de evidência

**Firmware reporta**:
```
[Serial] GPIO PORTB FULL TOGGLE + mirror
[Serial] PORTB = 0xFF
[Serial] PORTB = 0x00
```

**Backend lê (via xp)**:
```
[QEMURunner] Monitor raw response for xp /1bx 0x800150
xp /1bx 0x800150
0000000000800150: 0x00    # Sempre 0x00, nunca muda
```

**Snapshots sempre estáticos**:
```
[Snapshot] D13 = 0, cycleCount = 0
[Snapshot] D13 = 0, cycleCount = 0
```

---

## Hipóteses para a falha

1. **QEMU AVR não sincroniza I/O registers com data memory**
   - Registradores de I/O podem estar em região separada não acessível via `xp`
   - Machine `-machine uno` pode ter layout de memória customizado/interno

2. **Shadow variable não está sendo escrita**
   - Helper `nf_gpio_sync_portb()` pode não estar sendo incluído no build final
   - Ou o endereço 0x800150 é em região de memória que o QEMU não expõe via monitor

3. **Documentação insuficiente**
   - `qemu-system-avr` é relativamente novo (2020+)
   - Poucos exemplos de uso real com GPIO
   - Falta documentação oficial de memory layout para `-machine uno`

---

## Solução adotada (alternativa)

**Protocolo Serial de GPIO**: Firmware envia estado via Serial em formato estruturado.

**Roadmap**: Ver `docs/roadmaps/gpio-serial-protocol.md`

**Vantagens**:
- Funciona em qualquer plataforma (AVR, ESP32, RP2040)
- Independente de quirks do QEMU
- Fácil de debugar (frames legíveis)
- Baixo overhead (poucos bytes por mudança)

---

## Condições para reativar esta abordagem

1. **Upgrade do QEMU AVR com melhor suporte**
   - Versão futura do QEMU documenta memory layout
   - Ou adiciona comando de monitor específico para ler I/O registers (ex: `info gpio`)

2. **Documentação oficial**
   - Alguém da comunidade publica guia de como acessar PORTB/C/D via monitor
   - Ou código-fonte do QEMU AVR revela mapeamento correto

3. **Contribuição externa**
   - Outro desenvolvedor com experiência em QEMU AVR resolve o problema
   - Ou projeto similar (ex: Wokwi) open-sources sua solução

---

## Referências

- [QEMU AVR Target Documentation](https://www.qemu.org/docs/master/system/target-avr.html)
- [QEMU Monitor Commands](https://www.qemu.org/docs/master/system/monitor.html)
- [ATmega328P Datasheet](https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf) – I/O Memory Map (seção 6)
- [Issue relacionado](https://gitlab.com/qemu-project/qemu/-/issues/869) – QEMU AVR working example

---

## Arquivos relacionados (histórico)

- `server/QEMUGPIOService.ts` (versão com tentativas de `xp` + offset + shadow)
- `poc/gpio_test/gpio_test.ino` (versões com `NeuroForgeGPIO.h` + shadow)
- Commits:
  - `db368b0` – fix: Aplicar offset 0x20 para ler registradores de I/O AVR via xp
  - `1084c02` – feat: ler estado de PORTB a partir de shadow em RAM

---

## Notas finais

Esta abordagem **não foi abandonada permanentemente**, apenas adiada até que as condições acima sejam atendidas. O protocolo Serial é uma solução pragmática que permite avançar o projeto sem ficar bloqueado por um detalhe interno do QEMU AVR.

Quando/se esta abordagem for retomada, os aprendizados e testes realizados até agora servirão de base para uma solução mais rápida.
