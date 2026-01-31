SYSTEM ROLE:
You are a Principal Software Architect specializing in web-based circuit simulators, embedded systems visualization, and real-time component interaction engines. You have expert knowledge in React, TypeScript, canvas rendering, and microcontroller simulation architectures.

PROJECT CONTEXT:
NeuroForge is a web-based microcontroller simulator built with React 18, TypeScript, React Flow, Monaco Editor, Zustand, and Tailwind CSS. The application allows users to design circuits, write code, and simulate hardware behavior entirely in the browser without heavy emulation engines.

---

**PART 1: CRITICAL BUG FIXES**

PRIORITY: CRITICAL
These issues must be resolved before any feature additions.

**FIX 1.1: Language Selector Implementation**
CURRENT STATE: Dropdown in Code Editor renders on a layer under the editor and does not trigger any functionality.
REQUIRED BEHAVIOR:
- On dropdown change, dropdown should be rendered on top of the editor, capture the selected language value (C++, MicroPython, CircuitPython, Assembly)
- Update the global simulation state with the new language
- Reconfigure Monaco Editor syntax highlighting dynamically
- If code exists and user confirms, trigger the transpiler to convert code to the selected language
- Update the editor theme and autocomplete rules accordingly

IMPLEMENTATION REQUIREMENTS:
- Create a Zustand store slice for language state
- Wire the dropdown onChange handler to store action
- Implement Monaco language configuration switcher
- Add confirmation dialog before transpilation

STATUS: IMPLEMENTED
- Z-index issue fixed: Changed SelectContent z-index from z-50 to z-[9999] in select.tsx
- Dropdown now renders above FloatingWindow and Monaco Editor
- Language change functionality was already implemented in CodeEditorWithTabs.tsx:
  - handleLanguageChange triggers transpile confirmation dialog
  - confirmTranspile performs transpilation and updates file/simulation stores
  - Monaco language switching via getEditorLanguage()
  - Simulation store synced on active file changes

FILES:
- src/components/ui/select.tsx (z-index fix)
- src/components/CodeEditorWithTabs.tsx (already had language change logic)

---

**FIX 1.2: Remove Generic Board Component**
CURRENT STATE: A placeholder "Board" component exists in the codebase.
REQUIRED BEHAVIOR:
- Delete the generic Board component entirely from the codebase
- All circuit connections must originate from specific microcontroller components (Arduino Uno, ESP32, Raspberry Pi Pico, etc.)
- Microcontrollers must be treated as draggable components, not static backgrounds

IMPLEMENTATION REQUIREMENTS:
- Remove Board component from component registry
- Update canvas initialization to not auto-place a board
- Ensure all example circuits reference specific MCU components

STATUS: PARTIALLY IMPLEMENTED
- MCU components are draggable from Components Library
- MCUNode.tsx has been created with full board-specific rendering
- CanvasArea still has a hardcoded "Board" node in useEffect that should be removed

---

**FIX 1.3: Microcontroller Component Interaction**
CURRENT STATE: MCUs are static or have non-functional pin interfaces.
REQUIRED BEHAVIOR:
- MCUs must be draggable React Flow nodes
- Each MCU pin must have a clickable hitbox
- Pin hitboxes must align precisely with the visual SVG representation
- Pins must support wire connections with snap-to-pin behavior
- Hovering over a pin must display its label and current state

IMPLEMENTATION REQUIREMENTS:
- Create custom React Flow node type for each MCU
- Implement Handle components positioned at exact pin coordinates
- Add SVG overlay for pin highlighting on hover
- Implement getBoundingClientRect logic for precise hitbox positioning
- Support both click-to-connect and drag-to-connect wire creation

STATUS: IMPLEMENTED
- MCUNode.tsx created with full pin interaction system
- Power pins (5V, GND, VIN) with interactive hitboxes
- Digital pins (D0-D13) with connection handles
- Analog pins (A0-A5) with connection handles
- Hover and click states for pin selection
- Double-click opens properties panel

---

**FIX 1.4: Wire System Overhaul**
CURRENT STATE: Wires are unstable, do not snap correctly, or detach unexpectedly.
REQUIRED BEHAVIOR:
- Wires must snap to pin connection points automatically when within threshold distance
- During wire creation, the endpoint must follow the cursor smoothly without lag
- Wires must maintain connections after canvas pan or zoom
- Wires must route with 90-degree bends (Manhattan routing) for clean appearance
- Wires must visually indicate connection status (connected vs. floating)

