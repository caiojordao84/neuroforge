# NeuroForge - Boards Documentation

## 📁 Estrutura de Diretórios

```
src/components/boards/
├── arduino/
│   └── svg/
│       └── arduino-uno-r3.svg          # SVG oficial Arduino Uno R3
├── esp32/
│   └── svg/
│       └── (futuro: esp32-devkit.svg)
├── raspberry-pi-pico/
│   └── svg/
│       └── (futuro: pi-pico.svg)
└── board-schema.json                    # Schema de validação das boards
```

---

## 🎨 Arduino Uno R3 SVG Board

### Visão Geral

Implementação realista da placa Arduino Uno R3 usando SVG oficial, com handles coloridos pixel-perfect mapeados exatamente sobre os pinos físicos.

### Arquivos Principais

- **SVG Asset**: `src/components/boards/arduino/svg/arduino-uno-r3.svg`
- **Componente**: `src/components/nodes/MCUNode.tsx`
- **Configuração**: `src/data/components-library.ts` (item "Arduino Uno R3 (SVG)")

### Especificações Técnicas

#### Dimensões

```typescript
const SVG_VIEWBOX_WIDTH = 171;      // Largura do viewBox do SVG
const SVG_VIEWBOX_HEIGHT = 129;     // Altura do viewBox do SVG
const SVG_RENDER_WIDTH = 260;       // Largura renderizada (pixels)
const SVG_RENDER_HEIGHT = 196;      // Altura calculada proporcionalmente
const SCALE = 1.52;                 // Fator de escala (260/171)
```

#### Pinos e Coordenadas

```typescript
const PIN_RADIUS = 2.198;           // Raio dos círculos de pino no SVG
const PIN_DIAMETER = 6.69;          // Diâmetro escalado (2.198 * 2 * 1.52)
```

### Mapeamento de Pinos

Todos os 31 pinos são mapeados com coordenadas exatas do SVG:

#### Pinos Digitais (Fila Superior)

| ID | cx | cy | Posição |
|-----|---------|-------|----------|
| D0 | 159.977 | 3.933 | Top |
| D1 | 153.705 | 3.933 | Top |
| D2 | 147.433 | 3.933 | Top |
| D3 | 141.162 | 3.933 | Top |
| D4 | 134.89 | 3.933 | Top |
| D5 | 128.618 | 3.933 | Top |
| D6 | 122.346 | 3.933 | Top |
| D7 | 116.075 | 3.933 | Top |
| D8 | 105.789 | 3.933 | Top |
| D9 | 99.517 | 3.933 | Top |
| D10 | 93.245 | 3.933 | Top |
| D11 | 86.974 | 3.933 | Top |
| D12 | 80.702 | 3.933 | Top |
| D13 | 74.43 | 3.933 | Top |

#### Pinos Especiais (Fila Superior)

| ID | cx | cy | Função |
|------|--------|-------|------------|
| GND | 68.158 | 3.933 | Ground |
| AREF | 61.886 | 3.933 | Reference |
| SDA | 55.615 | 3.933 | I2C Data |
| SCL | 49.343 | 3.933 | I2C Clock |

#### Pinos Analógicos (Fila Inferior)

| ID | cx | cy | Posição |
|----|---------|---------|----------|
| A0 | 128.832 | 123.071 | Bottom |
| A1 | 135.103 | 123.071 | Bottom |
| A2 | 141.375 | 123.071 | Bottom |
| A3 | 147.647 | 123.071 | Bottom |
| A4 | 153.919 | 123.071 | Bottom |
| A5 | 160.191 | 123.071 | Bottom |

#### Pinos de Alimentação (Fila Inferior)

| ID | cx | cy | Função |
|---------|---------|---------|------------------|
| VIN | 116.288 | 123.071 | Voltage Input |
| GND_1 | 110.016 | 123.071 | Ground 1 |
| GND_2 | 103.745 | 123.071 | Ground 2 |
| 5V | 97.473 | 123.071 | 5V Power |
| 3V3 | 91.201 | 123.071 | 3.3V Power |
| RESET | 84.929 | 123.071 | Reset |
| IOREF | 78.658 | 123.071 | IO Reference |

