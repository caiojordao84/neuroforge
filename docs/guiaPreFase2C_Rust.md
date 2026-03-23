# Especificação Definitiva — Data Models & Painéis Completos

## Escopo deste Documento

Este guia cobre os painéis de propriedades dos componentes **PERIFÉRICOS**:
`LEDPropertiesPanel`, `RGBLEDPropertiesPanel`, `ServoPropertiesPanel`,
`PotentiometerPropertiesPanel`, `ButtonPropertiesPanel`.

O `MCUPropertiesPanel` é especificado separadamente (tem dependências exclusivas do
`simulationStore` — boardConfigs, MCUConfig, Language).

---

## Decisões de Arquitectura Transversais

Antes de tudo, três regras que se aplicam a **todos os painéis**:

1. **Campos derivados de `connections` são sempre read-only** — pin mapping, wiring status e valores em tempo-real são calculados, nunca editáveis directamente pelo utilizador
2. **`servoType`** determina qual UI é renderizada dentro do mesmo painel — não são componentes separados
3. **Resistores RGB** ficam no `data` do `RGBLEDNode` para a 2E consumir, mas são configurados já no painel agora

***

## 📐 Tipos Definitivos — `src/types/index.ts` (adições)

```ts
// --- SERVO ---
export type ServoType = 'standard_90' | 'standard_180' | 'standard_270' | 'continuous_360';

export interface ServoModel {
  name: string;
  servoType: ServoType;
  minAngle: number;          // 0 para todos
  maxAngle: number;          // 90 | 180 | 270 | 360
  minPulse: number;          // µs
  maxPulse: number;          // µs
  voltage: string;           // ex: "4.8–6V"
  torque: string;            // ex: "1.8 kg·cm @ 4.8V"
  current_stall: string;     // ex: "700mA"
  notes: string;             // ex: "Continuous rotation: PWM controls speed & direction"
}

// --- POTENCIÔMETRO ---
export type TaperType = 'linear' | 'log' | 'antilog';

// --- RGB LED ---
export interface RGBChannelConfig {
  forwardVoltage: number;    // Vf do canal (V)
  resistor: number | 'USER'; // Resistor série do canal (Ω)
  customResistance?: number; // Só se resistor === 'USER'
}
```

***

## 🟡 ServoPropertiesPanel — Especificação Completa

### `servoModels` definitivo

```ts
const servoModels: ServoModel[] = [
  {
    name: 'SG50',
    servoType: 'standard_90',
    minAngle: 0, maxAngle: 90,
    minPulse: 500, maxPulse: 2400,
    voltage: '4.8–6V', torque: '1.5 kg·cm @ 4.8V',
    current_stall: '650mA',
    notes: 'Compact 90° servo. Good for tight space applications.'
  },
  {
    name: 'SG90',
    servoType: 'standard_180',
    minAngle: 0, maxAngle: 180,
    minPulse: 500, maxPulse: 2400,
    voltage: '4.8–5V', torque: '1.8 kg·cm @ 4.8V',
    current_stall: '700mA',
    notes: 'Standard micro servo. Ideal for small robotics.'
  },
  {
    name: 'MG996R',
    servoType: 'standard_180',
    minAngle: 0, maxAngle: 180,
    minPulse: 500, maxPulse: 2500,
    voltage: '4.8–7.2V', torque: '9.4 kg·cm @ 4.8V',
    current_stall: '2500mA',
    notes: 'High-torque metal gear servo.'
  },
  {
    name: 'DS3218',
    servoType: 'standard_270',
    minAngle: 0, maxAngle: 270,
    minPulse: 500, maxPulse: 2500,
    voltage: '4.8–6.8V', torque: '21 kg·cm @ 4.8V',
    current_stall: '1500mA',
    notes: 'Wide-angle servo. 270° travel range.'
  },
  {
    name: 'FS90R',
    servoType: 'continuous_360',
    minAngle: 0, maxAngle: 360,
    minPulse: 500, maxPulse: 2500,
    voltage: '4.8–6V', torque: '1.3 kg·cm @ 4.8V',
    current_stall: '800mA',
    notes: 'Continuous rotation. PWM ~1500µs = stop; <1500µs = CCW; >1500µs = CW.'
  },
];
```