IMPLEMENTATION REQUIREMENTS:
- Use React Flow edge types with custom rendering
- Implement snap-to-grid logic for wire endpoints
- Add edge pathfinding algorithm (A-star or simplified Manhattan routing)
- Store wire connections in Zustand with validation
- Implement wire color coding (VCC red, GND black, Digital blue, Analog yellow)
- Add visual feedback for invalid connections

STATUS: PARTIALLY IMPLEMENTED
- ManhattanEdge.tsx created with Manhattan routing using getSmoothStepPath
- Wire color coding: Power (red), Ground (black/gray), Analog (yellow), Digital (cyan)
- Connection validation prevents self-connections and duplicates
- Visual feedback: Selection glow, active signal animation
- Snap-to-grid enabled on canvas (10x10 grid)
- Missing: Explicit snap-to-pin behavior, A-star pathfinding, wire storage in Zustand

FILES:
- src/components/edges/ManhattanEdge.tsx
- src/components/edges/index.ts
- src/components/CanvasArea.tsx (edge handling)

---

**FIX 1.5: Floating Window Stability**
CURRENT STATE: Floating windows lose position or exhibit jitter during drag.
REQUIRED BEHAVIOR:
- Windows must maintain exact position after being moved
- Dragging must be smooth with no snapping or jumping behavior
- Z-index management must bring clicked window to front consistently
- Window positions must persist across sessions (localStorage)

IMPLEMENTATION REQUIREMENTS:
- Use Framer Motion drag constraints correctly
- Store window positions in Zustand and sync to localStorage
- Implement proper z-index increment logic on click
- Disable browser default drag behaviors that interfere with custom drag

STATUS: IMPLEMENTED
- FloatingWindow.tsx with smooth Framer Motion dragging (dragMomentum=false, dragElastic=0)
- Z-index management with bringToFront on click
- Position persistence via Zustand persist middleware to localStorage
- Minimize/restore functionality
- Resize functionality with constraints
- Position constrained to viewport bounds

FILES:
- src/components/FloatingWindow.tsx
- src/stores/useUIStore.ts (persist enabled)

---

**FIX 1.6: Code Parser Function Extraction**
CURRENT STATE: CodeParser uses simple regex that fails with complex function bodies containing nested braces or multiple statements.
REQUIRED BEHAVIOR:
- Parser must correctly extract setup() and loop() function bodies regardless of formatting
- Must handle nested braces (if statements, for loops, while loops)
- Must support multi-line code with Serial.println and other complex statements
- Must not break when function closing brace is not on a new line

IMPLEMENTATION REQUIREMENTS:
- Replace regex-based function extraction with brace-counting algorithm
- Implement extractFunction method that counts opening and closing braces
- Handle both sync and async function bodies
- Support nested control structures

STATUS: IMPLEMENTED
- extractFunction method created with brace counting logic
- Correctly parses functions with nested structures
- Handles various code formatting styles
- Tested with Serial.println in loop() and complex multi-line code

FILES:
- src/engine/CodeParser.ts (extractFunction method)

COMMIT:
- https://github.com/caiojordao84/neuroforge/commit/4c52abac002198eafd448fc77725c3e5951eaa80

---

**FIX 1.7: LED Component State Management**
CURRENT STATE: LED does not respond to pin changes when code is updated without recreating the component.
REQUIRED BEHAVIOR:
- LED must track which MCU pin it is connected to
- LED must only react to pinChange events for its connected pin
- LED must maintain event listeners when simulation stops and restarts
- LED must reset visual state when simulation stops

IMPLEMENTATION REQUIREMENTS:
- Add connectedPin state to track pin connection
- Implement connection detection from useConnectionStore
- Filter pinChange events by connected pin number
- Add simulationStopped event handler to reset LED state

STATUS: IMPLEMENTED
- connectedPin state added to LEDNode
- Connection detection extracts pin number from connection IDs
- pinChange listener filters by connectedPin
- simulationStopped handler resets isOn and brightness
- Improved connection wiring check

FILES:
- src/components/nodes/LEDNode.tsx

COMMIT:
- https://github.com/caiojordao84/neuroforge/commit/0823b83fd0d46981a07391d9547cebe16b66e9bc

