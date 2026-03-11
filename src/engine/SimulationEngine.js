"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulationEngine = exports.SimulationEngine = void 0;
exports.useSimulationEngine = useSimulationEngine;
var useSimulationStore_1 = require("@/stores/useSimulationStore");
var useSerialStore_1 = require("@/stores/useSerialStore");
var useLibraryStore_1 = require("@/stores/useLibraryStore");
// Preprocessor to inject libraries
var preprocessCode = function (code, language) {
    var libraries = useLibraryStore_1.useLibraryStore.getState().libraries;
    var processedCode = code;
    if (language === 'cpp') {
        // Basic C++ include handler (non-recursive for now)
        var includeRegex = /#include\s*[<"](.+)[>"]/g;
        var match = void 0;
        // We need to match all includes, find library, and inject content
        // To avoid regex state issues with global flag, we'll collect replacements first
        var replacements = [];
        var _loop_1 = function () {
            var libName = match[1];
            var lib = libraries.find(function (l) { return l.name === libName && l.language === 'cpp'; });
            if (lib) {
                replacements.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    content: "// Included from ".concat(lib.name, "\n").concat(lib.content, "\n")
                });
            }
        };
        while ((match = includeRegex.exec(code)) !== null) {
            _loop_1();
        }
        // Apply replacements in reverse order to preserve indices
        for (var i = replacements.length - 1; i >= 0; i--) {
            var r = replacements[i];
            processedCode = processedCode.substring(0, r.start) + r.content + processedCode.substring(r.end);
        }
    }
    else if (language === 'micropython' || language === 'circuitpython') {
        // Basic Python import handler
        // Supports: import module
        // Does NOT support: from module import * (yet, for custom libs)
        var importRegex = /^import\s+(\w+)/gm;
        var match = void 0;
        var replacements = [];
        var _loop_2 = function () {
            var libName = match[1];
            // Try to find lib with .py extension or just name
            var lib = libraries.find(function (l) {
                return (l.name === libName || l.name === "".concat(libName, ".py")) &&
                    (l.language === 'micropython' || l.language === 'circuitpython');
            });
            if (lib) {
                replacements.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    content: "# Imported from ".concat(lib.name, "\n").concat(lib.content, "\n")
                });
            }
        };
        while ((match = importRegex.exec(code)) !== null) {
            _loop_2();
        }
        for (var i = replacements.length - 1; i >= 0; i--) {
            var r = replacements[i];
            processedCode = processedCode.substring(0, r.start) + r.content + processedCode.substring(r.end);
        }
    }
    return processedCode;
};
var EventEmitter = /** @class */ (function () {
    function EventEmitter() {
        this.listeners = new Map();
    }
    EventEmitter.prototype.on = function (event, callback) {
        var _this = this;
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return function () {
            var callbacks = _this.listeners.get(event);
            if (callbacks) {
                var index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    };
    EventEmitter.prototype.emit = function (event, data) {
        var callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(function (cb) { return cb(data); });
        }
    };
    EventEmitter.prototype.removeAllListeners = function () {
        this.listeners.clear();
    };
    return EventEmitter;
}());
// Simulation Engine - Core Class
var SimulationEngine = /** @class */ (function (_super) {
    __extends(SimulationEngine, _super);
    function SimulationEngine() {
        var _this = _super.call(this) || this;
        _this.isRunning = false;
        _this.isPaused = false;
        _this.loopTimeoutId = null;
        _this.timeoutIds = [];
        _this.setupExecuted = false;
        _this.loopFunction = null;
        _this.speedMultiplier = 1;
        _this.pinCache = new Map();
        _this.isLoopExecuting = false;
        _this.simulationStartTime = 0;
        _this.serialRxBuffer = [];
        return _this;
    }
    SimulationEngine.prototype.preprocess = function (code, language) {
        return preprocessCode(code, language);
    };
    SimulationEngine.prototype.start = function (setupFn_1, loopFn_1) {
        return __awaiter(this, arguments, void 0, function (setupFn, loopFn, speed) {
            var simulationStore, serialStore, error_1;
            if (speed === void 0) { speed = 1; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isRunning) {
                            this.stop();
                        }
                        this.speedMultiplier = speed;
                        this.isRunning = true;
                        this.isPaused = false;
                        this.setupExecuted = false;
                        this.loopFunction = loopFn;
                        this.simulationStartTime = Date.now();
                        simulationStore = useSimulationStore_1.useSimulationStore.getState();
                        serialStore = useSerialStore_1.useSerialStore.getState();
                        // Reset pin states
                        simulationStore.resetSimulation();
                        simulationStore.startSimulation();
                        serialStore.addTerminalLine('▶️ Simulation started', 'success');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, setupFn()];
                    case 2:
                        _a.sent();
                        this.setupExecuted = true;
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        serialStore.addTerminalLine("\u274C Setup error: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)), 'error');
                        this.stop();
                        return [2 /*return*/];
                    case 4:
                        // Start the loop - will wait for each iteration to complete before scheduling next
                        this.scheduleLoop();
                        return [2 /*return*/];
                }
            });
        });
    };
    SimulationEngine.prototype.stop = function () {
        this.isRunning = false;
        this.isPaused = false;
        this.setupExecuted = false;
        this.loopFunction = null;
        this.isLoopExecuting = false;
        this.simulationStartTime = 0;
        this.timeoutIds.forEach(function (id) { return clearTimeout(id); });
        this.timeoutIds = [];
        if (this.loopTimeoutId !== null) {
            clearTimeout(this.loopTimeoutId);
            this.loopTimeoutId = null;
        }
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        var serialStore = useSerialStore_1.useSerialStore.getState();
        simulationStore.stopSimulation();
        serialStore.addTerminalLine('⏹️ Simulation stopped', 'info');
        // Notify components that simulation stopped so they can reset their state
        this.emit('simulationStopped', {});
        // Don't remove listeners - components need them to react to pin changes
        this.pinCache.clear();
        this.serialRxBuffer = [];
    };
    SimulationEngine.prototype.pause = function () {
        if (!this.isRunning)
            return;
        this.isPaused = true;
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        var serialStore = useSerialStore_1.useSerialStore.getState();
        simulationStore.pauseSimulation();
        serialStore.addTerminalLine('⏸️ Simulation paused', 'warning');
    };
    SimulationEngine.prototype.resume = function () {
        if (!this.isRunning || !this.isPaused)
            return;
        this.isPaused = false;
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        var serialStore = useSerialStore_1.useSerialStore.getState();
        simulationStore.startSimulation();
        serialStore.addTerminalLine('▶️ Simulation resumed', 'success');
        // Resume the loop
        this.scheduleLoop();
    };
    SimulationEngine.prototype.reset = function () {
        this.stop();
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        var serialStore = useSerialStore_1.useSerialStore.getState();
        simulationStore.resetSimulation();
        serialStore.addTerminalLine('🔄 Simulation reset', 'info');
    };
    SimulationEngine.prototype.setSpeed = function (speed) {
        this.speedMultiplier = speed;
        var serialStore = useSerialStore_1.useSerialStore.getState();
        serialStore.addTerminalLine("\u26A1 Simulation speed: ".concat(speed, "x"), 'info');
    };
    SimulationEngine.prototype.scheduleLoop = function () {
        var _this = this;
        if (!this.isRunning || this.isPaused || !this.loopFunction) {
            return;
        }
        // Prevent overlapping loop executions
        if (this.isLoopExecuting) {
            return;
        }
        // Execute the loop function
        this.isLoopExecuting = true;
        try {
            var result = this.loopFunction();
            // Handle both sync and async loop functions
            if (result instanceof Promise) {
                result
                    .then(function () {
                    _this.isLoopExecuting = false;
                    // Schedule next iteration immediately after current completes
                    if (_this.isRunning && !_this.isPaused) {
                        _this.loopTimeoutId = window.setTimeout(function () {
                            _this.scheduleLoop();
                        }, 0);
                    }
                })
                    .catch(function (error) {
                    _this.handleLoopError(error);
                });
            }
            else {
                // Sync function completed
                this.isLoopExecuting = false;
                // Schedule next iteration immediately after current completes
                if (this.isRunning && !this.isPaused) {
                    this.loopTimeoutId = window.setTimeout(function () {
                        _this.scheduleLoop();
                    }, 0);
                }
            }
        }
        catch (error) {
            this.handleLoopError(error);
        }
    };
    SimulationEngine.prototype.handleLoopError = function (error) {
        this.isLoopExecuting = false;
        var serialStore = useSerialStore_1.useSerialStore.getState();
        serialStore.addTerminalLine("\u274C Loop error: ".concat(error instanceof Error ? error.message : String(error)), 'error');
        this.stop();
    };
    SimulationEngine.prototype.pinMode = function (pin, mode) {
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        simulationStore.setPinMode(pin, mode);
        var pinState = simulationStore.getPinState(pin);
        if (pinState) {
            this.pinCache.set(pin, pinState);
        }
        this.emit('pinMode', { pin: pin, mode: mode });
    };
    SimulationEngine.prototype.digitalWrite = function (pin, value) {
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        var pinState = simulationStore.getPinState(pin);
        if (!pinState) {
            var serialStore = useSerialStore_1.useSerialStore.getState();
            serialStore.addTerminalLine("\u26A0\uFE0F Warning: Pin ".concat(pin, " mode not set. Call pinMode(").concat(pin, ", OUTPUT) first."), 'warning');
            return;
        }
        if (pinState.mode !== 'OUTPUT') {
            var serialStore = useSerialStore_1.useSerialStore.getState();
            serialStore.addTerminalLine("\u26A0\uFE0F Warning: Pin ".concat(pin, " is not in OUTPUT mode"), 'warning');
            return;
        }
        simulationStore.digitalWrite(pin, value);
        var updatedPinState = simulationStore.getPinState(pin);
        if (updatedPinState) {
            this.pinCache.set(pin, updatedPinState);
        }
        this.emit('pinChange', { pin: pin, value: value });
    };
    SimulationEngine.prototype.digitalRead = function (pin) {
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        var pinState = simulationStore.getPinState(pin);
        if (!pinState) {
            var serialStore = useSerialStore_1.useSerialStore.getState();
            serialStore.addTerminalLine("\u26A0\uFE0F Warning: digitalRead on Pin ".concat(pin, " but mode not set. Auto-assuming INPUT."), 'warning');
            // Auto-set to INPUT to prevent crash, mimicking real arduino floating state
            simulationStore.setPinMode(pin, 'INPUT');
        }
        else if (pinState.mode !== 'INPUT' && pinState.mode !== 'INPUT_PULLUP') {
            var serialStore = useSerialStore_1.useSerialStore.getState();
            serialStore.addTerminalLine("\u26A0\uFE0F Warning: digitalRead on Pin ".concat(pin, " which is in ").concat(pinState.mode, " mode. Result may be unreliable."), 'warning');
        }
        return simulationStore.digitalRead(pin);
    };
    SimulationEngine.prototype.analogWrite = function (pin, value) {
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        var pinState = simulationStore.getPinState(pin);
        if (!pinState) {
            var serialStore = useSerialStore_1.useSerialStore.getState();
            serialStore.addTerminalLine("\u26A0\uFE0F Warning: Pin ".concat(pin, " mode not set. Call pinMode(").concat(pin, ", OUTPUT) first."), 'warning');
            return;
        }
        if (pinState.mode !== 'OUTPUT') {
            var serialStore = useSerialStore_1.useSerialStore.getState();
            serialStore.addTerminalLine("\u26A0\uFE0F Warning: Pin ".concat(pin, " is not in OUTPUT mode"), 'warning');
            return;
        }
        simulationStore.analogWrite(pin, value);
        var updatedPinState = simulationStore.getPinState(pin);
        if (updatedPinState) {
            this.pinCache.set(pin, updatedPinState);
        }
        this.emit('pinChange', { pin: pin, value: value });
    };
    SimulationEngine.prototype.analogRead = function (pin) {
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        var pinState = simulationStore.getPinState(pin);
        if (!pinState) {
            var serialStore = useSerialStore_1.useSerialStore.getState();
            // Arduino implicitly handles analogRead without pinMode, but we warn in sim for good practice
            serialStore.addTerminalLine("\u2139\uFE0F Notice: analogRead on Pin ".concat(pin, " without pinMode. This works, but explicit pinMode(INPUT) is better."), 'info');
            simulationStore.setPinMode(pin, 'INPUT');
        }
        return simulationStore.analogRead(pin);
    };
    // Method for external components (sensors, buttons) to drive pins
    // ignoring the MCU's pin mode (e.g. driving an INPUT pin HIGH/LOW)
    SimulationEngine.prototype.externalDigitalWrite = function (pin, value) {
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        // We can just set the value directly in the store
        // The store's digitalWrite doesn't enforce mode, only the Engine's wrapper does.
        simulationStore.digitalWrite(pin, value);
        var updatedPinState = simulationStore.getPinState(pin);
        if (updatedPinState) {
            this.pinCache.set(pin, updatedPinState);
        }
        this.emit('pinChange', { pin: pin, value: value });
    };
    SimulationEngine.prototype.getPinState = function (pin) {
        if (this.pinCache.has(pin)) {
            return this.pinCache.get(pin);
        }
        var simulationStore = useSimulationStore_1.useSimulationStore.getState();
        return simulationStore.getPinState(pin);
    };
    SimulationEngine.prototype.delay = function (ms) {
        var _this = this;
        return new Promise(function (resolve) {
            var adjustedMs = Math.round(ms / _this.speedMultiplier);
            var timeoutId = window.setTimeout(function () {
                var index = _this.timeoutIds.indexOf(timeoutId);
                if (index > -1) {
                    _this.timeoutIds.splice(index, 1);
                }
                resolve();
            }, adjustedMs);
            _this.timeoutIds.push(timeoutId);
        });
    };
    SimulationEngine.prototype.delayMicroseconds = function () {
        // Microsecond delays are essentially instant in simulation
    };
    SimulationEngine.prototype.millis = function () {
        if (this.simulationStartTime === 0)
            return 0;
        return Date.now() - this.simulationStartTime;
    };
    SimulationEngine.prototype.micros = function () {
        if (this.simulationStartTime === 0)
            return 0;
        return (Date.now() - this.simulationStartTime) * 1000;
    };
    SimulationEngine.prototype.serialBegin = function (baudRate) {
        var serialStore = useSerialStore_1.useSerialStore.getState();
        serialStore.setBaudRate(baudRate);
        serialStore.addTerminalLine("\uD83D\uDD0C Serial initialized at ".concat(baudRate, " baud"), 'info');
    };
    SimulationEngine.prototype.serialPrint = function (text) {
        var serialStore = useSerialStore_1.useSerialStore.getState();
        serialStore.serialPrint(text);
        // MISSION 4: Emit event for TX LED
        this.emit('serialTransmit', { text: text });
    };
    SimulationEngine.prototype.serialPrintln = function (text) {
        var serialStore = useSerialStore_1.useSerialStore.getState();
        serialStore.serialPrintln(text);
        // MISSION 4: Emit event for TX LED
        this.emit('serialTransmit', { text: text });
    };
    SimulationEngine.prototype.log = function (message) {
        this.serialPrintln(message);
    };
    SimulationEngine.prototype.warn = function (message) {
        this.serialPrintln("\u26A0\uFE0F ".concat(message));
    };
    SimulationEngine.prototype.serialAvailable = function () {
        return this.serialRxBuffer.length;
    };
    SimulationEngine.prototype.serialRead = function () {
        if (this.serialRxBuffer.length === 0)
            return -1;
        var byte = this.serialRxBuffer.shift();
        this.emit('serialReceive', { byte: byte });
        return byte;
    };
    SimulationEngine.prototype.serialWrite = function (value) {
        var text = typeof value === 'number'
            ? String.fromCharCode(value)
            : String(value);
        this.serialPrint(text);
        return text.length;
    };
    SimulationEngine.prototype.serialParseInt = function () {
        var str = '';
        while (this.serialRxBuffer.length > 0) {
            var ch = String.fromCharCode(this.serialRxBuffer[0]);
            if (/[\d\-]/.test(ch)) {
                str += ch;
                this.serialRxBuffer.shift();
            }
            else {
                break;
            }
        }
        return str ? parseInt(str, 10) : 0;
    };
    SimulationEngine.prototype.serialInject = function (text) {
        for (var i = 0; i < text.length; i++) {
            this.serialRxBuffer.push(text.charCodeAt(i));
        }
        this.emit('serialData', { text: text });
    };
    SimulationEngine.prototype.tone = function (pin, frequency, duration) {
        this.emit('tone', { pin: pin, frequency: frequency, duration: duration });
    };
    SimulationEngine.prototype.noTone = function (pin) {
        this.emit('noTone', { pin: pin });
    };
    SimulationEngine.prototype.map = function (value, fromLow, fromHigh, toLow, toHigh) {
        return Math.round(((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow);
    };
    SimulationEngine.prototype.constrain = function (value, min, max) {
        return Math.min(Math.max(value, min), max);
    };
    SimulationEngine.prototype.random = function (min, max) {
        if (min === undefined) {
            return Math.random();
        }
        if (max === undefined) {
            return Math.floor(Math.random() * min);
        }
        return Math.floor(Math.random() * (max - min) + min);
    };
    SimulationEngine.prototype.getIsRunning = function () {
        return this.isRunning;
    };
    SimulationEngine.prototype.getIsPaused = function () {
        return this.isPaused;
    };
    SimulationEngine.prototype.getSetupExecuted = function () {
        return this.setupExecuted;
    };
    return SimulationEngine;
}(EventEmitter));
exports.SimulationEngine = SimulationEngine;
// Singleton instance
exports.simulationEngine = new SimulationEngine();
// Hook for React components
function useSimulationEngine() {
    return exports.simulationEngine;
}