### `ServoNodeData` interface definitiva

```ts
interface ServoNodeData {
  id?: string;
  label?: string;
  modelName?: string;
  servoType?: ServoType;        // NOVO — derivado do modelo mas guardado
  minAngle?: number;
  maxAngle?: number;
  initialAngle?: number;        // Para standard: ângulo inicial (0–maxAngle)
  initialSpeed?: number;        // NOVO — Para continuous: -100 a +100 (%), 0 = stop
  minPulseWidth?: number;
  maxPulseWidth?: number;
  pwmFrequency?: number;
  smoothing?: number;           // 0.0–1.0 → step = lerp(5, 0.3, smoothing) no node
  connectedPin?: number;        // read-only, derivado das connections
  isPwmPin?: boolean;           // read-only, derivado do boardConfig
}
```

### Secções do Painel

**1. Header** — Ícone `Cog`, título "Servo Properties", botões Reset + Save

**2. Identification**
- `ID` — read-only, campo input cinza
- `Display Name` — editável
- `Model` — Select com todos os 5 modelos (ordem: 90° → 180° → 270° → 360°)
  - Ao mudar modelo: preenche automaticamente `servoType`, `minAngle`, `maxAngle`, `minPulse`, `maxPulse`
  - Abaixo do Select: info card com `voltage`, `torque`, `current_stall`, `notes`

> **NOTA DE IMPLEMENTAÇÃO:** O info card (voltage, torque, current_stall, notes) é **SEMPRE
> derivado via lookup** `servoModels.find(m => m.name === localData.modelName)`. Estes campos
> **não persistem no `ServoNodeData`** — não incluir no `setNodes()` ao fazer Save. Apenas
> `modelName` e `servoType` são guardados no nó.

**3. Wiring** — read-only
- `Signal Pin` → `D9 (PWM) ✓` / `Not connected ⚠`
- `Power (VCC)` → `Connected ✓` / `Not connected ⚠`
- `Ground (GND)` → `Connected ✓` / `Not connected ⚠`
- Se pin não é PWM: badge vermelho "⚠ Pin D{n} is not PWM-capable"

**4. Motion Configuration** — condicional por `servoType`

Se `servoType !== 'continuous_360'` (standard 90/180/270):
```
┌ Min Angle (°) ┬ Max Angle (°) ┐   [grid 2 cols, read-only se modelo fixo]
└───────────────┴───────────────┘
  Initial Angle (°)  [slider 0–maxAngle]
```

Se `servoType === 'continuous_360'`:
```
┌ PWM Neutral (µs) ┐   [read-only, = (minPulse+maxPulse)/2]
  Initial Speed (%)   [slider -100 a +100, 0 = stop]
  ├ -100% = Full CCW (minPulse µs)
  ├   0%  = Stop (~1500 µs)
  └ +100% = Full CW (maxPulse µs)
```

**5. PWM Configuration**
```
┌ Min Pulse (µs) ┬ Max Pulse (µs) ┐
└────────────────┴────────────────┘
  PWM Frequency (Hz)   [default 50]
  PWM Mapping (read-only info):
    PWM  0/255 → minAngle° (minPulse µs)
    PWM 127/255 → midAngle° (midPulse µs)
    PWM 255/255 → maxAngle° (maxPulse µs)
  Movement Damping   [slider 0–100%]
    Hint: "0% = instant, 100% = slow & smooth"
```

**6. Preview** — condicional por `servoType`

Standard:
- SVG circular com corpo do servo (simplificado)
- Arco tracejado de `minAngle` a `maxAngle` como range visual
- Agulha/braço apontando para `initialAngle`
- Marcas nos limites min/max
- Label: `{initialAngle}° / {maxAngle}°`