---

## 🎨 Esquema de Cores dos Pinos

### Função `getPinColor(pinId: string)`

Cada tipo de pino possui uma cor específica para identificação visual:

```typescript
if (pinId.startsWith('GND'))           return '#1f2937'; // Cinza escuro
if (pinId === '5V')                    return '#ef4444'; // Vermelho
if (pinId === '3V3')                   return '#f472b6'; // Rosa
if (pinId === 'VIN')                   return '#fbbf24'; // Amarelo/Âmbar
if (pinId === 'RESET')                 return '#9ca3af'; // Cinza médio
if (pinId === 'IOREF')                 return '#60a5fa'; // Azul claro
if (pinId === 'AREF')                  return '#a78bfa'; // Roxo
if (pinId === 'SDA' || pinId === 'SCL') return '#10b981'; // Verde (I2C)
if (pinId.startsWith('A'))             return '#fbbf24'; // Amarelo (analog)
return '#00d9ff';                                         // Ciano (digital)
```

### Tabela de Cores

| Tipo de Pino | Cor | Hex Code | Uso |
|--------------|--------------|----------|---------------------|
| Digital | Ciano | `#00d9ff` | D0-D13 |
| Analógico | Amarelo | `#fbbf24` | A0-A5 |
| 5V | Vermelho | `#ef4444` | Alimentação 5V |
| 3.3V | Rosa | `#f472b6` | Alimentação 3.3V |
| VIN | Âmbar | `#fbbf24` | Entrada de tensão |
| GND | Cinza Escuro | `#1f2937` | Todas as grounds |
| I2C (SDA/SCL)| Verde | `#10b981` | Comunicação I2C |
| AREF | Roxo | `#a78bfa` | Referência analog|
| IOREF | Azul Claro | `#60a5fa` | Referência IO |
| RESET | Cinza Médio | `#9ca3af` | Reset da placa |

---

## 🔧 Implementação Técnica

### Posicionamento Pixel-Perfect

Os handles são posicionados usando coordenadas absolutas em pixels:

```tsx
const left = pin.cx * SCALE;  // Posição X escalada
const top = pin.cy * SCALE;   // Posição Y escalada

<Handle
  style={{
    position: 'absolute',
    left: `${left}px`,           // Pixel-perfect X
    top: `${top}px`,             // Pixel-perfect Y
    transform: 'translate(-50%, -50%)', // Centraliza no pino
    width: PIN_DIAMETER,         // ~6.69px
    height: PIN_DIAMETER,
    borderRadius: '50%',
    background: getPinColor(pin.id),
    opacity: 1,                  // 100% opaco, cobre o pino preto do SVG
  }}
/>
```

### Efeitos Visuais

- **Hover**: Glow effect com `boxShadow: 0 0 8px ${color}`
- **Transition**: Suave transição de 0.2s no box-shadow
- **Opacity**: 100% para cobrir completamente os círculos pretos do SVG

---

## 🔄 Preparado para Rotação Futura

A implementação está pronta para suportar rotação (tecla R = 90°):

```tsx
// Futuro:
const [rotation, setRotation] = useState(0);

<div style={{ transform: `rotate(${rotation}deg)` }}>
  {/* SVG + Handles giram juntos automaticamente */}
</div>
```

**Vantagens:**
- Coordenadas absolutas (não percentuais) mantêm precisão
- Handles giram com o SVG sem recálculo
- Transform CSS nativo = performance alta

---

## 📝 Como Adicionar Novas Boards SVG

### 1. Preparar o SVG

```bash
# Adicionar SVG em:
src/components/boards/{vendor}/svg/{board-name}.svg
```

**Requisitos:**
- ViewBox definido (`viewBox="0 0 width height"`)
- Pinos como `<circle>` com atributos `id`, `cx`, `cy`, `r`
- IDs descritivos (ex: `pin-d0`, `pin-5v`, `pin-gnd-1`)

