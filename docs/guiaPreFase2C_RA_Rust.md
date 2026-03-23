Modo planeamento activado. Análise completa dos 8 gaps. Aqui estão as resoluções definitivas para cada um:

***

# Resolução dos Gaps do `guiaPreFase2C_Rust.md`

## 🔴 Gap A — Servo: `voltage/torque/currentStall` não persistidos

**Decisão:** Os dados são **derivados do modelo, não persistidos no nó**. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/151562273/159fb4af-f093-40d9-bfde-f19310659953/guiaPreFase2C_Rust.md?AWSAccessKeyId=ASIA2F3EMEYE6G4WJMEL&Signature=tvIfWUm8alD7VX%2FjyGZMQlGC0ZM%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEKj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIG2lUbl%2F6WY7mJe8RIXe8pmRsQRqd81ytQZirvZyeOBxAiEAp6FRv8j2rYKe%2BV2r0X8tqfXmTw13hPCxOuANwKJYJJoq8wQIcBABGgw2OTk3NTMzMDk3MDUiDGoxmynqL9%2Bx4OVo%2FirQBDyJMjHRvR1hnQPZrPfpOxO4CiGTV8E0cWWcWrJUUM22ZTBkCRwOEdY9Og49XQq5s0f%2FTlKUWaieOz9W%2B%2Fp1yEQVgN6rdrS9o7Q1ZRvjUjDDtc%2BIAVJh64d7MOwqn1DZqIJPEZC1%2FKPvsiFhSDhIjX2AX8UYi5gjScfhHo0f%2Bfo3lz19ABv%2BL7qVAK4nBuZM76DoBRi8txrn4zQb07CG%2FF9ADDxD0KWhz%2FcJwPA7MtaGNVxPdlRhQZPqtvGfHALp3Zv11XLoJqoNuB2LItFD4hNafp%2BnpqvoKcqiKCTvwI90%2BgviVsnb897Pi%2F70kZpOr5RMrz14%2BiJjY7quq%2FeteluYhn5ypFP2aKwRniprev1YP1Gnf%2B2DgYLI4csVyNoCcm5y1QAQUaLy9EHqx4MqzJq4RWDSfuxQUqdCn80ofGKxqT8rwFomuGs07eAWvYX7%2BZE8B55msSiflKDJXjik42rpkLHiFTk9NTbwd4Mqbfwl7JGBYHU2rk76i27I9FH9jTYXt54alyRY0BdfJm0Mi5SKlg3pMCNcwqu%2FFRyybDVwjMxf3Z3xTJsIdTMy9geO7OrvGxXVqobui8SmSyAeLV0fjCDX11QczWziS8C1uwfl7%2Br40mKjw8ltnJhnnVy6l57mcpq4GoAjHir%2B7WZh%2F%2BPGg02sHs66dZDmINGDKIfXzISjzMRCBmhWxlLCAk8Ib%2BFV34sCuaoyy8NRkADn3Xoj7H4akoApLQn31WuPcVAx1lWJVLCq64VO%2BBYP57YPz868m%2F72rnb5wnFXf4qdOxgwne2BzgY6mAHGgZG9O0XGQaEISdIHMWq9eKS6glnyAXhfAZzQ%2Bod8WyMSl3YYn7sW1T5JkSPoLs3Y6NCCSsId3%2BgqGRPoEs%2BVdcHxSFNzbvf9Ibk1iXUTql%2F8VxdZr7hdZ6ZXs6C8ZqBZS3hkLGIHUIiE%2B8zKdooIN6fXcCoi27GaSbh%2BK1Q0HtzH0e418ohyLI9yYSaI9P1KcbKgyMx%2FvA%3D%3D&Expires=1774223309)

A razão é simples: se o utilizador muda o modelo de SG90 para MG996R, os dados devem reflectir o novo modelo automaticamente — não um valor stale. Guardar no `data` do nó criaria inconsistências silenciosas.