Continuous:
- Seta circular de rotação com velocidade indicada
- `CW` / `STOP` / `CCW` consoante `initialSpeed`
- Label: `Speed: {initialSpeed}%`

### Lógica de `smoothing` → `ServoNode`

O node deve ler `data.smoothing` e calcular:
```ts
const dampStep = 0.5 + (1 - (data.smoothing ?? 0.5)) * 4.5; // 0.5 a 5.0
// interval 16ms fixo, step variável
```

***

## 🟠 RGBLEDPropertiesPanel — Especificação Completa

### `RGBLEDNodeData` interface definitiva

```ts
interface RGBLEDNodeData {
  id?: string;
  label?: string;
  isCommonAnode?: boolean;
  // Cor inicial (para preview e initialState === 'solid')
  r?: number;   // 0–255
  g?: number;   // 0–255
  b?: number;   // 0–255
  brightness?: number;  // 0.0–1.0
  initialState?: 'off' | 'solid' | 'rainbow' | 'pulse';
  pulseSpeed?: number;    // 0.5–5x — velocidade do ciclo pulse (só se initialState === 'pulse')
  rainbowSpeed?: number;  // 0.5–5x — velocidade do ciclo rainbow (só se initialState === 'rainbow')
                            // default: 1.0 para ambos
  // Electrical por canal
  rForwardVoltage?: number;
  gForwardVoltage?: number;
  bForwardVoltage?: number;
  rResistor?: number | 'USER';   // NOVO
  gResistor?: number | 'USER';   // NOVO
  bResistor?: number | 'USER';   // NOVO
  rCustomResistance?: number;    // NOVO, só se rResistor === 'USER'
  gCustomResistance?: number;    // NOVO
  bCustomResistance?: number;    // NOVO
  nominalCurrent?: number;       // NOVO — partilhado pelos 3 canais, default 0.020 A
  // Read-only, derivado das connections
  connectedPins?: {
    red?: number; green?: number; blue?: number; common?: string; // 'VCC'|'GND'|undefined
  };
}
```

### Secções do Painel

**1. Header** — Ícone `Palette`, título "RGB LED Properties", Reset + Save

**2. Identification**
- `ID` — read-only
- `Display Name` — editável
- `Common Anode` — Switch toggle
  - Se `true`: nota informativa — "Common pin connects to VCC (+). Each channel is LOW to activate."
  - Se `false`: nota — "Common pin connects to GND (−). Each channel is HIGH to activate."

**3. Pin Mapping** — read-only, nova secção
```
R → D3 ✓  |  G → D5 ✓  |  B → D6 ✓  |  Common → GND ✓
```
Cada pin mostra ✓ verde se conectado, ⚠ laranja se não.

**4. Color (RGB)**
- Color picker nativo `<input type="color">` que sincroniza bidirecionalmente com R/G/B
- Sliders individuais R / G / B (0–255) com cores respectivas
- Brightness slider (0–100%)
- Preview circular dinâmico:
  ```ts
  // Se isCommonAnode, a cor real activa é o inverso
  const displayR = isCommonAnode ? 255 - r : r;
  const displayG = isCommonAnode ? 255 - g : g;
  const displayB = isCommonAnode ? 255 - b : b;
  ```
- `box-shadow` com glow quando `initialState !== 'off'`

**5. Electrical (per channel)**
```
         R               G               B
Vf (V)  [2.0]          [3.2]           [3.2]
R (Ω)   [Select▾]      [Select▾]       [Select▾]
```
Select usa os mesmos `resistorOptions` do LED simples: `47, 68, 100, 150, 220, 330, 470, 1000, 2200, USER`
Se `USER`: aparece input numérico inline

Abaixo dos 3 resistores:
- `Nominal Current (shared)` — input numérico, default 20mA

**6. Live Calculations** — read-only, calculado em tempo real (sem simulação activa, usa `getActiveMicrocontrollerProfile()`)