---

**FIX 1.8: Simulation Engine Event Listener Persistence**
CURRENT STATE: Event listeners are removed when simulation stops, causing components to stop responding when code changes.
REQUIRED BEHAVIOR:
- Event listeners must persist across simulation runs
- Pin states must reset when starting a new simulation
- Components must receive simulationStopped event to reset visual state
- No duplicate listeners should accumulate

IMPLEMENTATION REQUIREMENTS:
- Remove removeAllListeners() call from stop() method
- Add resetSimulation() call in start() to clear pin states
- Emit simulationStopped event before clearing state
- Keep listener management in component lifecycle hooks

STATUS: IMPLEMENTED
- Removed removeAllListeners() from stop()
- Added simulationStore.resetSimulation() in start()
- Added emit('simulationStopped') in stop()
- Components now maintain listeners between runs
- Pin states properly reset on each new run

FILES:
- src/engine/SimulationEngine.ts

COMMIT:
- https://github.com/caiojordao84/neuroforge/commit/47aa79592c70ef50e989d772efb15408536bdbb6

---

**FIX 1.9: Variable Support in Code Parser**
CURRENT STATE: Parser only recognizes literal numbers in pinMode and digitalWrite, failing when variables are used.
REQUIRED BEHAVIOR:
- Parser must extract global variable declarations (const int ledPin = 13;)
- Parser must resolve variable names to their values in function calls
- Must support both variables and literals in all Arduino functions
- Must log extracted variables for debugging

IMPLEMENTATION REQUIREMENTS:
- Add extractGlobalVariables method to parse variable declarations
- Create resolveVariable method to convert names to values
- Update all function regex patterns to accept \w+ instead of \d+
- Store variables in Map for fast lookup
- Support const, int, byte, long, float, double types

STATUS: IMPLEMENTED
- extractGlobalVariables parses global declarations with regex
- resolveVariable converts variable names to numeric values
- Updated pinMode, digitalWrite, analogWrite, digitalRead, analogRead to support variables
- variables Map cleared on each parse to prevent stale values
- Console logging for debugging variable extraction

FILES:
- src/engine/CodeParser.ts

COMMIT:
- https://github.com/caiojordao84/neuroforge/commit/e648d374cf8382f0a6a9d5312be81f9ad0386473

---

**FIX 1.10: Loop Execution Re-entrancy Prevention**
CURRENT STATE: TypeScript warning TS6133 for unused isLoopExecuting variable.
REQUIRED BEHAVIOR:
- Prevent overlapping loop executions when scheduleLoop is called multiple times
- Use isLoopExecuting flag to guard against re-entrancy
- Avoid race conditions in async loop execution

IMPLEMENTATION REQUIREMENTS:
- Add guard check at start of scheduleLoop
- Return early if isLoopExecuting is true
- This makes the variable actually read, fixing the warning

STATUS: IMPLEMENTED
- Added guard check in scheduleLoop: if (this.isLoopExecuting) return;
- Prevents re-entrant calls to scheduleLoop
- Fixes TS6133 compiler warning
- Improves simulation stability

FILES:
- src/engine/SimulationEngine.ts

COMMIT:
- https://github.com/caiojordao84/neuroforge/commit/f067b278092c0d930d5931ed7217219fdbc088f7

---

**FIX 1.11: Frontend Build TypeScript Errors**
CURRENT STATE: Build fails with "Cannot find module" errors for framer-motion, vaul, react-hook-form, next-themes.
REQUIRED BEHAVIOR:
- All frontend dependencies must be installed
- TypeScript compilation must pass without errors
- `npm run build` must succeed
- Frontend must run with `npm run dev`

IMPLEMENTATION REQUIREMENTS:
- Install missing dependencies: framer-motion, vaul, react-hook-form, next-themes
- Verify all TypeScript imports resolve correctly
- Test build and dev server startup

STATUS: IMPLEMENTED
- Installed framer-motion for animations in FloatingWindow and CodeEditorWithTabs
- Installed vaul for drawer component in ui/drawer.tsx
- Installed react-hook-form for form handling in ui/form.tsx
- Installed next-themes for theme management in ui/sonner.tsx
- All packages installed with --legacy-peer-deps flag to handle peer dependency conflicts
- TypeScript compilation successful
- Build passes: `npm run build` completes without errors
- Dev server runs: `npm run dev` starts successfully on port 5173