**Adição ao guia:**
```
NOTA DE IMPLEMENTAÇÃO (ServoPropertiesPanel):
O info card (voltage, torque, current_stall, notes) é SEMPRE derivado
via lookup directo em `servoModels.find(m => m.name === localData.modelName)`.
Não persiste no ServoNodeData. Não incluir no setNodes() ao fazer Save.
```

**Adição ao `ServoNodeData`** — apenas `servoType` é persistido (já estava):
```ts
// servoType é o único campo derivado do modelo que persiste,
// porque muda comportamento do node (standard vs continuous).
// voltage/torque/currentStall: lookup-only, nunca em data.
servoType?: ServoType;  // ← único derivado que persiste
```

***

## 🔴 Gap B — RGB Live Calculations: fórmula de `I` por canal

**Fórmula definitiva** — usa `getActiveMicrocontrollerProfile()` do `ledCalculations.ts` existente: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/151562273/159fb4af-f093-40d9-bfde-f19310659953/guiaPreFase2C_Rust.md?AWSAccessKeyId=ASIA2F3EMEYE6G4WJMEL&Signature=tvIfWUm8alD7VX%2FjyGZMQlGC0ZM%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEKj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIG2lUbl%2F6WY7mJe8RIXe8pmRsQRqd81ytQZirvZyeOBxAiEAp6FRv8j2rYKe%2BV2r0X8tqfXmTw13hPCxOuANwKJYJJoq8wQIcBABGgw2OTk3NTMzMDk3MDUiDGoxmynqL9%2Bx4OVo%2FirQBDyJMjHRvR1hnQPZrPfpOxO4CiGTV8E0cWWcWrJUUM22ZTBkCRwOEdY9Og49XQq5s0f%2FTlKUWaieOz9W%2B%2Fp1yEQVgN6rdrS9o7Q1ZRvjUjDDtc%2BIAVJh64d7MOwqn1DZqIJPEZC1%2FKPvsiFhSDhIjX2AX8UYi5gjScfhHo0f%2Bfo3lz19ABv%2BL7qVAK4nBuZM76DoBRi8txrn4zQb07CG%2FF9ADDxD0KWhz%2FcJwPA7MtaGNVxPdlRhQZPqtvGfHALp3Zv11XLoJqoNuB2LItFD4hNafp%2BnpqvoKcqiKCTvwI90%2BgviVsnb897Pi%2F70kZpOr5RMrz14%2BiJjY7quq%2FeteluYhn5ypFP2aKwRniprev1YP1Gnf%2B2DgYLI4csVyNoCcm5y1QAQUaLy9EHqx4MqzJq4RWDSfuxQUqdCn80ofGKxqT8rwFomuGs07eAWvYX7%2BZE8B55msSiflKDJXjik42rpkLHiFTk9NTbwd4Mqbfwl7JGBYHU2rk76i27I9FH9jTYXt54alyRY0BdfJm0Mi5SKlg3pMCNcwqu%2FFRyybDVwjMxf3Z3xTJsIdTMy9geO7OrvGxXVqobui8SmSyAeLV0fjCDX11QczWziS8C1uwfl7%2Br40mKjw8ltnJhnnVy6l57mcpq4GoAjHir%2B7WZh%2F%2BPGg02sHs66dZDmINGDKIfXzISjzMRCBmhWxlLCAk8Ib%2BFV34sCuaoyy8NRkADn3Xoj7H4akoApLQn31WuPcVAx1lWJVLCq64VO%2BBYP57YPz868m%2F72rnb5wnFXf4qdOxgwne2BzgY6mAHGgZG9O0XGQaEISdIHMWq9eKS6glnyAXhfAZzQ%2Bod8WyMSl3YYn7sW1T5JkSPoLs3Y6NCCSsId3%2BgqGRPoEs%2BVdcHxSFNzbvf9Ibk1iXUTql%2F8VxdZr7hdZ6ZXs6C8ZqBZS3hkLGIHUIiE%2B8zKdooIN6fXcCoi27GaSbh%2BK1Q0HtzH0e418ohyLI9yYSaI9P1KcbKgyMx%2FvA%3D%3D&Expires=1774223309)