```ts
import { calculateRealCurrent, getSafetyStatus, getActiveMicrocontrollerProfile } from '@/lib/ledCalculations';

const mcu = getActiveMicrocontrollerProfile(); // ex: Arduino = 5.0V, 40mA max

function calcChannelLive(
  Vf: number,
  resistor: number | 'USER',
  customResistance: number | undefined,
  nominalCurrent: number = 0.020
): { current_ma: number; status: 'safe' | 'warning' | 'error' | 'burned' } {
  const R = resistor === 'USER' ? (customResistance ?? 220) : resistor;
  const I = calculateRealCurrent(mcu.v_out, Vf, R); // A
  const status = getSafetyStatus(I, nominalCurrent, mcu.max_ma);
  return { current_ma: Math.round(I * 1000), status };
}

// Uso no componente:
const chR = calcChannelLive(data.rForwardVoltage ?? 2.0, data.rResistor ?? 220, data.rCustomResistance, data.nominalCurrent ?? 0.020);
const chG = calcChannelLive(data.gForwardVoltage ?? 3.2, data.gResistor ?? 220, data.gCustomResistance, data.nominalCurrent ?? 0.020);
const chB = calcChannelLive(data.bForwardVoltage ?? 3.2, data.bResistor ?? 220, data.bCustomResistance, data.nominalCurrent ?? 0.020);
// → { current_ma: 12.7, status: 'safe' }
```

Limiares de `getSafetyStatus`: `safe` → I < 20mA; `warning` → I ≥ 20mA; `error` → I > mcu.max_ma; `burned` → I > nominalCurrent × 1.5.

Cores: verde `safe`, amarelo `warning`, vermelho `error`, cinza `burned`

**7. Simulation**
- `Initial State` — Select: Off / Solid Color / Rainbow Cycle / Pulse

Se initialState === 'pulse':
  Pulse Speed  [slider 0.5x–5x]

Se initialState === 'rainbow':
  Rainbow Speed  [slider 0.5x–5x]
  Hint: "1x ≈ full cycle in 5s"

**8. Runtime Behaviour (RGBLEDNode)**

O `RGBLEDNode` tem dois modos de operação:

```
Comportamento A — Simulation RUNNING:
  O node escuta pinChange (analogWrite nos canais R/G/B) e obedece aos pinos.
  initialState é ignorado. O utilizador controla o LED via código ASL.

Comportamento B — Simulation STOPPED:
  initialState define o visual de demo do node.
  'off'     → rgbColor = {0,0,0}
  'solid'   → rgbColor = {r, g, b} com brightness aplicado
  'pulse'   → setInterval itera brightness 0→1→0, período = 1000/pulseSpeed ms
  'rainbow' → setInterval itera hue HSL 0→360, período = 50/rainbowSpeed ms
```

**Implementação no `RGBLEDNode.tsx`:**

```ts
const simStatus = useSimulationStore(s => s.status);
const [demoColor, setDemoColor] = useState({r:0, g:0, b:0});

useEffect(() => {
  if (simStatus === 'running') return;

  const initialState = data.initialState as string ?? 'off';

  if (initialState === 'off') { setDemoColor({r:0,g:0,b:0}); return; }
  if (initialState === 'solid') {
    const brt = (data.brightness as number) ?? 1;
    setDemoColor({
      r: Math.round(((data.r as number) ?? 255) * brt),
      g: Math.round(((data.g as number) ?? 255) * brt),
      b: Math.round(((data.b as number) ?? 255) * brt),
    }); return;
  }
  if (initialState === 'pulse') {
    const speed = (data.pulseSpeed as number) ?? 1;
    let t = 0;
    const id = setInterval(() => {
      t += 0.05 * speed;
      const brt = (Math.sin(t) + 1) / 2;
      setDemoColor({r: Math.round(((data.r as number) ?? 255)*brt), g: Math.round(((data.g as number) ?? 255)*brt), b: Math.round(((data.b as number) ?? 0)*brt)});
    }, 16);
    return () => clearInterval(id);
  }
  if (initialState === 'rainbow') {
    const speed = (data.rainbowSpeed as number) ?? 1;
    let hue = 0;
    const id = setInterval(() => {
      hue = (hue + speed) % 360;
      const [r,g,b] = hslToRgb(hue, 1, 0.5);
      setDemoColor({r, g, b});
    }, 16);
    return () => clearInterval(id);
  }
}, [simStatus, data.initialState, data.r, data.g, data.b, data.brightness, data.pulseSpeed, data.rainbowSpeed]);

// displayColor usa demoColor quando parado, rgbColor quando a correr
const activeColor = simStatus === 'running' ? rgbColor : demoColor;
```

