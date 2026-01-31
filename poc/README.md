# NeuroForge QEMU POC

Proof of Concept para validar a integração do QEMU com o NeuroForge.

## Estrutura

```
poc/
├── blink/
│   └── blink.ino              # Teste básico de LED
├── serial_test/
│   └── serial_test.ino        # Teste de Serial Monitor
├── gpio_test/
│   └── gpio_test.ino          # Teste de múltiplos pinos
├── compile.ps1                # Script de compilação
├── run_qemu.ps1               # Script de execução QEMU
└── README.md
```

## Quick Start

### 1. Instalar dependências

```powershell
choco install qemu arduino-cli -y
```

### 2. Compilar sketches

```powershell
cd poc
.\compile.ps1
```

### 3. Executar no QEMU

```powershell
# Teste básico (blink)
.\run_qemu.ps1 -Sketch blink

# Teste de serial
.\run_qemu.ps1 -Sketch serial_test

# Teste de GPIO
.\run_qemu.ps1 -Sketch gpio_test
```

## Output Esperado

### blink.ino
Não há output visual (LED é GPIO interno). Para validar:
- Usar QEMU monitor para ler PORTB
- Verificar bit 5 alternando entre 0 e 1

### serial_test.ino
```
=== NeuroForge QEMU Test ===
Initializing...
Setup complete!
[Cycle 0] LED ON
[Cycle 0] LED OFF
[Cycle 1] LED ON
[Cycle 1] LED OFF
...
```

### gpio_test.ino
```
GPIO Test Starting...
Setup complete!
Pin 8 HIGH
Pin 9 HIGH
Pin 10 HIGH
Pin 11 HIGH
Pin 12 HIGH
Pin 13 HIGH
All pins HIGH
All pins LOW
...
```

## Troubleshooting

Veja [docs/QEMU_SETUP.md](../docs/QEMU_SETUP.md) para guia completo.

## Validação

Para considerar o POC bem-sucedido:

- [ ] Compilação bem-sucedida dos 3 sketches
- [ ] Execução sem erros no QEMU
- [ ] Serial output capturado corretamente
- [ ] Timing de delay() funciona (1s = 1s real)
- [ ] GPIO pode ser lido via QEMU monitor

## Próximos Passos

1. Criar script Python para polling de GPIO
2. Integrar com Node.js (child_process)
3. Implementar QEMUSimulationEngine.ts
4. Conectar LEDNode ao PORTB real