```ts
// Cálculo por canal — reutiliza funções existentes de ledCalculations.ts
import { calculateRealCurrent, getSafetyStatus, getActiveMicrocontrollerProfile } from '@/lib/ledCalculations';

function calcChannelLive(
  Vf: number,
  resistor: number | 'USER',
  customResistance: number | undefined,
  nominalCurrent: number  // A, default 0.020
): { current_ma: number; status: SafetyStatus } {
  const mcu = getActiveMicrocontrollerProfile();
  const R = resistor === 'USER' ? (customResistance ?? 220) : resistor;
  const I = calculateRealCurrent(mcu.v_out, Vf, R);  // A
  const status = getSafetyStatus(I, nominalCurrent, mcu.max_ma);
  return { current_ma: I * 1000, status };
}

// Uso no componente (calculado em render, não em estado):
const liveR = calcChannelLive(
  localData.rForwardVoltage ?? 2.0,
  localData.rResistor ?? 220,
  localData.rCustomResistance,
  localData.nominalCurrent ?? 0.020
);
// → { current_ma: 12.7, status: 'safe' }
```

**Limites de status:**
```
safe     → I < 20mA
warning  → I ≥ 20mA e I < mcu.max_ma
error    → I ≥ mcu.max_ma e I < nominalCurrent * 1.5
burned   → I ≥ nominalCurrent * 1.5
```
Nota: `getSafetyStatus()` já implementa estas regras — reutilizar completamente. 

***

## 🔴 Gap C — RGB: comportamento `pulse` e `rainbow` em runtime

Esta é a decisão mais importante — define como o `RGBLEDNode` se comporta quando a simulação corre.

**Decisão de arquitectura:** Os efeitos `pulse` e `rainbow` são executados **localmente no `RGBLEDNode`** com `setInterval`, **apenas quando `simulationEngine.isRunning === true`** e **apenas se não houver `pinChange` activo** (pin control tem prioridade).

### Comportamento `pulse`

```ts
// Dentro do RGBLEDNode, useEffect dependente de [isRunning, initialState, pulseSpeed]
if (initialState === 'pulse' && isRunning) {
  let phase = 0;
  const intervalMs = 16; // ~60fps
  const cycleMs = 2000 / (pulseSpeed ?? 1); // pulseSpeed=1 → 2s por ciclo completo
  
  const interval = setInterval(() => {
    phase = (phase + intervalMs / cycleMs) % 1;
    const brightness = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI); // 0→1→0
    setRgbColor({
      r: Math.round((data.r ?? 255) * brightness),
      g: Math.round((data.g ?? 255) * brightness),
      b: Math.round((data.b ?? 255) * brightness),
    });
  }, intervalMs);

  return () => clearInterval(interval);
}
```

### Comportamento `rainbow`

```ts
// rainbowSpeed: 0.5x–5x, controla velocidade de rotação do hue
if (initialState === 'rainbow' && isRunning) {
  let hue = 0;
  const intervalMs = 16;
  const degreesPerMs = (360 * (rainbowSpeed ?? 1)) / 5000; // 1x → volta completa em 5s

  const interval = setInterval(() => {
    hue = (hue + degreesPerMs * intervalMs) % 360;
    // HSL → RGB conversion
    const [r, g, b] = hslToRgb(hue, 1.0, 0.5);
    setRgbColor({ r, g, b });
  }, intervalMs);

  return () => clearInterval(interval);
}
```

### `hslToRgb` pura (nova, em `src/lib/colorUtils.ts`)

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

### Prioridade entre pinChange e efeitos automáticos

```
REGRA: pinChange tem SEMPRE prioridade.

Se o node recebe um pinChange num canal (red/green/blue):
→ cancela o interval de pulse/rainbow
→ entra em modo "pin-controlled"
→ só retorna a pulse/rainbow se simulação for reset
```

