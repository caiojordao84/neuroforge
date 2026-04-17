---
title: Rosetta v4.0 Architecture
date: 2026-04-17
tags: [transpiler, nominal-fidelity, deep-loop-extraction]
---

Rosetta v4.0 implements True Nominal Fidelity in the Python-to-ASL transpilation pipeline. It removes the opinionated variable renaming (e.g., u -> avg_distance) in favor of the users original identifiers. It also introduces Deep Loop Extraction, which identifies infinite loops nested inside entry-point functions and promotes their bodies to the ASL [Loop] block.

---
[[Index|Back to Index]]