FILES:
- app/package.json (dependencies added)
- app/package-lock.json (lockfile updated)

COMMAND:
```powershell
npm install framer-motion react-hook-form next-themes vaul --legacy-peer-deps
```

---

**PART 2: FEATURE ADDITIONS**

PRIORITY: HIGH
Implement these features in the specified order.

**FEATURE 2.1: Multi-File Code Editor with Tabs**
DESCRIPTION: Code Editor must support multiple files in a tabbed interface.

FUNCTIONAL REQUIREMENTS:
- Display horizontal tab bar at the top of Code Editor window
- Each tab represents one code file with properties:
  - File name (editable via double-click)
  - File extension (auto-detected from language)
  - Associated MCU (selected via dropdown per tab)
  - Unsaved changes indicator (dot or asterisk)
- User actions:
  - Create new tab (plus button)
  - Close tab (X button with confirmation if unsaved)
  - Reorder tabs (drag-and-drop)
  - Switch between tabs (click)
  - Rename file (double-click tab name)
- MCU selector per tab:
  - Dropdown in tab header or properties panel
  - Lists all MCU components in the current circuit
  - Assigns code to specific MCU for multi-MCU projects
- Compilation behavior:
  - Merge all tab contents into execution context
  - Resolve cross-file dependencies if applicable
  - Execute each MCU's code independently in multi-MCU scenarios

TECHNICAL IMPLEMENTATION:
- Create TabManager component inside CodeEditor
- Store tab state in Zustand: array of { id, name, content, language, mcuId, isDirty }
- Integrate Monaco Editor instances per tab (reuse single instance, swap models)
- Implement tab drag-and-drop with react-beautiful-dnd or Framer Motion
- Add keyboard shortcuts (Ctrl+W close, Ctrl+Tab switch)

STATUS: IMPLEMENTED
- Tab bar implemented in CodeEditorWithTabs.tsx
- File creation, deletion, renaming supported via useFileStore
- MCU assignment implemented:
  - Dropdown lists all available MCU nodes from canvas (filtered by type='mcu')
  - Selection updates mcuId in file store
  - Code synched to simulation store's codeByMcu map
- Editor syncs with active file and active MCU

FILES:
- src/components/CodeEditorWithTabs.tsx
- src/stores/useFileStore.ts
- src/stores/useSimulationStore.ts

---

**FEATURE 2.2: Libraries Management System**
DESCRIPTION: Dedicated panel for managing custom and external code libraries.

FUNCTIONAL REQUIREMENTS:
- Add Libraries icon to left vertical toolbar
- Clicking icon toggles Libraries floating window
- Libraries window structure:
  - Tab-based interface similar to Code Editor
  - Each tab represents one library file
  - Create, rename, delete, reorder library tabs
- Library sources:
  - User-written libraries (direct editing in Monaco)
  - Import from URL (GitHub raw links, CDN)
  - Import from file upload (.h, .cpp, .py files)
- Library inclusion:
  - When code contains include or import statements, check library registry
  - Auto-link libraries during compilation
  - Display library dependencies in a tree view
- Library validation:
  - Parse library syntax on save
  - Highlight errors in library code
  - Show which files reference each library

TECHNICAL IMPLEMENTATION:
- Create LibrariesPanel component with floating window wrapper
- Store libraries in Zustand: array of { id, name, content, language, url, dependencies }
- Implement URL fetcher for GitHub imports
- Add library parser to detect function/class exports
- Modify compilation engine to inject library code before user code
- Create dependency resolver for nested library imports

STATUS: IMPLEMENTED
- useLibraryStore created for managing libraries
- LibrariesPanel implemented with:
  - Tabbed interface for multiple libraries
  - Monaco editor integration
  - Import from URL and File Upload
- SimulationEngine updated with `preprocess` method to inject libraries
- TopToolbar and CodeEditorWithTabs updated to use `preprocess` before parsing

FILES:
- src/stores/useLibraryStore.ts
- src/components/LibrariesPanel.tsx
- src/engine/SimulationEngine.ts
- src/components/TopToolbar.tsx
- src/components/CodeEditorWithTabs.tsx
- src/components/LeftSidebar.tsx
- src/App.tsx

---