**`data.rainbowSpeed`** — campo novo a adicionar ao `RGBLEDNodeData`:
```ts
rainbowSpeed?: number;  // 0.5–5x, default 1
```
Aparece no painel apenas quando `initialState === 'rainbow'` (similar ao `pulseSpeed`).

***

## 🟡 Gap D — `standard_90` órfão no `ServoType`

**Decisão:** Adicionar modelo real de 90°. O **Tower Pro SG50** é o mais comum nesta categoria.

```ts
{
  name: 'SG50',
  servoType: 'standard_90',
  minAngle: 0, maxAngle: 90,
  minPulse: 600, maxPulse: 2400,
  voltage: '4.8–5V', torque: '1.5 kg·cm @ 4.8V',
  current_stall: '500mA',
  notes: 'Compact 90° servo. Common in camera gimbals and small grippers.'
},
```

**Ordem no Select** (por range crescente):
1. SG50 (90°)
2. SG90 (180°)
3. MG996R (180°)
4. DS3218 (270°)
5. FS90R (360° continuous)

***

## 🟡 Gap E — Reset do Potenciómetro não especificado

**Reset definitivo:**

```ts
// handleReset restaura TODOS os campos para os defaults do modelo
const handleReset = () => {
  if (!selectedNode) return;
  setLocalData({
    id: selectedNode.id,
    label: (selectedNode.data.label as string) || 'Potentiometer',
    resistance: 10000,       // 10kΩ default
    tolerance: 20,           // ±20%
    taper: 'linear',
    powerRating: 0.5,        // 0.5W
    initialValue: 50,        // 50%
    wiperPosition: 50,
  });
  setHasChanges(false);
  // NOTA: Reset não faz setNodes() — mantém o nó com os valores antigos
  // até o utilizador clicar Save com os novos valores
};
```

**Nota crítica:** Reset restaura o painel para defaults **genéricos** (não os valores do nó antes da edição). Se o utilizador quer reverter para os valores do nó guardados, usa **Discard** — mas esse botão não existe actualmente. Como o potenciómetro não tem um "modelo" como o servo, usar os defaults é a abordagem mais simples e consistente.

***

## 🟡 Gap F — Persistência de estado

**Tabela definitiva de persistência** — adição transversal ao guia:

| Campo | Componente | Persistido (setNodes) | Notas |
|---|---|:---:|---|
| `initialAngle` | Servo | ✅ | Ângulo quando simulação começa |
| `initialSpeed` | Servo (continuous) | ✅ | Velocidade inicial para FS90R |
| `pulseSpeed` | RGB LED | ✅ | Multiplicador do ciclo de pulse |
| `rainbowSpeed` | RGB LED | ✅ | **NOVO** — multiplicador do ciclo rainbow |
| `brightnessOverride` | LED simples | ✅ | Override visual; `undefined` = automático |
| `taper` | Potenciómetro | ✅ | Afecta o valor ADC emitido |
| `wiperPosition` | Potenciómetro | ❌ | Estado local do painel; `initialValue` é o persistido |
| `isPressed` | Button | ❌ | Estado de runtime; não é propriedade de design |
| `isFloating` | Button | ❌ | Derivado de wiring + pullResistor; recalculado |
| `connectedPin` | Button/Servo/Pot | ❌ | Derivado de `connections` em cada render |
| `connectedPins` | RGB LED | ❌ | Derivado de `connections` em cada render |
| `isBurned` | LED | ❌ | Estado de runtime; reset ao parar simulação |
| `isOn` | LED | ❌ | Estado de runtime |
| `rgbColor` (runtime) | RGB LED | ❌ | Estado de runtime; pulse/rainbow/pinChange |
| `isProperlyWired` | Todos | ❌ | Derivado de `connections` |
| `voltage/torque/currentStall` | Servo | ❌ | Lookup-only do servoModels |

**Regra geral:**
> Tudo o que o utilizador configura intencionalmente e que afecta o comportamento do circuito **persiste**. Tudo o que é calculado, derivado ou runtime **não persiste**.

***

## 🟢 Gap G — MCUPropertiesPanel fora do documento