**`hslToRgb` — `src/lib/colorUtils.ts` (novo ficheiro):**
```ts
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
```

***

## 🟡 PotentiometerPropertiesPanel — Especificação Completa

### `PotentiometerNodeData` interface definitiva

```ts
interface PotentiometerNodeData {
  id?: string;
  label?: string;
  resistance?: number;        // Total (Ω), default 10000
  tolerance?: number;         // ±%, default 20
  taper?: TaperType;          // 'linear' | 'log' | 'antilog'
  powerRating?: number;       // W, default 0.5
  initialValue?: number;      // 0–100 (%) — posição de arranque (config, persistida no data)
  wiperPosition?: number;     // 0–100 (%) — posição actual em runtime (não persistida no save)
                               // Inicializada de initialValue; alterada pelo slider em tempo real
                               // O node usa wiperPosition para calcular; o painel salva initialValue
  // Read-only, derivado das connections
  connectedPin?: number;
  connectedPinType?: 'A' | 'D'; // analógico vs digital
  isWiredVcc?: boolean;
  isWiredGnd?: boolean;
}
```

> **Nota de implementação:** `initialValue` é o único campo persistido em `setNodes`. `wiperPosition` é estado local do painel (`$state` em Svelte / `useState` em React) e é descartado ao fechar o painel. Ao abrir o painel, `wiperPosition` é inicializado com `initialValue`. O slider de **Simulation** escreve apenas em `wiperPosition` e emite `analogChange` directamente; o botão **Save** persiste `initialValue = wiperPosition` no nó.

### Função `taperMap` (nova, em `src/lib/potentiometerCalculations.ts`)

```ts
export function taperMap(percentage: number, taper: TaperType): number {
  const p = percentage / 100; // 0–1
  switch (taper) {
    case 'log':
      // Logarithmic: slow at bottom, fast at top (audio taper / Type A)
      return p === 0 ? 0 : Math.log10(1 + 9 * p) / Math.log10(10);
    case 'antilog':
      // Anti-logarithmic: fast at bottom, slow at top (Type C)
      return 1 - Math.log10(1 + 9 * (1 - p)) / Math.log10(10);
    case 'linear':
    default:
      return p;
  }
}

export function getWiperResistance(
  totalResistance: number,
  percentage: number,
  taper: TaperType
): number {
  return totalResistance * taperMap(percentage, taper);
}

export function getWiperVoltage(percentage: number, taper: TaperType, vcc = 5.0): number {
  return vcc * taperMap(percentage, taper);
}
```

O `PotentiometerNode` deve importar `taperMap` e aplicar ao emitir `analogChange`:
```ts
const mappedValue = Math.round(taperMap(percentage, taper) * 1023);
simulationEngine.emit('analogChange', { pin: connectedPin, value: mappedValue, percentage });
```

### Secções do Painel

**1. Header** — Ícone `SlidersHorizontal`, título "Potentiometer Properties", Reset + Save

**2. Identification**
- `ID` — read-only
- `Display Name` — editável

**3. Wiring** — read-only
```
Signal (Wiper) → A0 ✓
VCC (+)        → Connected ✓
GND (−)        → Not connected ⚠
```
Se `connectedPinType === 'D'`: aviso amarelo "⚠ Signal connected to digital pin D{n}. Use an analog pin (A0–A5) for correct ADC readings."

