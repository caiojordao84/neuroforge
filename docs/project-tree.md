# Projeto NeuroForge - Árvore de Arquivos

```text
NeuroForge/
├── .gitignore
├── README.md
├── app/
├── app.code-workspace
├── components.json
├── docs/
│   ├── QEMU_SETUP.md
│   ├── ROADMAP.md
│   ├── architecture/
│   │   └── backends.md
│   ├── boards/
│   │   ├── arduino-uno.json
│   │   ├── board-schema.json
│   │   └── esp32-devkit.json
│   ├── fixes.md
│   ├── roadmap-prs-qemu-gpio-monitor.md
│   ├── roadmap.md
│   ├── roadmaps/
│   │   ├── gpio-memory-mapped-postponed.md
│   │   └── gpio-serial-protocol.md
│   └── serial-gpio-protocol.md
├── eslint.config.js
├── fixes.md
├── index.html
├── install-deps.ps1
├── install-deps.sh
├── package-lock.json
├── package.json
├── poc/
│   ├── README.md
│   ├── blink/
│   │   └── blink.ino
│   ├── compile.ps1
│   ├── debug_qemu.ps1
│   ├── fix_qemu_path.ps1
│   ├── gpio_test/
│   │   └── gpio_test.ino
│   ├── install_qemu_avr.ps1
│   ├── libraries/
│   │   ├── NeuroForgeGPIO/
│   │   │   ├── NeuroForgeGPIO.cpp
│   │   │   ├── NeuroForgeGPIO.h
│   │   │   └── library.properties
│   │   └── NeuroForgeGPIO_ESP32/
│   │       ├── NeuroForgeGPIO_ESP32.cpp
│   │       ├── NeuroForgeGPIO_ESP32.h
│   │       ├── examples/
│   │       │   └── ESP32_GPIOTest/
│   │       │       └── ESP32_GPIOTest.ino
│   │       └── library.properties
│   ├── run_qemu.ps1
│   └── serial_test/
│       └── serial_test.ino
├── postcss.config.js
├── server/
│   ├── .env.example
│   ├── QEMUGPIOService.ts
│   ├── QEMURunner.ts
│   ├── QEMUSimulationEngine.ts
│   ├── README.md
│   ├── README_MONITOR.md
│   ├── README_TESTING.md
│   ├── SerialGPIOService.ts
│   ├── cores/
│   │   ├── NEUROFORGE_TIME_IMPLEMENTATION.md
│   │   ├── install-core-fixed.ps1
│   │   ├── install-core.ps1
│   │   ├── install-core.sh
│   │   ├── neuroforge_qemu/
│   │   │   ├── README.md
│   │   │   ├── boards.txt
│   │   │   ├── nf_arduino_time.cpp
│   │   │   ├── nf_time.cpp
│   │   │   ├── nf_time.h
│   │   │   └── wiring.c.patch
│   │   ├── patch-wiring.ps1
│   │   └── update-nf-time.ps1
│   ├── example-gpio.ts
│   ├── example-mock.ts
│   ├── example-monitor.ts
│   ├── example.ts
│   ├── package-lock.json
│   ├── package.json
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes.ts
│   │   │   └── websocket.ts
│   │   ├── server.ts
│   │   └── services/
│   │       ├── CompilerService.ts
│   │       ├── QEMUMonitorService.ts
│   │       ├── QEMURunner.ts
│   │       └── QEMUSimulationEngine.ts
│   ├── test-firmware/
│   │   └── blink.ino
│   └── tsconfig.json
├── src/
│   ├── App.css
│   ├── App.tsx
│   ├── components/
│   │   ├── ButtonPropertiesPanel.tsx
│   │   ├── CanvasArea.tsx
│   │   ├── CodeEditor.tsx
│   │   ├── CodeEditorWithTabs.tsx
│   │   ├── ComponentsLibrary.tsx
│   │   ├── FloatingWindow.tsx
│   │   ├── LEDPropertiesPanel.tsx
│   │   ├── LeftSidebar.tsx
│   │   ├── LibrariesPanel.tsx
│   │   ├── MCUPropertiesPanel.tsx
│   │   ├── PotentiometerPropertiesPanel.tsx
│   │   ├── PropertiesPanel.tsx
│   │   ├── RGBLEDPropertiesPanel.tsx
│   │   ├── SerialMonitor.tsx
│   │   ├── ServoPropertiesPanel.tsx
│   │   ├── SimulationModeToggle.tsx
│   │   ├── Terminal.tsx
│   │   ├── TopToolbar.tsx
│   │   ├── edges/
│   │   │   ├── ManhattanEdge.tsx
│   │   │   └── index.ts
│   │   ├── nodes/
│   │   │   ├── ButtonNode.tsx
│   │   │   ├── LEDNode.tsx
│   │   │   ├── MCUNode.tsx
│   │   │   ├── PotentiometerNode.tsx
│   │   │   ├── RGBLEDNode.tsx
│   │   │   ├── ServoNode.tsx
│   │   │   └── index.ts
│   │   └── ui/
│   │       ├── accordion.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── alert.tsx
│   │       ├── aspect-ratio.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button-group.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── empty.tsx
│   │       ├── field.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input-group.tsx
│   │       ├── input-otp.tsx
│   │       ├── input.tsx
│   │       ├── item.tsx
│   │       ├── kbd.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── spinner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toggle-group.tsx
│   │       ├── toggle.tsx
│   │       └── tooltip.tsx
│   ├── engine/
│   │   ├── CodeParser.ts
│   │   ├── QEMURunner.ts
│   │   ├── QEMUSimulationEngine.ts
│   │   ├── README.md
│   │   ├── SimulationEngine.ts
│   │   ├── Transpiler.ts
│   │   └── example.ts
│   ├── hooks/
│   │   ├── use-mobile.ts
│   │   └── useQEMUSimulation.ts
│   ├── index.css
│   ├── lib/
│   │   └── utils.ts
│   ├── main.tsx
│   ├── services/
│   │   ├── QEMUApiClient.ts
│   │   └── QEMUWebSocket.ts
│   ├── stores/
│   │   ├── useConnectionStore.ts
│   │   ├── useFileStore.ts
│   │   ├── useLibraryStore.ts
│   │   ├── useQEMUStore.ts
│   │   ├── useSerialStore.ts
│   │   ├── useSimulationStore.ts
│   │   └── useUIStore.ts
│   └── types/
│       └── index.ts
├── tailwind.config.js
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```