**Decisão de escopo:** O `MCUPropertiesPanel` é coberto pelo guia da **Sub-fase 2C principal** (verificação já feita) — não faz parte deste documento que é específico aos componentes periféricos (LED, RGB, Servo, Pot, Button). 

**Adição ao cabeçalho do guia:**
```md
## Escopo deste Documento
Este guia cobre os painéis de propriedades dos componentes PERIFÉRICOS:
LEDPropertiesPanel, RGBLEDPropertiesPanel, ServoPropertiesPanel,
PotentiometerPropertiesPanel, ButtonPropertiesPanel.

O MCUPropertiesPanel é especificado separadamente na verificação
da Sub-fase 2C (verificação_2C.md), pois tem dependências exclusivas
do simulationStore (boardConfigs, MCUConfig, Language).
```

***

## 🟢 Gap H — Preview LED: especificação concreta

**Especificação definitiva do Preview do LED simples:**

```tsx
// Círculo SVG — equivalente ao RGBLEDNode.tsx mas estático no painel
const previewColor = isBurned ? '#444' : displayColor;
const previewOpacity = isBurned
  ? 0.15
  : isOn
    ? 0.3 + ((brightnessOverride ?? (brightness / 255)) * 0.7)
    : 0.25;
const glowSize = isOn && !isBurned ? 12 : 0;

<div className="flex items-center justify-center p-4 bg-[#151b24] rounded-lg border border-[rgba(0,217,255,0.2)]">
  <div
    className="w-12 h-12 rounded-full transition-all duration-300"
    style={{
      backgroundColor: previewColor,
      opacity: previewOpacity,
      boxShadow: isOn && !isBurned
        ? `0 0 ${glowSize}px ${previewColor}80, 0 0 ${glowSize * 2}px ${previewColor}40`
        : 'none',
    }}
  />
  {/* Status dot */}
  <div className={cn(
    'absolute top-3 right-3 w-2 h-2 rounded-full',
    isBurned     ? 'bg-red-500' :
    isOn         ? 'bg-green-400 animate-pulse' :
                   'bg-gray-600'
  )} />
</div>
<div className="text-center text-xs text-[#9ca3af] mt-1">
  {isBurned
    ? '🔥 Burned'
    : isOn
      ? `${Math.round(luminousIntensity)} mcd`
      : 'Off'}
</div>
```

**Nota:** `isOn`, `brightness`, `luminousIntensity`, `isBurned` são `localData` do painel (estado read-only calculado quando o nó está seleccionado). Não são estados de runtime da simulação — são a **previsão estática** baseada nas propriedades configuradas.

***

## Ordem de Actualização do Guia

Antes de implementar, o ficheiro `guiaPreFase2C_Rust.md` precisa de receber estas adições:

1. **Novo ficheiro** `src/lib/colorUtils.ts` na ordem de implementação (posição 1, antes do potentiometerCalculations)
2. **`RGBLEDNodeData`** — adicionar `rainbowSpeed?: number`
3. **`servoModels`** — adicionar SG50 (90°) na posição 1
4. **Secção nova** "Comportamento Runtime do RGBLEDNode" com pulse/rainbow/prioridade
5. **Secção nova** "Persistência de Estado" com a tabela
6. **Secção nova** "Escopo do Documento" no cabeçalho
7. **Fórmula** `calcChannelLive` na secção Live Calculations do RGB
8. **Nota** "lookup-only" para voltage/torque/currentStall do Servo
9. **Especificação** do `handleReset` do Potenciómetro
10. **Especificação** do Preview do LED com código concreto

***

## Estado Final do Guia após Correcções

Com estes 10 pontos aplicados, o guia fica **implementável por um developer sem contexto adicional** — cada secção tem tipos, fórmulas, condicionais e comportamento runtime suficientemente detalhados para não haver ambiguidade na implementação Svelte da 2C.

O único pré-requisito externo que persiste é o `getActiveMicrocontrollerProfile()` do `ledCalculations.ts` — que já existe na `critical_Implementation` branch.