**FEATURE 2.3: Microcontrollers as First-Class Components**
DESCRIPTION: MCUs must behave identically to other components in the library.

FUNCTIONAL REQUIREMENTS:
- MCU components appear in Components Library panel alongside LEDs, buttons, etc.
- User can drag multiple MCUs onto the canvas
- Each MCU instance is independent with unique ID
- Clicking an MCU opens its Properties Window
- Properties Window displays:
  - Model name and variant
  - Clock speed (editable for simulation speed scaling)
  - Flash and RAM size (informational)
  - Pin count and categories (digital, analog, PWM, communication)
  - Communication interfaces (UART, I2C, SPI, CAN) with pin assignments
  - Boot mode selector (normal, bootloader, debug) if applicable
  - Power consumption estimate
- Multi-MCU communication:
  - Wire MCU1 TX to MCU2 RX for UART
  - Wire I2C SDA/SCL between MCUs
  - Simulation must handle cross-MCU messaging

TECHNICAL IMPLEMENTATION:
- Define MCU as React Flow custom node type
- Create MCUPropertiesPanel component
- Store MCU instances in Zustand simulation state
- Implement inter-MCU event bus for communication protocols
- Add protocol handlers (UART queue, I2C address resolution, SPI master/slave)
- Render MCU pinout dynamically from board definition JSON

STATUS: PARTIALLY IMPLEMENTED
- MCUPropertiesPanel.tsx created with full configuration UI
- MCUNode.tsx implemented as draggable React Flow node
- MCU appears in Components Library
- Board configurations defined in useSimulationStore
- Multiple board types supported (Arduino Uno, ESP32, Raspberry Pi Pico)
- Properties window integrated into App.tsx

FILES:
- src/components/MCUPropertiesPanel.tsx
- src/components/nodes/MCUNode.tsx
- src/stores/useSimulationStore.ts

---

**FEATURE 2.4: Universal Component Properties System**
DESCRIPTION: Every component must have an editable properties window.

FUNCTIONAL REQUIREMENTS:
- Double-click or right-click component opens Properties Window
- Properties Window is a floating, draggable, minimizable, closeable panel
- Properties are organized in logical groups (Electrical, Mechanical, Simulation, Visual)
- Changes to properties immediately update simulation state
- Properties persist with the project save file

WINDOW BEHAVIOR:
- Draggable by title bar
- Resizable from corners
- Minimize collapses to title bar at bottom of screen
- Close button hides window
- Only one properties window open at a time (or allow multiple with tab switching)

STATUS: IMPLEMENTED
- MCUPropertiesPanel implemented with full property editing
- LEDPropertiesPanel implemented with full property editing
- ButtonPropertiesPanel implemented with full property editing
- ServoPropertiesPanel implemented with full property editing
- RGBLEDPropertiesPanel implemented with full property editing
- PotentiometerPropertiesPanel implemented with full property editing
- PropertiesPanel.tsx unified component created for dynamic selection
- Properties button added to LeftSidebar for quick access
- All properties panels integrated into App.tsx via unified PropertiesPanel
- Single-click on any component opens Properties Window (via onNodeClick in CanvasArea)
- Double-click on any component opens Properties Window (via onNodeDoubleClick in CanvasArea)
- Fixed ReactFlowProvider context issue: removed duplicate provider from CanvasArea so PropertiesPanel shares context with CanvasArea
- Added handleDoubleClick to all node components: LEDNode, ButtonNode, ServoNode, RGBLEDNode, PotentiometerNode (MCUNode already had it)

FILES:
- src/components/MCUPropertiesPanel.tsx
- src/components/LEDPropertiesPanel.tsx
- src/components/ButtonPropertiesPanel.tsx
- src/components/ServoPropertiesPanel.tsx
- src/components/RGBLEDPropertiesPanel.tsx
- src/components/PotentiometerPropertiesPanel.tsx
- src/components/PropertiesPanel.tsx
- src/components/LeftSidebar.tsx
- src/App.tsx (FloatingWindow for properties, ReactFlowProvider at top level)
- src/components/CanvasArea.tsx (onNodeClick, onNodeDoubleClick handlers)
- src/components/nodes/LEDNode.tsx (handleDoubleClick)
- src/components/nodes/ButtonNode.tsx (handleDoubleClick)
- src/components/nodes/ServoNode.tsx (handleDoubleClick)
- src/components/nodes/RGBLEDNode.tsx (handleDoubleClick)
- src/components/nodes/PotentiometerNode.tsx (handleDoubleClick)
- src/components/nodes/MCUNode.tsx (handleDoubleClick - already implemented)

