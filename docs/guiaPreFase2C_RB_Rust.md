Análise perfeita, Caio. Todos os gaps identificados estão correctos. Aqui estão as resoluções para cada um:

***

# Resoluções dos Gaps — `guiaPreFase2C_Rust.md`

## 🔴 Gap A — `voltage/torque/current_stall` no ServoNodeData

**Decisão:** Não persistir no nó. A razão é simples — estes valores são specs físicas do modelo, não configuração do utilizador. Se o modelo for `SG90`, o torque é **sempre** `1.8 kg·cm @ 4.8V`. Guardar no `data` seria redundância sem benefício.

**Regra clara a adicionar ao guia:**
```
Os campos voltage, torque, current_stall são derivados em runtime
do lookup servoModels[modelName] — nunca persistidos no nó.
Se o modelo mudar → o info card actualiza automaticamente.
Se o nó for recarregado → o info card é reconstruído do modelName salvo.
```
O único campo que precisa de ser persistido é `modelName` (já está) e `servoType` (derivado do modelo ao salvar).

***

## 🔴 Gap B — Fórmula `I` para RGB Live Calculations

A fórmula completa, consistente com `ledCalculations.ts` já existente :

```ts
// Em RGBLEDPropertiesPanel, secção Live Calculations:

import { calculateRealCurrent, getSafetyStatus, getActiveMicrocontrollerProfile } from '@/lib/ledCalculations';

const mcu = getActiveMicrocontrollerProfile(); // ex: Arduino = 5.0V, 40mA max

function calcChannel(vf: number, resistor: number | 'USER', customR?: number): ChannelCalc {
  const R = resistor === 'USER' ? (customR ?? 220) : resistor;
  const I = calculateRealCurrent(mcu.v_out, vf, R); // (Vcc - Vf) / R
  const status = getSafetyStatus(I, data.nominalCurrent ?? 0.020, mcu.max_ma);
  return { I, status, R };
}

// Invocações:
const chR = calcChannel(data.rForwardVoltage ?? 2.0, data.rResistor ?? 220, data.rCustomResistance);
const chG = calcChannel(data.gForwardVoltage ?? 3.2, data.gResistor ?? 220, data.gCustomResistance);
const chB = calcChannel(data.bForwardVoltage ?? 3.2, data.bResistor ?? 220, data.bCustomResistance);
```

**Thresholds de status** (herdados de `getSafetyStatus`):
- `safe` → I < 20mA e I < mcu.max_ma
- `warning` → I ≥ 20mA (acima do nominal)
- `error` → I > mcu.max_ma (corrente do pin excedida)
- `burned` → I > nominalCurrent × 1.5

***

## 🔴 Gap C — Comportamento `pulse` e `rainbow` em Runtime

**Contexto crítico do `RGBLEDNode.tsx`:** O node actual  **não implementa pulse nem rainbow**. Reage apenas a `pinChange` e define `rgbColor` com os valores directos dos pinos. O `initialState` é um campo do painel que **actualmente não tem efeito no node**.

**Decisão de design — duas fases de comportamento:**

```
Comportamento A — Simulation RUNNING (controlado pelo código ASL):
  O node escuta pinChange e obedece aos pinos. initialState é ignorado.
  O utilizador controla o LED via código (analogWrite, for loop, etc).

Comportamento B — Simulation STOPPED (estado estático/demo):
  initialState define o visual do node quando a simulação não está a correr.
  'off'     → rgbColor = {0,0,0}
  'solid'   → rgbColor = {r, g, b} com brightness aplicado
  'pulse'   → useInterval no node, itera brightness 0→1→0, período = 1000/pulseSpeed ms
  'rainbow' → useInterval no node, itera hue HSL 0→360, período = 50/rainbowSpeed ms
```

**Implementação no `RGBLEDNode.tsx`:**

```ts
// Adicionar ao node — estado de demo activo apenas quando simulação parada
const simStatus = useSimulationStore(s => s.status); // 'stopped' | 'running' | 'paused'
const [demoColor, setDemoColor] = useState<{r:number;g:number;b:number}>({r:0,g:0,b:0});

useEffect(() => {
  if (simStatus === 'running') return; // simulação activa = node obedece a pinChange
  
  const initialState = (data.initialState as string) ?? 'off';
  
  if (initialState === 'off') {
    setDemoColor({r:0, g:0, b:0});
    return;
  }
  if (initialState === 'solid') {
    const brt = (data.brightness as number) ?? 1;
    setDemoColor({
      r: Math.round(((data.r as number) ?? 255) * brt),
      g: Math.round(((data.g as number) ?? 255) * brt),
      b: Math.round(((data.b as number) ?? 255) * brt),
    });
    return;
  }
  if (initialState === 'pulse') {
    const speed = (data.pulseSpeed as number) ?? 1;
    let t = 0;
    const id = setInterval(() => {
      t += 0.05 * speed;
      const brt = (Math.sin(t) + 1) / 2;
      const r = (data.r as number) ?? 255;
      const g = (data.g as number) ?? 0;
      const b = (data.b as number) ?? 0;
      setDemoColor({ r: Math.round(r*brt), g: Math.round(g*brt), b: Math.round(b*brt) });
    }, 16); // ~60fps
    return () => clearInterval(id);
  }
  if (initialState === 'rainbow') {
    const speed = (data.rainbowSpeed as number) ?? 1;
    let hue = 0;
    const id = setInterval(() => {
      hue = (hue + speed) % 360;
      // HSL (hue, 100%, 50%) → RGB
      const [r,g,b] = hslToRgb(hue, 1, 0.5);
      setDemoColor({r, g, b});
    }, 16);
    return () => clearInterval(id);
  }
}, [simStatus, data.initialState, data.r, data.g, data.b, data.brightness, data.pulseSpeed, data.rainbowSpeed]);

// displayColor usa demoColor quando parado, rgbColor quando a correr
const activeColor = simStatus === 'running' ? rgbColor : demoColor;
```

