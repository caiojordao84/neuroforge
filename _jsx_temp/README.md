# ⚠️ _jsx_temp — Burn After Use

Painéis React/TSX temporários portados da branch `Blockly_Flow`
com as adições do `guiaPreFase2C_Rust.md`.

Estes ficheiros servem de **referência de lógica** para a portagem
para Svelte/Rust. Eliminar esta pasta quando a Fase 2E estiver concluída.

## Origem → Destino
- Origem: `Blockly_Flow` → `src/components/` + `src/lib/`
- Destino final: `apps/desktop/src/lib/` + `apps/desktop/src/routes/`

## Conteúdo
| Ficheiro | Estado | Notas |
|---|---|---|
| `lib/colorUtils.ts` | 🆕 Novo | `hslToRgb` partilhada |
| `lib/potentiometerCalculations.ts` | 🆕 Novo | `taperMap`, `getWiperResistance`, `getWiperVoltage` |
| `lib/ledCalculations.ts` | ✏️ Actualizado | Novos perfis IR/COLD/WARM/RGB adicionados |
| `types/index_additions.ts` | 🆕 Novo | `ServoType`, `ServoModel`, `TaperType`, `RGBChannelConfig` |
| `nodes/RGBLEDNode.tsx` | ✏️ Actualizado | Demo loop pulse/rainbow + rainbowSpeed |
| `nodes/ServoNode.tsx` | ✏️ Actualizado | smoothing + servoType + initialSpeed |
| `panels/ServoPropertiesPanel.tsx` | ✏️ Reescrita | SG50 (90°), info card lookup-only |
| `panels/RGBLEDPropertiesPanel.tsx` | ✏️ Expansão | Resistores por canal, live calc, rainbowSpeed |
| `panels/PotentiometerPropertiesPanel.tsx` | ✏️ Expansão | taper curve, live value, handleReset |
| `panels/ButtonPropertiesPanel.tsx` | ✏️ Expansão | type toggle, floating card, logic section |
| `panels/LEDPropertiesPanel.tsx` | ✏️ Expansão | ledProfiles, preview visual, burned banner |

## Ordem de implementação
Ver `guiaPreFase2C_Rust.md` — secção "Ordem de Implementação na Branch preRust".