**4. Electrical Specifications**
- `Total Resistance (Ω)` — input numérico, step 100
- `Tolerance (±%)` — input numérico
- `Taper Type` — Select: Linear (B) / Logarithmic (A) / Anti-Log (C)
  - Abaixo: mini gráfico SVG da curva seleccionada (30×30px inline, 3 pontos: início, meio, fim)
  - Linear: linha recta | Log: curva côncava | Antilog: curva convexa
- `Power Rating (W)` — input numérico

**5. Simulation**
- `Initial Position` — slider 0–100% com label dinâmico

**`handleReset` do painel:**
```ts
const handleReset = () => {
  if (!selectedNode) return;
  setLocalData({
    id: selectedNode.id,
    label: selectedNode.data.label as string, // ← preserva o nome guardado, não reseta
    resistance: 10000,
    tolerance: 20,
    taper: 'linear',
    powerRating: 0.5,
    initialValue: 50,
    wiperPosition: 50,
  });
  setHasChanges(false);
};
// Reset não faz setNodes() — mantém o nó até o utilizador clicar Save
```

> **Regra transversal:** Reset **nunca reseta o label** — sempre restaura o último valor salvo
> do nó, não os defaults do sistema.
  - Label: `{wiperPos}% → {getWiperResistance(...).toFixed(0)}Ω → {getWiperVoltage(...).toFixed(2)}V`
- Slider interactivo **também activo durante simulação** — ao mover, emite directamente `analogChange` via `simulationEngine` (sem precisar de Save)

**6. Live Value** — read-only, actualiza em tempo real durante simulação
```
ADC:     512
Voltage: 2.50V
Wiper R: 5.00kΩ
```
Barra de progresso visual com cor `#00d9ff`.

***

## 🟢 ButtonPropertiesPanel — Especificação Completa

O painel actual está **razoavelmente completo** — os gaps são menores. Especificação das adições:

### `ButtonNodeData` — adições

```ts
interface ButtonNodeData {
  // existentes mantêm-se...
  type?: 'momentary' | 'toggle';  // NOVO — default: 'momentary'
                                   // momentary: activo só enquanto pressionado
                                   // toggle: inverte estado a cada press e mantém
  isWiredGnd?: boolean;   // NOVO — read-only, derivado das connections (handle 'ground')
  isWiredExt?: boolean;   // NOVO — read-only, handle 'external' (só existe se pullResistor === 'NONE')
}
```

### Adições ao Painel

**Na secção Identification** (existente) — adicionar:
```
Button Type → Select: Momentary / Toggle
  Momentary: "Active only while held. Releases on mouse-up."
  Toggle:    "Each press inverts state. Stays ON until pressed again."
```

> **Nota comportamental:** Para `toggle`, `isPressed` passa a ser um estado persistente — o node não deve resetar ao `mouseup`, mas sim inverter a cada `click`.

**Na secção Identification** (existente) — também adicionar:
```
Ground/VCC handle → Connected ✓ / Not connected ⚠
```

**Na secção Electrical** — melhorar:
- `Debounce Time`: adicionar hint abaixo: `"Typical: 5–50ms hardware, 50–200ms software"`
- `Pull Resistor` → label dinâmica mais descritiva (já existe — apenas enriquecer):
  - NONE: `"No pull — behavior depends on wiring or MCU INPUT_PULLUP"`
  - PULLUP: `"Default HIGH → Press sends LOW (Active-Low)"`
  - PULLDOWN: `"Default LOW → Press sends HIGH (Active-High)"`

**Nova secção "Logic Behaviour"** (entre Electrical e Simulation):
```
┌─────────────────────────────────────────┐
│ PULLUP:    Released = HIGH  Pressed = LOW  │
│ PULLDOWN:  Released = LOW   Pressed = HIGH │
│ NONE:      Auto-detect MCU pull-up mode    │
│            (reads pinMode of connected pin) │
└─────────────────────────────────────────┘
```
Card com fundo `#151b24`, bordas `rgba(0,217,255,0.2)`, texto 11px.

