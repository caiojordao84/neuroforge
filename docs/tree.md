# Estrutura do projeto NeuroForge
Gerado em: 2026-02-13 21:17:17
Raiz:      D:\Documents\NeuroForge\neuroforge
(ignora: .gitignore + qualquer item com 'renode' no nome)

```text
└── neuroforge
    ├── app
    ├── docs
    │   ├── architecture
    │   │   └── backends.md
    │   ├── boards
    │   ├── firmware
    │   │   ├── .gitkeep
    │   │   ├── esp32-idf-setup.md
    │   │   ├── esp32-setup-guide.md
    │   │   ├── rp2040-setup.md
    │   │   └── rp2040-windows-install.ps1
    │   ├── roadmaps
    │   │   ├── gpio-memory-mapped-postponed.md
    │   │   └── gpio-serial-protocol.md
    │   ├── AI_ASSISTANT_CONTEXT.md
    │   ├── boards-documentation.md
    │   ├── fixes.md
    │   ├── ledPisca.md
    │   ├── QEMU_SETUP.md
    │   ├── roadmap-prs-qemu-gpio-monitor.md
    │   ├── ROADMAP.md
    │   ├── serial-gpio-protocol.md
    │   ├── todayCheck.md
    │   ├── tree.json
    │   └── tree.md
    ├── poc
    │   ├── blink
    │   │   └── blink.ino
    │   ├── gpio_test
    │   │   └── gpio_test.ino
    │   ├── libraries
    │   │   ├── NeuroForgeGPIO
    │   │   │   ├── library.properties
    │   │   │   ├── NeuroForgeGPIO.cpp
    │   │   │   └── NeuroForgeGPIO.h
    │   │   └── NeuroForgeGPIO_ESP32
    │   │       ├── examples
    │   │       │   └── ESP32_GPIOTest
    │   │       │       └── ESP32_GPIOTest.ino
    │   │       ├── library.properties
    │   │       ├── NeuroForgeGPIO_ESP32.cpp
    │   │       └── NeuroForgeGPIO_ESP32.h
    │   ├── serial_test
    │   │   └── serial_test.ino
    │   ├── compile.ps1
    │   ├── debug_qemu.ps1
    │   ├── fix_qemu_path.ps1
    │   ├── install_qemu_avr.ps1
    │   ├── README.md
    │   └── run_qemu.ps1
    ├── server
    │   ├── cores
    │   │   ├── neuroforge_qemu
    │   │   │   ├── boards.txt
    │   │   │   ├── nf_arduino_time.cpp
    │   │   │   ├── nf_gpio.cpp
    │   │   │   ├── nf_gpio.h
    │   │   │   ├── nf_time.cpp
    │   │   │   ├── nf_time.h
    │   │   │   ├── README.md
    │   │   │   └── wiring.c.patch
    │   │   ├── install-core-fixed.ps1
    │   │   ├── install-core.ps1
    │   │   ├── install-core.sh
    │   │   ├── NEUROFORGE_TIME_IMPLEMENTATION.md
    │   │   ├── patch-wiring.ps1
    │   │   └── update-nf-time.ps1
    │   ├── scripts
    │   │   ├── backup-cores.ps1
    │   │   ├── diagnose-arduino-gpio.ps1
    │   │   ├── fix-arduino-gpio.ps1
    │   │   └── README.md
    │   ├── src
    │   │   ├── api
    │   │   │   ├── routes.ts
    │   │   │   └── websocket.ts
    │   │   ├── services
    │   │   │   ├── CompilerService.ts
    │   │   │   ├── Esp32Backend.ts
    │   │   │   ├── Esp32SerialClient.ts
    │   │   │   ├── QEMUMonitorService.ts
    │   │   │   ├── QEMURunner.ts
    │   │   │   ├── QEMUSimulationEngine.ts
    │   │   │   └── SerialGPIOParser.ts
    │   │   ├── shims
    │   │   │   └── esp32-shim.cpp
    │   │   ├── types
    │   │   │   └── esp32.types.ts
    │   │   └── server.ts
    │   ├── test-firmware
    │   │   ├── esp32
    │   │   │   ├── qemu_efuse.bin
    │   │   │   ├── qemu_flash.bin
    │   │   │   └── README.md
    │   │   ├── esp32_shim_test
    │   │   │   └── esp32_shim_test.ino
    │   │   ├── rp2040
    │   │   │   └── blink
    │   │   │       ├── platforms
    │   │   │       │   ├── raspberry-pico.repl
    │   │   │       │   └── rp2040.repl
    │   │   │       ├── bare.ld
    │   │   │       ├── CMakeLists.txt
    │   │   │       ├── main.c
    │   │   │       ├── main_bare.c
    │   │   │       ├── main_minimal.c
    │   │   │       ├── main_simple.c
    │   │   │       ├── main_systick.c
    │   │   │       ├── monitor-serial.ps1
    │   │   │       ├── pico_sdk_import.cmake
    │   │   │       ├── test-bare.resc
    │   │   │       ├── test-blink.resc
    │   │   │       ├── test-simple.resc
    │   │   │       └── timer_patch.py
    │   │   └── blink.ino
    │   ├── test-sketch
    │   │   └── test-sketch.ino
    │   ├── .env.example
    │   ├── example-gpio-esp32.ts
    │   ├── example-gpio.ts
    │   ├── example-mock.ts
    │   ├── example-monitor.ts
    │   ├── example.ts
    │   ├── package-lock.json
    │   ├── package.json
    │   ├── QEMUGPIOService.ts
    │   ├── QEMURunner.ts
    │   ├── QEMUSimulationEngine.ts
    │   ├── README.md
    │   ├── README_MONITOR.md
    │   ├── README_TESTING.md
    │   ├── SerialGPIOService.ts
    │   ├── tsconfig.json
    │   └── tsconfig.tsbuildinfo
    ├── src
    │   ├── components
    │   │   ├── boards
    │   │   │   ├── arduino
    │   │   │   │   ├── json
    │   │   │   │   │   └── arduino-uno.json
    │   │   │   │   └── svg
    │   │   │   │       └── arduino-uno-r3.svg
    │   │   │   ├── esp32
    │   │   │   │   ├── json
    │   │   │   │   │   └── esp32-devkit.json
    │   │   │   │   └── svg
    │   │   │   ├── raspberry-pi-pico
    │   │   │   │   ├── json
    │   │   │   │   │   └── raspberry-pi-pico.json
    │   │   │   │   └── svg
    │   │   │   └── board-schema.json
    │   │   ├── edges
    │   │   │   ├── index.ts
    │   │   │   └── ManhattanEdge.tsx
    │   │   ├── nodes
    │   │   │   ├── ButtonNode.tsx
    │   │   │   ├── index.ts
    │   │   │   ├── LEDNode.tsx
    │   │   │   ├── MCUNode.tsx
    │   │   │   ├── PotentiometerNode.tsx
    │   │   │   ├── RGBLEDNode.tsx
    │   │   │   └── ServoNode.tsx
    │   │   ├── ui
    │   │   │   ├── accordion.tsx
    │   │   │   ├── alert-dialog.tsx
    │   │   │   ├── alert.tsx
    │   │   │   ├── aspect-ratio.tsx
    │   │   │   ├── avatar.tsx
    │   │   │   ├── badge.tsx
    │   │   │   ├── breadcrumb.tsx
    │   │   │   ├── button-group.tsx
    │   │   │   ├── button.tsx
    │   │   │   ├── calendar.tsx
    │   │   │   ├── card.tsx
    │   │   │   ├── carousel.tsx
    │   │   │   ├── chart.tsx
    │   │   │   ├── checkbox.tsx
    │   │   │   ├── collapsible.tsx
    │   │   │   ├── command.tsx
    │   │   │   ├── context-menu.tsx
    │   │   │   ├── dialog.tsx
    │   │   │   ├── drawer.tsx
    │   │   │   ├── dropdown-menu.tsx
    │   │   │   ├── empty.tsx
    │   │   │   ├── field.tsx
    │   │   │   ├── form.tsx
    │   │   │   ├── hover-card.tsx
    │   │   │   ├── input-group.tsx
    │   │   │   ├── input-otp.tsx
    │   │   │   ├── input.tsx
    │   │   │   ├── item.tsx
    │   │   │   ├── kbd.tsx
    │   │   │   ├── label.tsx
    │   │   │   ├── menubar.tsx
    │   │   │   ├── navigation-menu.tsx
    │   │   │   ├── pagination.tsx
    │   │   │   ├── popover.tsx
    │   │   │   ├── progress.tsx
    │   │   │   ├── radio-group.tsx
    │   │   │   ├── resizable.tsx
    │   │   │   ├── scroll-area.tsx
    │   │   │   ├── select.tsx
    │   │   │   ├── separator.tsx
    │   │   │   ├── sheet.tsx
    │   │   │   ├── sidebar.tsx
    │   │   │   ├── skeleton.tsx
    │   │   │   ├── slider.tsx
    │   │   │   ├── sonner.tsx
    │   │   │   ├── spinner.tsx
    │   │   │   ├── switch.tsx
    │   │   │   ├── table.tsx
    │   │   │   ├── tabs.tsx
    │   │   │   ├── textarea.tsx
    │   │   │   ├── toggle-group.tsx
    │   │   │   ├── toggle.tsx
    │   │   │   └── tooltip.tsx
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
    │   │   └── TopToolbar.tsx
    │   ├── engine
    │   │   ├── CodeParser.ts
    │   │   ├── example.ts
    │   │   ├── QEMURunner.ts
    │   │   ├── QEMUSimulationEngine.ts
    │   │   ├── README.md
    │   │   ├── SimulationEngine.ts
    │   │   └── Transpiler.ts
    │   ├── hooks
    │   │   ├── use-mobile.ts
    │   │   └── useQEMUSimulation.ts
    │   ├── lib
    │   │   └── utils.ts
    │   ├── services
    │   │   ├── QEMUApiClient.ts
    │   │   └── QEMUWebSocket.ts
    │   ├── stores
    │   │   ├── useConnectionStore.ts
    │   │   ├── useFileStore.ts
    │   │   ├── useLibraryStore.ts
    │   │   ├── useQEMUStore.ts
    │   │   ├── useSerialStore.ts
    │   │   ├── useSimulationStore.ts
    │   │   └── useUIStore.ts
    │   ├── types
    │   │   └── index.ts
    │   ├── App.css
    │   ├── App.tsx
    │   ├── index.css
    │   └── main.tsx
    ├── all_symbols.txt
    ├── app.code-workspace
    ├── boot_disasm.txt
    ├── boot_disasm_ascii.txt
    ├── components.json
    ├── cpu_help.txt
    ├── disassembly.txt
    ├── disassembly_ascii.txt
    ├── eslint.config.js
    ├── fixes.md
    ├── index.html
    ├── install-deps.ps1
    ├── install-deps.sh
    ├── package-lock.json
    ├── package.json
    ├── postcss.config.js
    ├── README.md
    ├── tailwind.config.js
    ├── tsconfig.app.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    └── vite.config.ts
```