**Consequência para o painel:** O campo `rainbowSpeed` passa a existir no `RGBLEDNodeData` — adicionar ao interface e ao painel com slider `0.5x–10x`, visível apenas quando `initialState === 'rainbow'`.

***

## 🟡 Gap D — `standard_90` orphaned

Adicionar o modelo em falta:

```ts
{
  name: 'Tower Pro SG50',
  servoType: 'standard_90',
  minAngle: 0, maxAngle: 90,
  minPulse: 500, maxPulse: 2400,
  voltage: '4.8–6V', torque: '1.5 kg·cm @ 4.8V',
  current_stall: '650mA',
  notes: 'Compact 90° servo. Good for tight space applications.'
},
```

> **Nota:** O `ServoType` agora tem representante para todos os 4 valores: 90°, 180°, 270°, 360°.

***

## 🟡 Gap E — Reset do Potenciómetro

Comportamento do Reset a documentar:
```
Reset restaura todos os campos para:
  resistance    = 10000 (10kΩ)
  tolerance     = 20 (%)
  taper         = 'linear'
  powerRating   = 0.5 (W)
  initialValue  = 50 (%)
  wiperPosition = 50 (%)
  label         = selectedNode.data.label (preserva o nome guardado — não reseta para "Potentiometer")
```
> Regra transversal: **Reset nunca reseta o label** — sempre restaura o último valor salvo do nó, não os defaults do sistema.

***

## 🟡 Gap F — Tabela de Persistência

Adicionada ao guia como secção transversal:

| Campo | Persistido via Save? | Fonte de verdade |
|---|:---:|---|
| `initialAngle` (servo) | ✅ | `setNodes()` no Save |
| `initialSpeed` (servo continuous) | ✅ | `setNodes()` no Save |
| `pulseSpeed` (rgb) | ✅ | `setNodes()` no Save |
| `rainbowSpeed` (rgb) | ✅ | `setNodes()` no Save |
| `brightnessOverride` (led) | ✅ | `setNodes()` no Save |
| `isPressed` (button) | ✅ | `setNodes()` no Save — é o estado inicial |
| `wiperPosition` (pot) | ❌ | Estado local do painel durante sessão; `initialValue` é o persistido |
| `analogValue` (pot, durante sim) | ❌ | Estado do node em runtime |
| `connectedPin` (todos) | ❌ | Derivado de `connections` em cada render |
| `isBurned` (led) | ❌ | Calculado em runtime — reseta ao parar simulação |
| `isProperlyWired` (todos) | ❌ | Derivado de `connections` em cada render |
| `voltage/torque/currentStall` (servo) | ❌ | Derivado do `servoModels` lookup por `modelName` |

> **Regra de ouro:** Se o valor é derivável deterministicamente de outro campo persistido, **não persiste**. Se é uma escolha do utilizador, **persiste**.

***

## 🟢 Gap G — MCUPropertiesPanel fora do escopo

**Decisão:** O `MCUPropertiesPanel` é deliberadamente separado — é complexo o suficiente para ter o seu próprio documento de especificação (`guiaPreFase2D_MCUPanel.md`). Este guia (`2C`) cobre **apenas componentes periféricos**. Adicionar nota ao topo do guia:

```
Escopo deste documento: painéis de componentes periféricos.
O MCUPropertiesPanel é especificado em guiaPreFase2D_MCUPanel.md (a criar).
```

***

## 🟢 Gap H — Preview LED vago

Especificação concreta do Preview do LED simples:

```tsx
// Secção Preview — LEDPropertiesPanel
const isOnPreview = localData.initialState !== 'off';
const displayColor = localData.colorProfile === 'USER'
  ? (localData.customColorHex ?? '#cccccc')
  : ledProfiles[localData.colorProfile ?? 'RED'].hex;

const brightness = localData.brightnessOverride ?? 1.0;
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

***

## Adições ao `RGBLEDNodeData` Interface (resultado do Gap C)

```ts
interface RGBLEDNodeData {
  // ... campos anteriores ...
  rainbowSpeed?: number;  // NOVO — 0.5–10x, velocidade do ciclo HSL
}
```

E a função auxiliar `hslToRgb` vai para `src/lib/colorUtils.ts` (novo ficheiro utilitário partilhado):
```ts
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  // h: 0–360, s: 0–1, l: 0–1 → [r, g, b]: 0–255
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r=c; g=x; b=0; }
  else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; }
  else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; }
  else              { r=c; g=0; b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
```

***

## Ficheiros Afectados por estas Resoluções

| Ficheiro | Razão |
|---|---|
| `src/lib/colorUtils.ts` | **NOVO** — `hslToRgb` partilhada |
| `src/components/nodes/RGBLEDNode.tsx` | Demo loop (`pulse`/`rainbow`) + `rainbowSpeed` |
| `src/components/RGBLEDPropertiesPanel.tsx` | Campo `rainbowSpeed`, fórmula Live Calc |
| `src/components/ServoPropertiesPanel.tsx` | Modelo `SG50` (90°), info card não persiste |
| `guiaPreFase2C_Rust.md` | Todas as resoluções acima documentadas |

O guia está agora **completo e sem ambiguidades** para implementação directa. Podemos avançar para os ficheiros?