---

**FEATURE 2.5: QEMU Real Backend Integration - PHASE 1 (31/01/2026) 🎉**
DESCRIPTION: Integrate real QEMU AVR emulation for authentic Arduino simulation.

FUNCTIONAL REQUIREMENTS:
- Dual simulation mode: Toggle between "Interpreter" (fake) and "QEMU Real"
- Compile Arduino code using arduino-cli in backend
- Execute compiled firmware.hex in qemu-system-avr
- Stream serial output from QEMU to frontend via WebSocket
- Display connection status badges (Backend Connected, QEMU Connected)
- "Compile & Run" button to trigger QEMU simulation
- Support LED blink demo on both simulation modes

TECHNICAL IMPLEMENTATION:

**Backend API (server/):**
- Express server on port 3001
- REST API endpoints:
  - POST /api/compile - Compile Arduino code with arduino-cli
  - POST /api/simulate/start - Start QEMU simulation
  - POST /api/simulate/stop - Stop QEMU simulation
  - GET /api/simulate/status - Get simulation status
  - GET /api/simulate/pins/:pin - Read pin state
  - POST /api/simulate/pins/:pin - Write pin state (simulate button press)
  - GET /api/simulate/serial - Get serial buffer
  - DELETE /api/simulate/serial - Clear serial buffer
- Socket.IO WebSocket server for real-time events:
  - serial - Serial output line
  - pinChange - Pin state change
  - simulationStarted/Stopped/Paused/Resumed - Lifecycle events
- CompilerService.ts - Wrapper for arduino-cli
- QEMURunner.ts - Process manager for qemu-system-avr
- QEMUSimulationEngine.ts - High-level API for simulation control

**Frontend Integration (app/src/):**
- useQEMUStore.ts - Zustand store for QEMU state management
  - Connection status (backend, websocket)
  - Simulation status (running, paused)
  - Mode toggle (fake/real)
- SimulationModeToggle.tsx - Toggle component for mode switching
- QEMUApiClient.ts - REST API client
- QEMUWebSocket.ts - Socket.IO client with auto-reconnect
- useQEMUSimulation.ts - React hook for QEMU lifecycle
- TopToolbar.tsx - Updated with "Compile & Run" button and status badges

**Dependencies Installed:**
- Frontend: framer-motion, vaul, react-hook-form, next-themes
- Backend: express, cors, socket.io, tsx

**System Requirements:**
- arduino-cli installed and in PATH
- qemu-system-avr installed and in PATH
- Node.js 20+

STATUS: ✅ FULLY IMPLEMENTED AND TESTED
- Backend server runs on port 3001 with all endpoints functional
- Frontend connects to backend via REST API and WebSocket
- Compilation with arduino-cli successful
- QEMU AVR execution working with firmware.hex
- Serial output streaming to frontend Serial Monitor in real-time
- LED blink demo works in both Interpreter and QEMU Real modes
- Mode toggle switches seamlessly between fake and real simulation
- Connection status badges display correctly (green when connected)
- WebSocket auto-reconnects on connection loss
- TypeScript compilation passes without errors
- All 40+ dependencies installed and configured

FILES:
**Backend:**
- server/src/server.ts - Express app entry point
- server/src/api/routes.ts - REST API endpoints
- server/src/api/websocket.ts - Socket.IO server setup
- server/src/services/CompilerService.ts - arduino-cli wrapper
- server/src/services/QEMURunner.ts - QEMU process manager
- server/src/services/QEMUSimulationEngine.ts - High-level simulation API
- server/package.json - Backend dependencies
- server/.env - Environment variables

**Frontend:**
- app/src/stores/useQEMUStore.ts - QEMU state management
- app/src/components/SimulationModeToggle.tsx - Mode toggle UI
- app/src/lib/qemu/QEMUApiClient.ts - REST API client
- app/src/lib/qemu/QEMUWebSocket.ts - Socket.IO client
- app/src/hooks/useQEMUSimulation.ts - QEMU lifecycle hook
- app/src/components/TopToolbar.tsx - Compile & Run button, status badges
- app/package.json - Frontend dependencies (updated)