**Se `pullResistor === 'NONE'`** — card de aviso amarelo visível (gap 4 da análise):
```
⚠️  Floating Input Risk
Without pull resistor the pin may read random
values when button is released.
→ Use PULLUP / PULLDOWN, or wire 'External' pin
  to VCC (active-high) or GND (active-low).
```

**Secção Preview** — botão interactivo:
- Click/hold dispara `setLocalData({...isPressed: true/false})`
- Mostra ON/OFF animado (apenas visual — sem emitir eventos para o engine durante design)
- Label "Hold to test"

***

## 🔴 LEDPropertiesPanel — Adições

Os gaps identificados na análise são **adições ao painel existente**. Alterações ao `LEDNodeData`:

### `ledProfiles` — extende o `ledCalculations.ts` existente

> **IMPORTANTE:** Não criar um segundo `ledProfiles`. Os perfis `IR`, `RGB`, `COLD`, `WARM` devem ser **adicionados ao `ledProfiles` já existente** em `src/lib/ledCalculations.ts`. O `luminousIntensity` do guia corresponde ao campo `mcd` do objeto existente.
>
> Campo `Vf` usa os valores já definidos em `ledCalculations.ts`.

Perfis a adicionar ao `ledCalculations.ts` existente:
```ts
IR:    { hex: '#660000', vf: 1.4, mcd: 0 },
RGB:   { hex: '#ff00ff', vf: 3.2, mcd: 5000 },
COLD:  { hex: '#cce6ff', vf: 3.3, mcd: 14000 },
WARM:  { hex: '#ffcc88', vf: 3.1, mcd: 13000 },
```

No painel LED o lookup é:
```ts
const profile = ledProfiles[localData.colorProfile ?? 'RED'];
const displayColor = localData.colorProfile === 'USER'
  ? (localData.customColorHex ?? '#cccccc')
  : profile.hex;
```

```ts
// Adições ao tipo existente
interface LEDNodeData {
  // existentes mantêm-se...
  brightnessOverride?: number;  // NOVO — 0.0–1.0, override visual independente de I_real
  // read-only
  isBurned?: boolean;
  isProperlyWired?: boolean;
  connectedPinAnode?: number;
  connectedPinCathode?: string; // 'GND' | 'D{n}'
}
```

**Adições ao painel:**

**Secção Identification** — adicionar:
- `Connection Status` (read-only):
  ```
  Anode  → D13 ✓
  Cathode → GND ✓
  ```

**Secção Optical & Simulation** — adicionar:
- Se `isBurned === true`: banner `🔥 LED Burned — overcurrent detected. Reset simulation to restore.`
- Slider `Simulation Brightness Override` (0–100%) — força `opacity` do preview independente de I_real

**Secção Preview** (nova, equivalente ao RGB):
```tsx
const profile = ledProfiles[localData.colorProfile ?? 'RED'];
const displayColor = localData.colorProfile === 'USER'
  ? (localData.customColorHex ?? '#cccccc')
  : profile.hex;

const brightness = localData.brightnessOverride ?? 1.0;
const isOnPreview = brightness > 0; // LED simples não tem initialState — usa brightnessOverride
const opacity = isOnPreview ? 0.3 + brightness * 0.7 : 0.2;
const glowColor = displayColor + '99'; // 60% alpha

<div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
  <div
    className="w-12 h-12 rounded-full transition-all duration-300 relative"
    style={{
      backgroundColor: displayColor,
      opacity,
      boxShadow: isOnPreview ? `0 0 20px 6px ${glowColor}` : 'none',
    }}
  >
    {/* Specular highlight */}
    <div className="absolute top-1 left-2 w-4 h-2.5 rounded-full bg-white opacity-40" />
    {/* Status dot */}
    <div className={cn(
      'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-[#0a0e14]',
      localData.isBurned ? 'bg-red-500' :
      isOnPreview ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
    )} />
  </div>
</div>
{localData.isBurned && (
  <p className="text-center text-[11px] text-red-400 mt-1">🔥 Burned</p>
)}
```