### 2. Mapear Coordenadas

Extrai as coordenadas de cada `<circle>` do SVG:

```typescript
const PIN_MAP = [
  { id: 'D0', cx: 159.977, cy: 3.933, position: Position.Top },
  // ... mais pinos
];
```

### 3. Definir Cores

Cria função de mapeamento de cores:

```typescript
const getPinColor = (pinId: string): string => {
  if (pinId.startsWith('GND')) return '#1f2937';
  // ... lógica de cores
};
```

### 4. Configurar Componente

Adiciona item em `src/data/components-library.ts`:

```typescript
{
  id: 'mcu-{vendor}-{model}-svg',
  name: '{Vendor} {Model} (SVG)',
  category: 'mcu',
  nodeType: 'mcu',
  data: {
    mcuType: '{vendor}-{model}',
    useSvgBoard: true,  // Flag importante!
  },
}
```

---

## 🎯 Outras Boards (CSS Rendering)

### Arduino Uno (Clássico)

- **Tipo**: CSS-rendered
- **Cores**: Fundo azul `#1a5fb4`, borda `#0d3a7a`
- **Dimensões**: 200x280px
- **Pinos**: Desenhados com divs e CSS

### ESP32 DevKit

- **Tipo**: CSS-rendered
- **Cores**: Fundo verde escuro `#2d5016`, borda `#1a3a0d`
- **Dimensões**: 240x320px
- **Chip**: ESP32 label

### Raspberry Pi Pico

- **Tipo**: CSS-rendered
- **Cores**: Fundo rosa `#c51e4a`, borda `#8b1539`
- **Dimensões**: 240x320px
- **Chip**: RP2040 label

### Migração para SVG

Para migrar boards CSS para SVG:

1. Obter SVG oficial do fabricante ou criar com Inkscape/Figma
2. Seguir passos da seção "Como Adicionar Novas Boards SVG"
3. Testar alinhamento dos handles
4. Atualizar `components-library.ts` com flag `useSvgBoard: true`

---

## 🐛 Troubleshooting

### Handles desalinhados após rotação

**Causa**: Uso de posicionamento percentual.
**Solução**: Sempre usar pixels absolutos (`cx * SCALE`).

### SVG não aparece

**Causa**: Vite não reconhece import do SVG.
**Solução**: Verificar `vite.config.ts` tem plugin SVG ativo.

### Cores dos pinos erradas

**Causa**: ID do pino não corresponde ao pattern em `getPinColor()`.
**Solução**: Ajustar lógica de matching ou IDs dos pinos.

---

## 📚 Referências

- [Arduino Official SVG Resources](https://www.arduino.cc/en/Trademark/HomePage)
- [React Flow Handles Documentation](https://reactflow.dev/api-reference/types/handle)
- [SVG ViewBox MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox)
- Commits relevantes:
  - [Arduino SVG Component Integration](https://github.com/caiojordao84/neuroforge/commit/97f2847a1b186270be350c6088db2e3057953708)
  - [Pixel-perfect Pin Handles](https://github.com/caiojordao84/neuroforge/commit/8a881d740cccec46dc48bbce35a2640739664ac0)
  - [Functional Pin Colors](https://github.com/caiojordao84/neuroforge/commit/28d2f897b5fe026e18fe17a6f99f550ecf37bee1)
  - [Clean SVG Board (no overlays)](https://github.com/caiojordao84/neuroforge/commit/a6c51077cfb8c07d56c0db5e47b0ed498224fbfa)

---

## 🚀 Próximos Passos

- [ ] Implementar rotação com tecla R
- [ ] Adicionar SVGs para ESP32 e Pi Pico
- [ ] Labels de pinos aparecerem ao hover
- [ ] Tooltip com detalhes técnicos do pino
- [ ] Modo "schematic" vs "realistic"
- [ ] Suporte para Arduino Mega, Nano, etc.