COMMITS:
- Initial QEMU POC and backend structure
- Frontend QEMU integration
- TypeScript dependency fixes
- Full Phase 1 implementation

TESTING PERFORMED:
- LED blink sketch compilation: ✅ Success
- QEMU execution with firmware.hex: ✅ Success
- Serial output streaming: ✅ Success
- Mode toggle functionality: ✅ Success
- WebSocket connection stability: ✅ Success
- Backend/Frontend communication: ✅ Success

**NEXT PHASE:**
Phase 2 will implement real GPIO communication via QEMU Monitor for interactive pin read/write.

---

**PART 3: COMPONENT PROPERTY SPECIFICATIONS**

Define the complete data model for each component type.

COMPONENT: LED (Single Color)
PROPERTIES:
Identification:
- Component ID (auto-generated UUID)
- Display name (user-editable string)

Electrical Characteristics:
- Color (enum: red, green, blue, yellow, white, orange, custom RGB)
- Forward voltage Vf (float, volts, default varies by color)
- Nominal current If (float, milliamps, default 20mA)
- Maximum current If_max (float, milliamps)
- Reverse voltage Vr (float, volts)
- Internal resistance (float, ohms)

Optical Characteristics:
- Brightness model (enum: linear, logarithmic, exponential)
- Luminous intensity (float, millicandelas)
- Viewing angle (float, degrees, default 120)

Simulation Settings:
- Polarity enforcement (boolean, default true)
- Initial state (enum: on, off)
- Brightness multiplier (float, 0.0 to 1.0)

Physical Layout:
- Pin mapping (object: anode pin ID, cathode pin ID)
- Orientation (float, rotation degrees 0/90/180/270)
- Position on canvas (x, y coordinates)

---

COMPONENT: RGB LED
PROPERTIES:
Identification:
- Component ID
- Display name

Electrical Characteristics:
- Type (enum: common anode CA, common cathode CC)
- Forward voltage per channel (object: Vf_red, Vf_green, Vf_blue)
- Current per channel (object: If_red, If_green, If_blue)
- Maximum total current (float, milliamps)
- Internal resistance per channel (object: R_red, R_green, R_blue)

Optical Characteristics:
- Independent channel control (boolean, default true)
- Color mixing model (enum: additive RGB, custom matrix)
- Brightness model (enum: linear, gamma-corrected)

Simulation Settings:
- Polarity enforcement (boolean)
- Initial color (hex color code or RGB tuple)

Physical Layout:
- Pin mapping (object: pin_red, pin_green, pin_blue, pin_common)
- Orientation (degrees)

---

COMPONENT: Servo Motor
PROPERTIES:
Identification:
- Component ID
- Display name

Model Specifications:
- Model name (string: SG90, MG996R, etc.)
- Voltage range (object: min_voltage, max_voltage)
- Stall current (float, milliamps)
- Idle current (float, milliamps)
- Torque (float, kg-cm)

PWM Configuration:
- PWM min pulse width (float, microseconds, default 500)
- PWM max pulse width (float, microseconds, default 2500)
- PWM neutral pulse width (float, microseconds, default 1500)
- PWM frequency (float, Hz, default 50)

Mechanical Properties:
- Rotation range (enum: 90 degrees, 180 degrees, 360 continuous, 360 single turn)
- Maximum speed (float, degrees per second or RPM)
- Deadband (float, microseconds)
- Smoothing factor (float, 0.0 to 1.0, simulates inertia)
- Positional accuracy (float, degrees)

Simulation Settings:
- Load model (enum: no load, light load, heavy load)
- Initial angle (float, degrees)
- Update frequency (integer, Hz, default 50)

Physical Layout:
- Pin mapping (object: signal_pin, vcc_pin, gnd_pin)

---

COMPONENT: Potentiometer
PROPERTIES:
Identification:
- Component ID
- Display name

Electrical Characteristics:
- Type (enum: rotary, linear slider)
- Total resistance (float, ohms, common: 1K, 10K, 100K)
- Tolerance (float, percentage, default 10%)
- Wiper position (float, 0.0 to 100.0, represents percentage)
- Taper (enum: linear, logarithmic audio, reverse logarithmic)

Mechanical Properties:
- Mechanical rotation limits (object: min_degrees, max_degrees)
- Detents (boolean, for stepped potentiometers)
- Number of steps (integer, if detents enabled)