**Secção Safety** — melhorar cores:
- `safe` → texto/badge verde
- `warning` → amarelo  
- `error` → laranja
- `burned` → vermelho com fundo ligeiramente avermelhado

***

## Ordem de Implementação na Branch `preRust`

```
1. src/lib/colorUtils.ts                          [NOVO ficheiro — hslToRgb partilhada]
2. src/lib/potentiometerCalculations.ts           [NOVO ficheiro]
3. src/lib/ledCalculations.ts                     [adicionar IR/RGB/COLD/WARM ao ledProfiles existente]
4. src/types/index.ts                             [adicionar ServoType, ServoModel, TaperType, RGBChannelConfig]
5. src/components/nodes/ServoNode.tsx             [ler smoothing, ler servoType, ler initialSpeed]
6. src/components/nodes/PotentiometerNode.tsx    [importar taperMap, aplicar ao emit]
7. src/components/nodes/RGBLEDNode.tsx            [ler rResistor/gResistor/bResistor do data; implementar pulse/rainbow demo]
8. src/components/ServoPropertiesPanel.tsx        [reescrita completa + modelo SG50]
9. src/components/RGBLEDPropertiesPanel.tsx       [ledProfiles extendido, resistores, pin mapping, live calc, rainbowSpeed]
10. src/components/PotentiometerPropertiesPanel.tsx [taper curve, live value, slider RT, handleReset]
11. src/components/ButtonPropertiesPanel.tsx      [floating card, logic section, preview interactivo]
12. src/components/LEDPropertiesPanel.tsx         [connection status, preview visual, burned banner]
```

---

## 📋 Tabela de Persistência de Estado

> **Regra de ouro:** Se o valor é derivável deterministicamente de outro campo
> persistido, **não persiste**. Se é uma escolha do utilizador, **persiste**.

| Campo | Componente | Persistido (setNodes) | Notas |
|---|---|---|---|
| `initialAngle` | Servo | ✅ | |
| `initialSpeed` | Servo (continuous) | ✅ | |
| `servoType` | Servo | ✅ | Derivado do modelo ao salvar; muda comportamento do node |
| `modelName` | Servo | ✅ | |
| `pulseSpeed` | RGB LED | ✅ | |
| `rainbowSpeed` | RGB LED | ✅ | |
| `brightnessOverride` | LED simples | ✅ | `undefined` = automático |
| `taper` | Potenciómetro | ✅ | Afecta o valor ADC emitido |
| `initialValue` | Potenciómetro | ✅ | O único persistido; `wiperPosition` é estado local |
| `type` (momentary/toggle) | Button | ✅ | Campo escrito como `type` no `handleSave` — não `buttonType` |
| `isPressed` | Button | ✅ | Estado inicial guardado |
| `wiperPosition` | Potenciómetro | ❌ | Estado local do painel durante sessão |
| `analogValue` (runtime) | Potenciómetro | ❌ | Estado do node em runtime |
| `connectedPin` | Todos | ❌ | Derivado de `connections` em cada render |
| `connectedPins` | RGB LED | ❌ | Derivado de `connections` |
| `isBurned` | LED | ❌ | Calculado em runtime; reseta ao parar simulação |
| `isOn` | LED | ❌ | Estado de runtime |
| `rgbColor` (runtime) | RGB LED | ❌ | pulse/rainbow/pinChange — estado de runtime |
| `isProperlyWired` | Todos | ❌ | Derivado de `connections` |
| `voltage/torque/currentStall` | Servo | ❌ | Lookup-only de `servoModels` |
| `isFloating` | Button | ❌ | Derivado de wiring + pullResistor; recalculado |

***


