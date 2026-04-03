# docs/PLAN.md — Orquestração ASL: Contrato NeuroParser

Este documento detalha o plano de orquestração para consolidar o `NeuroParser` como o contrato normativo central do NeuroForge.

## Contexto e Objetivo
O Dicionário ASL v1.2.3 exige que a saída do transpilador seja 100% semântica (R1-R8). O `neuro_parser.rs` foi criado para enforçar esse contrato. Esta orquestração audita o código do parser e reformula os agentes e skills para adotarem este contrato como "A Única Lei".

## Fase 1: Auditoria e Saneamento (project-planner + rust-pro)

| Tarefa | Agente | Detalhes |
|--------|--------|----------|
| Audit Rust/Clean Code | rust-pro | Verificar `ParseError`, `Span` e helpers de normalização em `neuro_parser.rs`. |
| Performance Pass | rust-pro | Otimizar `bool_like` e `st_for_to_exclusive`. |
| Semantic Audit | project-planner | Garantir que `NeuroParserExt` valida todos os § aplicáveis do Dicionário. |

## Fase 2: Reformulação Agêntica (backend-specialist)

| Tarefa | Agente | Detalhes |
|--------|--------|----------|
| Reformular ast-design | backend-specialist | Atualizar `ast-design/SKILL.md` para remover tipos legados e focar no novo contrato. |
| Reformular transpiler-dev | backend-specialist | Garantir que o pipeline `Parser → AslProgram` dependa formalmente de `NeuroParser`. |
| PLC Integration | backend-specialist | Orientar o `st-iec61131-pro` a herdar da trait `NeuroParser`. |

## Fase 3: Verificação (test-engineer)

| Tarefa | Agente | Detalhes |
|--------|--------|----------|
| Contract Testing | test-engineer | Criar testes unitários para validar a trair `NeuroParser`. |
| Script Audit | project-planner | `python .agent/scripts/checklist.py .` |

---

## 🛑 CHECKPOINT
**Aprovação necessária antes de iniciar a Fase 2 (Implementação Paralela).**