Simulation Settings:
- Initial wiper position (float, 0.0 to 100.0)
- Allow user control (boolean, if false, only code can change)

Physical Layout:
- Pin mapping (object: pin_1, pin_wiper, pin_3)
- Orientation (degrees)

---

COMPONENT: Push Button
PROPERTIES:
Identification:
- Component ID
- Display name

Electrical Characteristics:
- Type (enum: momentary, toggle, normally open NO, normally closed NC)
- Form factor (string: tactile, arcade, emergency stop)
- Contact resistance (float, ohms, typically less than 1)
- Maximum current (float, amps)
- Maximum voltage (float, volts)

Mechanical Characteristics:
- Debounce time (float, milliseconds, default 50)
- Actuation force (float, grams, informational)
- Travel distance (float, millimeters, informational)

Simulation Settings:
- Default state (enum: open, closed, based on NO/NC type)
- Initial state override (enum: default, pressed, released)
- Bounce simulation enabled (boolean, default false)

Physical Layout:
- Pin mapping (object: pin_1, pin_2 for SPST, or more for DPDT)
- Pull resistor behavior (enum: none, pull-up, pull-down)

---

DELIVERABLES

Provide complete, production-ready TypeScript code for:
1. All bug fixes with before/after code comparison
2. Complete implementation of all four features
3. Zustand store schemas for all new state management
4. React components for all new UI elements
5. Type definitions for all component property models
6. Integration instructions with existing codebase

CODE REQUIREMENTS:
- No placeholder comments or TODO items
- Full error handling and validation
- Type-safe implementations with strict TypeScript
- Comprehensive inline documentation
- Performance optimizations where applicable
- Accessibility considerations (ARIA labels, keyboard navigation)

OUTPUT FORMAT:
Organize response into clearly labeled sections with file paths and complete source code for each file.

---

## IMPLEMENTATION PROGRESS SUMMARY

### COMPLETED:
- FIX 1.1: Language Selector Implementation (z-index fix for dropdown, functionality already worked)
- FIX 1.3: Microcontroller Component Interaction (MCUNode with pin hitboxes)
- FIX 1.4: Wire System Overhaul (Manhattan routing, color coding, mostly complete)
- FIX 1.5: Floating Window Stability (Smooth drag, z-index, localStorage persistence)
- FIX 1.6: Code Parser Function Extraction (Brace counting algorithm for robust parsing)
- FIX 1.7: LED Component State Management (Connected pin tracking, event filtering)
- FIX 1.8: Simulation Engine Event Listener Persistence (Listeners persist across runs)
- FIX 1.9: Variable Support in Code Parser (Global variable extraction and resolution)
- FIX 1.10: Loop Execution Re-entrancy Prevention (Guard check in scheduleLoop)
- FIX 1.11: Frontend Build TypeScript Errors (Installed missing dependencies)
- FEATURE 2.1: Multi-File Code Editor with Tabs (Tab management, MCU assignment, Drag-and-Drop, Shortcuts)
- FEATURE 2.2: Libraries Management System (Library store, panel, and injection)
- FEATURE 2.3: Microcontrollers as First-Class Components (MCUPropertiesPanel, drag from library)
- FEATURE 2.4: Universal Component Properties System (Implemented for all component types)
- ✅ **FEATURE 2.5: QEMU Real Backend Integration - PHASE 1 COMPLETE (31/01/2026)**

### PENDING:
- FIX 1.2: Remove Generic Board Component (Remove hardcoded board from CanvasArea)
- FIX 1.4: Wire System enhancements (snap-to-pin, Zustand storage)

### COMPLETED ADDITIONALLY:
- FIX 1.2 (partial): MCU components are draggable, MCUNode created with full pin interaction
- FEATURE 2.4: Universal Component Properties System for all component types (MCU, LED, Button, Servo, RGB LED, Potentiometer)
- FEATURE 2.4 (enhancement): Click/double-click on any component now opens Properties Window
  - Fixed ReactFlowProvider context issue (removed duplicate provider from CanvasArea)
  - Added onNodeClick and onNodeDoubleClick handlers to CanvasArea ReactFlow component
  - Added handleDoubleClick to all node components (LED, Button, Servo, RGB LED, Potentiometer)

---

**Última atualização:** 31/01/2026 11:06 AM WET
