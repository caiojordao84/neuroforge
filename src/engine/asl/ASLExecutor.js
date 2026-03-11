"use strict";
// src/engine/asl/ASLExecutor.ts
// Executor assíncrono da ASL v1 sobre o SimulationEngine (modo fake).
// Suporta: funções, chamadas, arrays/objetos, break/continue/return, print/log,
// abortSignal para controle de loops e delays, structs, pointer arrays.
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createASLRuntime = createASLRuntime;
var SimulationEngine_1 = require("@/engine/SimulationEngine");
var ReturnSignal = /** @class */ (function () {
    function ReturnSignal(value) {
        this.value = value;
    }
    return ReturnSignal;
}());
var BreakSignal = /** @class */ (function () {
    function BreakSignal() {
    }
    return BreakSignal;
}());
var ContinueSignal = /** @class */ (function () {
    function ContinueSignal() {
    }
    return ContinueSignal;
}());
function createASLRuntime(program, options) {
    var _this = this;
    var _a;
    if (options === void 0) { options = {}; }
    var engine = (_a = options.engine) !== null && _a !== void 0 ? _a : SimulationEngine_1.simulationEngine;
    var globalEnv = new Map();
    var functionMap = new Map();
    for (var _i = 0, _b = program.globals; _i < _b.length; _i++) {
        var g = _b[_i];
        var rawInitial = g.initialValue !== undefined ? g.initialValue : defaultValueForType(g.type);
        var initial = Array.isArray(rawInitial) || (rawInitial && typeof rawInitial === 'object')
            ? JSON.parse(JSON.stringify(rawInitial))
            : rawInitial;
        globalEnv.set(g.name, initial);
    }
    for (var _c = 0, _d = program.functions; _c < _d.length; _c++) {
        var f = _d[_c];
        functionMap.set(f.name, f);
    }
    var setupFuncDef = program.functions.find(function (f) { return f.name === 'setup'; });
    var mainTask = program.tasks[0];
    var runContext = {
        engine: engine,
        functions: functionMap,
        globals: globalEnv,
        abortSignal: options.abortSignal,
        printBuffer: '',
    };
    var setup = function () { return __awaiter(_this, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!setupFuncDef) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, executeStatements(setupFuncDef.body, globalEnv, runContext)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    if (!(e_1 instanceof ReturnSignal))
                        throw e_1;
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var loop = function () { return __awaiter(_this, void 0, void 0, function () {
        var e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!mainTask) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, executeStatements(mainTask.body, globalEnv, runContext)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _a.sent();
                    if (!(e_2 instanceof ReturnSignal))
                        throw e_2;
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return { setup: setup, loop: loop };
}
function defaultValueForType(type) {
    switch (type) {
        case 'int':
        case 'float':
            return 0;
        case 'bool':
            return false;
        case 'string':
            return '';
        case 'struct':
            return {};
        default:
            return 0;
    }
}
function executeStatements(stmts, localEnv, ctx) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, stmts_1, s, _a, pin, pin, valRaw, _b, value, pin, value, pin, v, dr, cond, cycles, e_3, cycles, e_4, cycles, broken, e_5, iterable, cycles, _c, iterable_1, item, e_6, discVal, matched, defaultIdx, i, c, testVal, i, e_7, ms, total, chunk, chunks, i, remaining, val, _d, val, safeVal, idx, val, arr, row, col, val, arr, d1, d2, d3, val, arr, targetObj, val, val, _e, parts, _f, _g, a, _h, _j, _k, msg, ptrObj, val, port, data, port, len, result, bus, addr, data, bus, addr, len, result, bus, cs, tx, result, pin, freq, duty, pin, duty, pin, freq, pin, inst, now, IN, PT, _l, elapsed, inst, now, IN, PT, _m, elapsed, inst, now, IN, PT, _o, elapsed, inst, CU, R, PV, _p, inst, CD, LD, PV, _q, inst, S, R, inst, R, S, inst, IN, inst, IN;
        var _r, _s, _t, _u, _v, _w, _x, _y;
        return __generator(this, function (_z) {
            switch (_z.label) {
                case 0:
                    if ((_r = ctx.abortSignal) === null || _r === void 0 ? void 0 : _r.aborted)
                        return [2 /*return*/];
                    _i = 0, stmts_1 = stmts;
                    _z.label = 1;
                case 1:
                    if (!(_i < stmts_1.length)) return [3 /*break*/, 178];
                    s = stmts_1[_i];
                    if ((_s = ctx.abortSignal) === null || _s === void 0 ? void 0 : _s.aborted)
                        return [2 /*return*/];
                    _a = s.kind;
                    switch (_a) {
                        case 'comment': return [3 /*break*/, 2];
                        case 'pinMode': return [3 /*break*/, 3];
                        case 'digitalWrite': return [3 /*break*/, 5];
                        case 'analogWrite': return [3 /*break*/, 10];
                        case 'read': return [3 /*break*/, 13];
                        case 'if': return [3 /*break*/, 15];
                        case 'while': return [3 /*break*/, 21];
                        case 'doWhile': return [3 /*break*/, 31];
                        case 'for': return [3 /*break*/, 41];
                        case 'forIn': return [3 /*break*/, 52];
                        case 'switch': return [3 /*break*/, 62];
                        case 'delay': return [3 /*break*/, 77];
                        case 'declare': return [3 /*break*/, 83];
                        case 'assign': return [3 /*break*/, 87];
                        case 'setIndex': return [3 /*break*/, 89];
                        case 'setIndex2D': return [3 /*break*/, 92];
                        case 'setIndex3D': return [3 /*break*/, 96];
                        case 'setMember': return [3 /*break*/, 101];
                        case 'expr': return [3 /*break*/, 104];
                        case 'return': return [3 /*break*/, 106];
                        case 'break': return [3 /*break*/, 110];
                        case 'continue': return [3 /*break*/, 111];
                        case 'print': return [3 /*break*/, 112];
                        case 'setPointer': return [3 /*break*/, 117];
                        case 'uartWrite': return [3 /*break*/, 120];
                        case 'uartRead': return [3 /*break*/, 123];
                        case 'i2cWrite': return [3 /*break*/, 126];
                        case 'i2cRead': return [3 /*break*/, 130];
                        case 'spiTransfer': return [3 /*break*/, 134];
                        case 'pwmInit': return [3 /*break*/, 138];
                        case 'pwmSetDuty': return [3 /*break*/, 142];
                        case 'pwmSetFreq': return [3 /*break*/, 145];
                        case 'pwmStop': return [3 /*break*/, 148];
                        case 'timerTON': return [3 /*break*/, 150];
                        case 'timerTOF': return [3 /*break*/, 153];
                        case 'timerTP': return [3 /*break*/, 156];
                        case 'counterCTU': return [3 /*break*/, 159];
                        case 'counterCTD': return [3 /*break*/, 163];
                        case 'latchSR': return [3 /*break*/, 167];
                        case 'latchRS': return [3 /*break*/, 170];
                        case 'trigR': return [3 /*break*/, 173];
                        case 'trigF': return [3 /*break*/, 175];
                    }
                    return [3 /*break*/, 177];
                case 2: return [3 /*break*/, 177];
                case 3: return [4 /*yield*/, evalExpr(s.pin, localEnv, ctx)];
                case 4:
                    pin = _z.sent();
                    ctx.engine.pinMode(pin, s.mode);
                    return [3 /*break*/, 177];
                case 5: return [4 /*yield*/, evalExpr(s.pin, localEnv, ctx)];
                case 6:
                    pin = _z.sent();
                    if (!(typeof s.value === 'string')) return [3 /*break*/, 7];
                    _b = s.value;
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 8:
                    _b = _z.sent();
                    _z.label = 9;
                case 9:
                    valRaw = _b;
                    value = valRaw === 'HIGH' || valRaw === 1 || valRaw === true ? 'HIGH' : 'LOW';
                    ctx.engine.digitalWrite(pin, value);
                    return [3 /*break*/, 177];
                case 10: return [4 /*yield*/, evalExpr(s.pin, localEnv, ctx)];
                case 11:
                    pin = _z.sent();
                    return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 12:
                    value = _z.sent();
                    ctx.engine.analogWrite(pin, value);
                    return [3 /*break*/, 177];
                case 13: return [4 /*yield*/, evalExpr(s.pin, localEnv, ctx)];
                case 14:
                    pin = _z.sent();
                    v = void 0;
                    if (s.mode === 'DIGITAL') {
                        dr = ctx.engine.digitalRead(pin);
                        v = dr === 'HIGH' ? 1 : 0;
                    }
                    else {
                        v = ctx.engine.analogRead(pin);
                    }
                    setVar(s.target, v, localEnv, ctx.globals);
                    return [3 /*break*/, 177];
                case 15: return [4 /*yield*/, evalExpr(s.condition, localEnv, ctx)];
                case 16:
                    cond = _z.sent();
                    if (!cond) return [3 /*break*/, 18];
                    return [4 /*yield*/, executeStatements(s.thenBranch, localEnv, ctx)];
                case 17:
                    _z.sent();
                    return [3 /*break*/, 20];
                case 18:
                    if (!s.elseBranch) return [3 /*break*/, 20];
                    return [4 /*yield*/, executeStatements(s.elseBranch, localEnv, ctx)];
                case 19:
                    _z.sent();
                    _z.label = 20;
                case 20: return [3 /*break*/, 177];
                case 21:
                    cycles = 0;
                    _z.label = 22;
                case 22: return [4 /*yield*/, evalExpr(s.condition, localEnv, ctx)];
                case 23:
                    if (!_z.sent()) return [3 /*break*/, 30];
                    if ((_t = ctx.abortSignal) === null || _t === void 0 ? void 0 : _t.aborted)
                        return [2 /*return*/];
                    _z.label = 24;
                case 24:
                    _z.trys.push([24, 26, , 27]);
                    return [4 /*yield*/, executeStatements(s.body, localEnv, ctx)];
                case 25:
                    _z.sent();
                    return [3 /*break*/, 27];
                case 26:
                    e_3 = _z.sent();
                    if (e_3 instanceof BreakSignal)
                        return [3 /*break*/, 30];
                    if (e_3 instanceof ContinueSignal)
                        return [3 /*break*/, 22];
                    throw e_3;
                case 27:
                    cycles++;
                    if (!(cycles % 10 === 0)) return [3 /*break*/, 29];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 0); })];
                case 28:
                    _z.sent();
                    _z.label = 29;
                case 29: return [3 /*break*/, 22];
                case 30: return [3 /*break*/, 177];
                case 31:
                    cycles = 0;
                    _z.label = 32;
                case 32:
                    if ((_u = ctx.abortSignal) === null || _u === void 0 ? void 0 : _u.aborted)
                        return [2 /*return*/];
                    _z.label = 33;
                case 33:
                    _z.trys.push([33, 35, , 36]);
                    return [4 /*yield*/, executeStatements(s.body, localEnv, ctx)];
                case 34:
                    _z.sent();
                    return [3 /*break*/, 36];
                case 35:
                    e_4 = _z.sent();
                    if (e_4 instanceof BreakSignal)
                        return [3 /*break*/, 40];
                    if (e_4 instanceof ContinueSignal)
                        return [3 /*break*/, 38];
                    throw e_4;
                case 36:
                    cycles++;
                    if (!(cycles % 10 === 0)) return [3 /*break*/, 38];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 0); })];
                case 37:
                    _z.sent();
                    _z.label = 38;
                case 38: return [4 /*yield*/, evalExpr(s.condition, localEnv, ctx)];
                case 39:
                    if (_z.sent()) return [3 /*break*/, 32];
                    _z.label = 40;
                case 40: return [3 /*break*/, 177];
                case 41:
                    cycles = 0;
                    _z.label = 42;
                case 42: return [4 /*yield*/, evalExpr(s.condition, localEnv, ctx)];
                case 43:
                    if (!_z.sent()) return [3 /*break*/, 51];
                    if ((_v = ctx.abortSignal) === null || _v === void 0 ? void 0 : _v.aborted)
                        return [2 /*return*/];
                    broken = false;
                    _z.label = 44;
                case 44:
                    _z.trys.push([44, 46, , 47]);
                    return [4 /*yield*/, executeStatements(s.body, localEnv, ctx)];
                case 45:
                    _z.sent();
                    return [3 /*break*/, 47];
                case 46:
                    e_5 = _z.sent();
                    if (e_5 instanceof BreakSignal) {
                        broken = true;
                    }
                    else if (e_5 instanceof ContinueSignal) {
                        /* fall through to update */
                    }
                    else
                        throw e_5;
                    return [3 /*break*/, 47];
                case 47:
                    if (broken)
                        return [3 /*break*/, 51];
                    // Update always runs (even on continue), matching C/C++ for-loop semantics
                    return [4 /*yield*/, executeStatements(s.update, localEnv, ctx)];
                case 48:
                    // Update always runs (even on continue), matching C/C++ for-loop semantics
                    _z.sent();
                    cycles++;
                    if (!(cycles % 10 === 0)) return [3 /*break*/, 50];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 0); })];
                case 49:
                    _z.sent();
                    _z.label = 50;
                case 50: return [3 /*break*/, 42];
                case 51: return [3 /*break*/, 177];
                case 52: return [4 /*yield*/, evalExpr(s.iterable, localEnv, ctx)];
                case 53:
                    iterable = _z.sent();
                    if (!Array.isArray(iterable)) {
                        ctx.engine.log("\u26A0\uFE0F ForIn: iterable is not an array, got ".concat(typeof iterable));
                        return [3 /*break*/, 177];
                    }
                    cycles = 0;
                    _c = 0, iterable_1 = iterable;
                    _z.label = 54;
                case 54:
                    if (!(_c < iterable_1.length)) return [3 /*break*/, 61];
                    item = iterable_1[_c];
                    if ((_w = ctx.abortSignal) === null || _w === void 0 ? void 0 : _w.aborted)
                        return [2 /*return*/];
                    localEnv.set(s.varName, item);
                    _z.label = 55;
                case 55:
                    _z.trys.push([55, 57, , 58]);
                    return [4 /*yield*/, executeStatements(s.body, localEnv, ctx)];
                case 56:
                    _z.sent();
                    return [3 /*break*/, 58];
                case 57:
                    e_6 = _z.sent();
                    if (e_6 instanceof BreakSignal)
                        return [3 /*break*/, 61];
                    if (e_6 instanceof ContinueSignal)
                        return [3 /*break*/, 60];
                    throw e_6;
                case 58:
                    cycles++;
                    if (!(cycles % 10 === 0)) return [3 /*break*/, 60];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 0); })];
                case 59:
                    _z.sent();
                    _z.label = 60;
                case 60:
                    _c++;
                    return [3 /*break*/, 54];
                case 61: return [3 /*break*/, 177];
                case 62: return [4 /*yield*/, evalExpr(s.discriminant, localEnv, ctx)];
                case 63:
                    discVal = _z.sent();
                    matched = false;
                    defaultIdx = -1;
                    _z.label = 64;
                case 64:
                    _z.trys.push([64, 75, , 76]);
                    i = 0;
                    _z.label = 65;
                case 65:
                    if (!(i < s.cases.length)) return [3 /*break*/, 70];
                    c = s.cases[i];
                    if (c.test === null) {
                        defaultIdx = i;
                        return [3 /*break*/, 69];
                    }
                    if (!!matched) return [3 /*break*/, 67];
                    return [4 /*yield*/, evalExpr(c.test, localEnv, ctx)];
                case 66:
                    testVal = _z.sent();
                    if (discVal == testVal)
                        matched = true;
                    _z.label = 67;
                case 67:
                    if (!matched) return [3 /*break*/, 69];
                    return [4 /*yield*/, executeStatements(c.body, localEnv, ctx)];
                case 68:
                    _z.sent();
                    _z.label = 69;
                case 69:
                    i++;
                    return [3 /*break*/, 65];
                case 70:
                    if (!(!matched && defaultIdx >= 0)) return [3 /*break*/, 74];
                    i = defaultIdx;
                    _z.label = 71;
                case 71:
                    if (!(i < s.cases.length)) return [3 /*break*/, 74];
                    return [4 /*yield*/, executeStatements(s.cases[i].body, localEnv, ctx)];
                case 72:
                    _z.sent();
                    _z.label = 73;
                case 73:
                    i++;
                    return [3 /*break*/, 71];
                case 74: return [3 /*break*/, 76];
                case 75:
                    e_7 = _z.sent();
                    if (!(e_7 instanceof BreakSignal))
                        throw e_7;
                    return [3 /*break*/, 76];
                case 76: return [3 /*break*/, 177];
                case 77: return [4 /*yield*/, evalExpr(s.milliseconds, localEnv, ctx)];
                case 78:
                    ms = _z.sent();
                    total = Math.max(0, Number(ms) || 0);
                    chunk = 50;
                    chunks = Math.ceil(total / chunk);
                    i = 0;
                    _z.label = 79;
                case 79:
                    if (!(i < chunks)) return [3 /*break*/, 82];
                    if ((_x = ctx.abortSignal) === null || _x === void 0 ? void 0 : _x.aborted)
                        return [2 /*return*/];
                    remaining = total - i * chunk;
                    return [4 /*yield*/, ctx.engine.delay(Math.min(chunk, remaining))];
                case 80:
                    _z.sent();
                    _z.label = 81;
                case 81:
                    i++;
                    return [3 /*break*/, 79];
                case 82: return [3 /*break*/, 177];
                case 83:
                    if (!s.value) return [3 /*break*/, 85];
                    return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 84:
                    _d = _z.sent();
                    return [3 /*break*/, 86];
                case 85:
                    _d = defaultValueForType(s.type);
                    _z.label = 86;
                case 86:
                    val = _d;
                    localEnv.set(s.name, val);
                    return [3 /*break*/, 177];
                case 87: return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 88:
                    val = _z.sent();
                    safeVal = (val && typeof val === 'object')
                        ? JSON.parse(JSON.stringify(val))
                        : val;
                    setVar(s.target, safeVal, localEnv, ctx.globals);
                    return [3 /*break*/, 177];
                case 89: return [4 /*yield*/, evalExpr(s.index, localEnv, ctx)];
                case 90:
                    idx = _z.sent();
                    return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 91:
                    val = _z.sent();
                    arr = getVar(s.target, localEnv, ctx.globals);
                    if (Array.isArray(arr)) {
                        arr[idx] = val;
                    }
                    return [3 /*break*/, 177];
                case 92: return [4 /*yield*/, evalExpr(s.rowIndex, localEnv, ctx)];
                case 93:
                    row = _z.sent();
                    return [4 /*yield*/, evalExpr(s.colIndex, localEnv, ctx)];
                case 94:
                    col = _z.sent();
                    return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 95:
                    val = _z.sent();
                    arr = getVar(s.target, localEnv, ctx.globals);
                    if (Array.isArray(arr) && Array.isArray(arr[row])) {
                        arr[row][col] = val;
                    }
                    return [3 /*break*/, 177];
                case 96: return [4 /*yield*/, evalExpr(s.d1Index, localEnv, ctx)];
                case 97:
                    d1 = _z.sent();
                    return [4 /*yield*/, evalExpr(s.d2Index, localEnv, ctx)];
                case 98:
                    d2 = _z.sent();
                    return [4 /*yield*/, evalExpr(s.d3Index, localEnv, ctx)];
                case 99:
                    d3 = _z.sent();
                    return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 100:
                    val = _z.sent();
                    arr = getVar(s.target, localEnv, ctx.globals);
                    if (Array.isArray(arr) && Array.isArray(arr[d1]) && Array.isArray(arr[d1][d2])) {
                        arr[d1][d2][d3] = val;
                    }
                    return [3 /*break*/, 177];
                case 101: return [4 /*yield*/, evalExpr(s.target, localEnv, ctx)];
                case 102:
                    targetObj = _z.sent();
                    return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 103:
                    val = _z.sent();
                    if (targetObj && typeof targetObj === 'object') {
                        targetObj[s.property] = val;
                    }
                    return [3 /*break*/, 177];
                case 104: return [4 /*yield*/, evalExpr(s.expr, localEnv, ctx)];
                case 105:
                    _z.sent();
                    return [3 /*break*/, 177];
                case 106:
                    if (!s.value) return [3 /*break*/, 108];
                    return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 107:
                    _e = _z.sent();
                    return [3 /*break*/, 109];
                case 108:
                    _e = undefined;
                    _z.label = 109;
                case 109:
                    val = _e;
                    throw new ReturnSignal(val);
                case 110: throw new BreakSignal();
                case 111: throw new ContinueSignal();
                case 112:
                    parts = [];
                    _f = 0, _g = s.args;
                    _z.label = 113;
                case 113:
                    if (!(_f < _g.length)) return [3 /*break*/, 116];
                    a = _g[_f];
                    _j = (_h = parts).push;
                    _k = String;
                    return [4 /*yield*/, evalExpr(a, localEnv, ctx)];
                case 114:
                    _j.apply(_h, [_k.apply(void 0, [(_y = _z.sent()) !== null && _y !== void 0 ? _y : ''])]);
                    _z.label = 115;
                case 115:
                    _f++;
                    return [3 /*break*/, 113];
                case 116:
                    msg = parts.join(' ');
                    if (s.newline !== false) {
                        ctx.engine.log(ctx.printBuffer + msg);
                        ctx.printBuffer = '';
                    }
                    else {
                        ctx.printBuffer += msg;
                    }
                    return [3 /*break*/, 177];
                case 117: return [4 /*yield*/, evalExpr(s.target, localEnv, ctx)];
                case 118:
                    ptrObj = _z.sent();
                    return [4 /*yield*/, evalExpr(s.value, localEnv, ctx)];
                case 119:
                    val = _z.sent();
                    if (ptrObj && typeof ptrObj === 'object' && ptrObj.__isPtr) {
                        setVar(ptrObj.target, val, localEnv, ctx.globals);
                    }
                    return [3 /*break*/, 177];
                case 120: return [4 /*yield*/, evalExpr(s.port, localEnv, ctx)];
                case 121:
                    port = _z.sent();
                    return [4 /*yield*/, evalExpr(s.data, localEnv, ctx)];
                case 122:
                    data = _z.sent();
                    ctx.engine.emit('hardwareCall', {
                        callee: 'uart.write',
                        args: [port, data],
                    });
                    return [3 /*break*/, 177];
                case 123: return [4 /*yield*/, evalExpr(s.port, localEnv, ctx)];
                case 124:
                    port = _z.sent();
                    return [4 /*yield*/, evalExpr(s.length, localEnv, ctx)];
                case 125:
                    len = _z.sent();
                    result = ctx.engine.emit('hardwareCall', {
                        callee: 'uart.read',
                        args: [port, len],
                    });
                    setVar(s.target, result !== null && result !== void 0 ? result : [], localEnv, ctx.globals);
                    return [3 /*break*/, 177];
                case 126: return [4 /*yield*/, evalExpr(s.bus, localEnv, ctx)];
                case 127:
                    bus = _z.sent();
                    return [4 /*yield*/, evalExpr(s.address, localEnv, ctx)];
                case 128:
                    addr = _z.sent();
                    return [4 /*yield*/, evalExpr(s.data, localEnv, ctx)];
                case 129:
                    data = _z.sent();
                    ctx.engine.emit('hardwareCall', {
                        callee: 'i2c.write',
                        args: [bus, addr, data],
                    });
                    return [3 /*break*/, 177];
                case 130: return [4 /*yield*/, evalExpr(s.bus, localEnv, ctx)];
                case 131:
                    bus = _z.sent();
                    return [4 /*yield*/, evalExpr(s.address, localEnv, ctx)];
                case 132:
                    addr = _z.sent();
                    return [4 /*yield*/, evalExpr(s.length, localEnv, ctx)];
                case 133:
                    len = _z.sent();
                    result = ctx.engine.emit('hardwareCall', {
                        callee: 'i2c.read',
                        args: [bus, addr, len],
                    });
                    setVar(s.target, result !== null && result !== void 0 ? result : [], localEnv, ctx.globals);
                    return [3 /*break*/, 177];
                case 134: return [4 /*yield*/, evalExpr(s.bus, localEnv, ctx)];
                case 135:
                    bus = _z.sent();
                    return [4 /*yield*/, evalExpr(s.csPin, localEnv, ctx)];
                case 136:
                    cs = _z.sent();
                    return [4 /*yield*/, evalExpr(s.txData, localEnv, ctx)];
                case 137:
                    tx = _z.sent();
                    result = ctx.engine.emit('hardwareCall', {
                        callee: 'spi.transfer',
                        args: [bus, cs, tx],
                    });
                    if (s.target) {
                        setVar(s.target, result !== null && result !== void 0 ? result : [], localEnv, ctx.globals);
                    }
                    return [3 /*break*/, 177];
                case 138: return [4 /*yield*/, evalExpr(s.pin, localEnv, ctx)];
                case 139:
                    pin = _z.sent();
                    return [4 /*yield*/, evalExpr(s.freq, localEnv, ctx)];
                case 140:
                    freq = _z.sent();
                    return [4 /*yield*/, evalExpr(s.duty, localEnv, ctx)];
                case 141:
                    duty = _z.sent();
                    ctx.engine.emit('hardwareCall', {
                        callee: 'pwm.init',
                        args: [pin, freq, duty],
                    });
                    return [3 /*break*/, 177];
                case 142: return [4 /*yield*/, evalExpr(s.pin, localEnv, ctx)];
                case 143:
                    pin = _z.sent();
                    return [4 /*yield*/, evalExpr(s.duty, localEnv, ctx)];
                case 144:
                    duty = _z.sent();
                    ctx.engine.emit('hardwareCall', {
                        callee: 'pwm.setDuty',
                        args: [pin, duty],
                    });
                    return [3 /*break*/, 177];
                case 145: return [4 /*yield*/, evalExpr(s.pin, localEnv, ctx)];
                case 146:
                    pin = _z.sent();
                    return [4 /*yield*/, evalExpr(s.freq, localEnv, ctx)];
                case 147:
                    freq = _z.sent();
                    ctx.engine.emit('hardwareCall', {
                        callee: 'pwm.setFreq',
                        args: [pin, freq],
                    });
                    return [3 /*break*/, 177];
                case 148: return [4 /*yield*/, evalExpr(s.pin, localEnv, ctx)];
                case 149:
                    pin = _z.sent();
                    ctx.engine.emit('hardwareCall', {
                        callee: 'pwm.stop',
                        args: [pin],
                    });
                    return [3 /*break*/, 177];
                case 150:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({
                        IN: false, PT: 0, ET: 0, Q: false, startTime: 0,
                    }); });
                    now = ctx.engine.millis();
                    return [4 /*yield*/, evalExpr(s.in, localEnv, ctx)];
                case 151:
                    IN = !!(_z.sent());
                    _l = Number;
                    return [4 /*yield*/, evalExpr(s.pt, localEnv, ctx)];
                case 152:
                    PT = _l.apply(void 0, [_z.sent()]) || 0;
                    if (!inst.IN && IN) {
                        inst.startTime = now;
                    }
                    inst.IN = IN;
                    inst.PT = PT;
                    if (IN) {
                        elapsed = now - inst.startTime;
                        inst.ET = elapsed;
                        inst.Q = elapsed >= PT;
                    }
                    else {
                        inst.ET = 0;
                        inst.Q = false;
                    }
                    return [3 /*break*/, 177];
                case 153:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({
                        IN: false, PT: 0, ET: 0, Q: false, startTime: 0,
                    }); });
                    now = ctx.engine.millis();
                    return [4 /*yield*/, evalExpr(s.in, localEnv, ctx)];
                case 154:
                    IN = !!(_z.sent());
                    _m = Number;
                    return [4 /*yield*/, evalExpr(s.pt, localEnv, ctx)];
                case 155:
                    PT = _m.apply(void 0, [_z.sent()]) || 0;
                    if (IN && !inst.IN) {
                        inst.Q = true;
                        inst.ET = 0;
                    }
                    else if (!IN && inst.IN) {
                        inst.startTime = now;
                    }
                    if (!IN && inst.Q) {
                        elapsed = now - inst.startTime;
                        inst.ET = elapsed;
                        if (elapsed >= PT) {
                            inst.Q = false;
                            inst.ET = 0;
                        }
                    }
                    inst.IN = IN;
                    inst.PT = PT;
                    return [3 /*break*/, 177];
                case 156:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({
                        IN: false, PT: 0, ET: 0, Q: false, startTime: 0,
                    }); });
                    now = ctx.engine.millis();
                    return [4 /*yield*/, evalExpr(s.in, localEnv, ctx)];
                case 157:
                    IN = !!(_z.sent());
                    _o = Number;
                    return [4 /*yield*/, evalExpr(s.pt, localEnv, ctx)];
                case 158:
                    PT = _o.apply(void 0, [_z.sent()]) || 0;
                    if (IN && !inst.IN && !inst.Q) {
                        inst.Q = true;
                        inst.startTime = now;
                        inst.ET = 0;
                    }
                    if (inst.Q) {
                        elapsed = now - inst.startTime;
                        inst.ET = elapsed;
                        if (elapsed >= PT) {
                            inst.Q = false;
                            inst.ET = 0;
                        }
                    }
                    inst.IN = IN;
                    inst.PT = PT;
                    return [3 /*break*/, 177];
                case 159:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({
                        CU_prev: false, PV: 0, CV: 0, Q: false,
                    }); });
                    return [4 /*yield*/, evalExpr(s.cu, localEnv, ctx)];
                case 160:
                    CU = !!(_z.sent());
                    return [4 /*yield*/, evalExpr(s.r, localEnv, ctx)];
                case 161:
                    R = !!(_z.sent());
                    _p = Number;
                    return [4 /*yield*/, evalExpr(s.pv, localEnv, ctx)];
                case 162:
                    PV = _p.apply(void 0, [_z.sent()]) || 0;
                    if (R) {
                        inst.CV = 0;
                        inst.Q = false;
                    }
                    else {
                        if (CU && !inst.CU_prev) {
                            inst.CV++;
                        }
                        inst.Q = inst.CV >= PV;
                    }
                    inst.CU_prev = CU;
                    inst.PV = PV;
                    return [3 /*break*/, 177];
                case 163:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({
                        CD_prev: false, PV: 0, CV: 0, Q: false,
                    }); });
                    return [4 /*yield*/, evalExpr(s.cd, localEnv, ctx)];
                case 164:
                    CD = !!(_z.sent());
                    return [4 /*yield*/, evalExpr(s.ld, localEnv, ctx)];
                case 165:
                    LD = !!(_z.sent());
                    _q = Number;
                    return [4 /*yield*/, evalExpr(s.pv, localEnv, ctx)];
                case 166:
                    PV = _q.apply(void 0, [_z.sent()]) || 0;
                    if (LD) {
                        inst.CV = PV;
                    }
                    else {
                        if (CD && !inst.CD_prev) {
                            inst.CV = Math.max(0, inst.CV - 1);
                        }
                    }
                    inst.Q = inst.CV <= 0;
                    inst.CD_prev = CD;
                    inst.PV = PV;
                    return [3 /*break*/, 177];
                case 167:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({ Q: false }); });
                    return [4 /*yield*/, evalExpr(s.s, localEnv, ctx)];
                case 168:
                    S = !!(_z.sent());
                    return [4 /*yield*/, evalExpr(s.r, localEnv, ctx)];
                case 169:
                    R = !!(_z.sent());
                    if (S && !R)
                        inst.Q = true;
                    if (R && !S)
                        inst.Q = false;
                    return [3 /*break*/, 177];
                case 170:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({ Q: false }); });
                    return [4 /*yield*/, evalExpr(s.r, localEnv, ctx)];
                case 171:
                    R = !!(_z.sent());
                    return [4 /*yield*/, evalExpr(s.s, localEnv, ctx)];
                case 172:
                    S = !!(_z.sent());
                    if (R)
                        inst.Q = false;
                    else if (S)
                        inst.Q = true;
                    return [3 /*break*/, 177];
                case 173:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({
                        prev: false, Q: false,
                    }); });
                    return [4 /*yield*/, evalExpr(s.in, localEnv, ctx)];
                case 174:
                    IN = !!(_z.sent());
                    inst.Q = IN && !inst.prev;
                    inst.prev = IN;
                    return [3 /*break*/, 177];
                case 175:
                    inst = getInstance(s.instance, localEnv, ctx.globals, function () { return ({
                        prev: false, Q: false,
                    }); });
                    return [4 /*yield*/, evalExpr(s.in, localEnv, ctx)];
                case 176:
                    IN = !!(_z.sent());
                    inst.Q = !IN && inst.prev;
                    inst.prev = IN;
                    return [3 /*break*/, 177];
                case 177:
                    _i++;
                    return [3 /*break*/, 1];
                case 178: return [2 /*return*/];
            }
        });
    });
}
function setVar(name, val, local, global) {
    if (local.has(name))
        local.set(name, val);
    else
        global.set(name, val);
}
function getVar(name, local, global) {
    if (local.has(name))
        return local.get(name);
    return global.get(name);
}
function getInstance(name, local, global, initialFactory) {
    var inst = local.has(name) ? local.get(name) : global.get(name);
    if (!inst) {
        inst = initialFactory();
        if (local.has(name))
            local.set(name, inst);
        else
            global.set(name, inst);
    }
    return inst;
}
function evalExpr(expr, env, ctx) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, arr, idx, arr, row, col, arr, d1, d2, d3, obj, target, v, l, r, pinNum, modeRaw, _b, mode, pin, pin, pin, valRaw, value, val, str, byte, min, _c, max, _d, pin, pin, val, us_1, _e, args, _i, _f, a, _g, _h, args, _j, _k, a, _l, _m, pin, state, timeout, result, args, _o, _p, a, _q, _r, result, args, _s, _t, a, _u, _v, args, _w, _x, a, _y, _z, pin, angle, args, _0, _1, a, _2, _3, args, _4, _5, a, _6, _7, arg, arg, arg0, arg1, arg, arg, arg, arg, arg0, arg1, arg0, arg1, arg, arg, arg, arg, arg, s, a, b, s, s, val, prec, _8, v, v, v, arr, arr, str, args, i, _9, _10, _11, args_1, arg, arr, args, _12, _13, a, _14, _15, funcDef, callEnv, i, val, _16, safeVal, e_8, arr, _17, _18, el, _19, _20, cond, obj, _21, _22, prop, k, v;
        var _23, _24, _25, _26;
        return __generator(this, function (_27) {
            switch (_27.label) {
                case 0:
                    _a = expr.kind;
                    switch (_a) {
                        case 'literal': return [3 /*break*/, 1];
                        case 'var': return [3 /*break*/, 2];
                        case 'index': return [3 /*break*/, 3];
                        case 'index2D': return [3 /*break*/, 6];
                        case 'index3D': return [3 /*break*/, 10];
                        case 'member': return [3 /*break*/, 15];
                        case 'unary': return [3 /*break*/, 17];
                        case 'binary': return [3 /*break*/, 19];
                        case 'call': return [3 /*break*/, 22];
                        case 'array': return [3 /*break*/, 174];
                        case 'conditional': return [3 /*break*/, 179];
                        case 'object': return [3 /*break*/, 181];
                    }
                    return [3 /*break*/, 187];
                case 1: return [2 /*return*/, expr.value];
                case 2: return [2 /*return*/, getVar(expr.name, env, ctx.globals)];
                case 3: return [4 /*yield*/, evalExpr(expr.target, env, ctx)];
                case 4:
                    arr = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.index, env, ctx)];
                case 5:
                    idx = _27.sent();
                    if (Array.isArray(arr)) {
                        return [2 /*return*/, arr[idx]];
                    }
                    if (arr && typeof arr === 'object') {
                        return [2 /*return*/, arr[idx]];
                    }
                    ctx.engine.log("\u26A0\uFE0F Index access on non-indexable value; returning 0");
                    return [2 /*return*/, 0];
                case 6: return [4 /*yield*/, evalExpr(expr.array, env, ctx)];
                case 7:
                    arr = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.rowIndex, env, ctx)];
                case 8:
                    row = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.colIndex, env, ctx)];
                case 9:
                    col = _27.sent();
                    if (Array.isArray(arr) && Array.isArray(arr[row]))
                        return [2 /*return*/, arr[row][col]];
                    ctx.engine.log("\u26A0\uFE0F 2D index access on non-indexable value; returning 0");
                    return [2 /*return*/, 0];
                case 10: return [4 /*yield*/, evalExpr(expr.array, env, ctx)];
                case 11:
                    arr = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.d1Index, env, ctx)];
                case 12:
                    d1 = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.d2Index, env, ctx)];
                case 13:
                    d2 = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.d3Index, env, ctx)];
                case 14:
                    d3 = _27.sent();
                    if (Array.isArray(arr) && Array.isArray(arr[d1]) && Array.isArray(arr[d1][d2])) {
                        return [2 /*return*/, arr[d1][d2][d3]];
                    }
                    ctx.engine.log("\u26A0\uFE0F 3D index access on non-indexable value; returning 0");
                    return [2 /*return*/, 0];
                case 15: return [4 /*yield*/, evalExpr(expr.target, env, ctx)];
                case 16:
                    obj = _27.sent();
                    if (obj && typeof obj === 'object') {
                        return [2 /*return*/, obj[expr.property]];
                    }
                    ctx.engine.log("\u26A0\uFE0F Member access '".concat(expr.property, "' on non-object; returning 0"));
                    return [2 /*return*/, 0];
                case 17:
                    if (expr.op === '&') {
                        target = expr.expr;
                        if (target.kind === 'var') {
                            return [2 /*return*/, { __isPtr: true, target: target.name }];
                        }
                        return [2 /*return*/, 0];
                    }
                    return [4 /*yield*/, evalExpr(expr.expr, env, ctx)];
                case 18:
                    v = _27.sent();
                    if (expr.op === '*') {
                        if (v && typeof v === 'object' && v.__isPtr) {
                            return [2 /*return*/, getVar(v.target, env, ctx.globals)];
                        }
                        return [2 /*return*/, 0];
                    }
                    if (expr.op === '!')
                        return [2 /*return*/, !v];
                    if (expr.op === '~')
                        return [2 /*return*/, ~v];
                    if (expr.op === '+')
                        return [2 /*return*/, +v];
                    return [2 /*return*/, -v];
                case 19: return [4 /*yield*/, evalExpr(expr.left, env, ctx)];
                case 20:
                    l = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.right, env, ctx)];
                case 21:
                    r = _27.sent();
                    switch (expr.op) {
                        case '+': return [2 /*return*/, l + r];
                        case '-': return [2 /*return*/, l - r];
                        case '*': return [2 /*return*/, l * r];
                        case '/': return [2 /*return*/, l / r];
                        case '%': return [2 /*return*/, l % r];
                        case '==': return [2 /*return*/, l == r];
                        case '!=': return [2 /*return*/, l != r];
                        case '<': return [2 /*return*/, l < r];
                        case '<=': return [2 /*return*/, l <= r];
                        case '>': return [2 /*return*/, l > r];
                        case '>=': return [2 /*return*/, l >= r];
                        case '&&': return [2 /*return*/, l && r];
                        case '||': return [2 /*return*/, l || r];
                        case '&': return [2 /*return*/, l & r];
                        case '|': return [2 /*return*/, l | r];
                        case '^': return [2 /*return*/, l ^ r];
                        case '<<': return [2 /*return*/, l << r];
                        case '>>': return [2 /*return*/, l >> r];
                        default: return [2 /*return*/, 0];
                    }
                    _27.label = 22;
                case 22:
                    if (!(expr.callee === 'Pin')) return [3 /*break*/, 27];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 23:
                    pinNum = _27.sent();
                    if (!expr.args[1]) return [3 /*break*/, 25];
                    return [4 /*yield*/, evalExpr(expr.args[1], env, ctx)];
                case 24:
                    _b = _27.sent();
                    return [3 /*break*/, 26];
                case 25:
                    _b = 1;
                    _27.label = 26;
                case 26:
                    modeRaw = _b;
                    mode = modeRaw === 0 ? 'INPUT' : 'OUTPUT';
                    ctx.engine.pinMode(pinNum, mode);
                    return [2 /*return*/, pinNum];
                case 27:
                    if (!(expr.callee === 'Pin.on')) return [3 /*break*/, 29];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 28:
                    pin = _27.sent();
                    ctx.engine.digitalWrite(pin, 'HIGH');
                    return [2 /*return*/, 0];
                case 29:
                    if (!(expr.callee === 'Pin.off')) return [3 /*break*/, 31];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 30:
                    pin = _27.sent();
                    ctx.engine.digitalWrite(pin, 'LOW');
                    return [2 /*return*/, 0];
                case 31:
                    if (!(expr.callee === 'Pin.value')) return [3 /*break*/, 35];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 32:
                    pin = _27.sent();
                    if (!(expr.args.length > 1)) return [3 /*break*/, 34];
                    return [4 /*yield*/, evalExpr(expr.args[1], env, ctx)];
                case 33:
                    valRaw = _27.sent();
                    value = (valRaw === 'HIGH' || valRaw === 1 || valRaw === true) ? 'HIGH' : 'LOW';
                    ctx.engine.digitalWrite(pin, value);
                    return [2 /*return*/, 0];
                case 34: return [2 /*return*/, ctx.engine.digitalRead(pin) === 'HIGH' ? 1 : 0];
                case 35:
                    if (!(expr.callee === 'Pin.id')) return [3 /*break*/, 37];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 36: return [2 /*return*/, _27.sent()];
                case 37:
                    if (expr.callee === 'Serial.begin')
                        return [2 /*return*/, 0];
                    if (expr.callee === 'Serial.available') {
                        return [2 /*return*/, ctx.engine.serialAvailable()];
                    }
                    if (expr.callee === 'Serial.read') {
                        return [2 /*return*/, ctx.engine.serialRead()];
                    }
                    if (!(expr.callee === 'Serial.write')) return [3 /*break*/, 39];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 38:
                    val = _27.sent();
                    return [2 /*return*/, ctx.engine.serialWrite(val)];
                case 39:
                    if (expr.callee === 'Serial.readString') {
                        str = '';
                        byte = ctx.engine.serialRead();
                        while (byte !== -1) {
                            str += String.fromCharCode(byte);
                            byte = ctx.engine.serialRead();
                        }
                        return [2 /*return*/, str];
                    }
                    if (expr.callee === 'Serial.parseInt') {
                        return [2 /*return*/, ctx.engine.serialParseInt()];
                    }
                    if (!(expr.callee === 'random')) return [3 /*break*/, 46];
                    if (!expr.args[0]) return [3 /*break*/, 41];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 40:
                    _c = _27.sent();
                    return [3 /*break*/, 42];
                case 41:
                    _c = 0;
                    _27.label = 42;
                case 42:
                    min = _c;
                    if (!expr.args[1]) return [3 /*break*/, 44];
                    return [4 /*yield*/, evalExpr(expr.args[1], env, ctx)];
                case 43:
                    _d = _27.sent();
                    return [3 /*break*/, 45];
                case 44:
                    _d = 100;
                    _27.label = 45;
                case 45:
                    max = _d;
                    return [2 /*return*/, Math.floor(Math.random() * (max - min)) + min];
                case 46:
                    if (!(expr.callee === 'digitalRead')) return [3 /*break*/, 48];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 47:
                    pin = _27.sent();
                    return [2 /*return*/, ctx.engine.digitalRead(pin) === 'HIGH' ? 1 : 0];
                case 48:
                    if (!(expr.callee === 'analogRead')) return [3 /*break*/, 50];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 49:
                    pin = _27.sent();
                    return [2 /*return*/, ctx.engine.analogRead(pin)];
                case 50:
                    if (expr.callee === 'millis')
                        return [2 /*return*/, ctx.engine.millis()];
                    if (expr.callee === 'micros')
                        return [2 /*return*/, ctx.engine.micros()];
                    if (!(expr.callee === 'sizeof' || expr.callee === '__sizeof')) return [3 /*break*/, 52];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 51:
                    val = _27.sent();
                    if (Array.isArray(val))
                        return [2 /*return*/, val.length];
                    if (typeof val === 'string')
                        return [2 /*return*/, val.length];
                    return [2 /*return*/, 1];
                case 52:
                    if (!(expr.callee === 'delayMicroseconds')) return [3 /*break*/, 58];
                    if (!expr.args[0]) return [3 /*break*/, 54];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 53:
                    _e = _27.sent();
                    return [3 /*break*/, 55];
                case 54:
                    _e = 0;
                    _27.label = 55;
                case 55:
                    us_1 = _e;
                    ctx.engine.delayMicroseconds(us_1);
                    if (!(us_1 >= 1000)) return [3 /*break*/, 57];
                    // Await blocks execution for larger delays based on milliseconds
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, Math.floor(us_1 / 1000)); })];
                case 56:
                    // Await blocks execution for larger delays based on milliseconds
                    _27.sent();
                    _27.label = 57;
                case 57: return [2 /*return*/, 0];
                case 58:
                    if (!(expr.callee === 'attachInterrupt' || expr.callee === 'detachInterrupt')) return [3 /*break*/, 63];
                    args = [];
                    _i = 0, _f = expr.args;
                    _27.label = 59;
                case 59:
                    if (!(_i < _f.length)) return [3 /*break*/, 62];
                    a = _f[_i];
                    _h = (_g = args).push;
                    return [4 /*yield*/, evalExpr(a, env, ctx)];
                case 60:
                    _h.apply(_g, [_27.sent()]);
                    _27.label = 61;
                case 61:
                    _i++;
                    return [3 /*break*/, 59];
                case 62:
                    ctx.engine.emit('hardwareCall', { callee: expr.callee, args: args });
                    return [2 /*return*/, 0];
                case 63:
                    if (!(expr.callee === 'pulseIn')) return [3 /*break*/, 68];
                    args = [];
                    _j = 0, _k = expr.args;
                    _27.label = 64;
                case 64:
                    if (!(_j < _k.length)) return [3 /*break*/, 67];
                    a = _k[_j];
                    _m = (_l = args).push;
                    return [4 /*yield*/, evalExpr(a, env, ctx)];
                case 65:
                    _m.apply(_l, [_27.sent()]);
                    _27.label = 66;
                case 66:
                    _j++;
                    return [3 /*break*/, 64];
                case 67:
                    pin = args[0], state = args[1], timeout = args[2];
                    result = ctx.engine.emit('hardwareCall', {
                        callee: 'pulseIn',
                        args: [pin, state, timeout],
                    });
                    if (typeof result === 'number') {
                        return [2 /*return*/, result];
                    }
                    ctx.engine.log("\u26A0\uFE0F pulseIn(".concat(pin, ", ").concat(state, ") returned no simulated value; defaulting to 0\u00B5s"));
                    return [2 /*return*/, 0];
                case 68:
                    if (!(expr.callee === 'shiftOut' || expr.callee === 'shiftIn')) return [3 /*break*/, 73];
                    args = [];
                    _o = 0, _p = expr.args;
                    _27.label = 69;
                case 69:
                    if (!(_o < _p.length)) return [3 /*break*/, 72];
                    a = _p[_o];
                    _r = (_q = args).push;
                    return [4 /*yield*/, evalExpr(a, env, ctx)];
                case 70:
                    _r.apply(_q, [_27.sent()]);
                    _27.label = 71;
                case 71:
                    _o++;
                    return [3 /*break*/, 69];
                case 72:
                    result = ctx.engine.emit('hardwareCall', {
                        callee: expr.callee,
                        args: args,
                    });
                    if (expr.callee === 'shiftIn') {
                        if (typeof result === 'number')
                            return [2 /*return*/, result];
                        ctx.engine.log("\u26A0\uFE0F shiftIn(...) returned no simulated value; defaulting to 0x00");
                        return [2 /*return*/, 0];
                    }
                    // shiftOut is write-only
                    return [2 /*return*/, 0];
                case 73:
                    if (!(expr.callee === 'tone' || expr.callee === 'noTone')) return [3 /*break*/, 80];
                    args = [];
                    _s = 0, _t = expr.args;
                    _27.label = 74;
                case 74:
                    if (!(_s < _t.length)) return [3 /*break*/, 77];
                    a = _t[_s];
                    _v = (_u = args).push;
                    return [4 /*yield*/, evalExpr(a, env, ctx)];
                case 75:
                    _v.apply(_u, [_27.sent()]);
                    _27.label = 76;
                case 76:
                    _s++;
                    return [3 /*break*/, 74];
                case 77:
                    if (!(expr.callee === 'tone')) return [3 /*break*/, 79];
                    ctx.engine.tone(args[0], args[1], args[2]);
                    if (!(args[2] !== undefined && args[2] > 0)) return [3 /*break*/, 79];
                    return [4 /*yield*/, ctx.engine.delay(args[2])];
                case 78:
                    _27.sent();
                    ctx.engine.noTone(args[0]);
                    _27.label = 79;
                case 79:
                    if (expr.callee === 'noTone')
                        ctx.engine.noTone(args[0]);
                    return [2 /*return*/, 0];
                case 80:
                    if (!(expr.callee === 'servo')) return [3 /*break*/, 85];
                    args = [];
                    _w = 0, _x = expr.args;
                    _27.label = 81;
                case 81:
                    if (!(_w < _x.length)) return [3 /*break*/, 84];
                    a = _x[_w];
                    _z = (_y = args).push;
                    return [4 /*yield*/, evalExpr(a, env, ctx)];
                case 82:
                    _z.apply(_y, [_27.sent()]);
                    _27.label = 83;
                case 83:
                    _w++;
                    return [3 /*break*/, 81];
                case 84:
                    pin = args[0];
                    angle = (_23 = args[1]) !== null && _23 !== void 0 ? _23 : 90;
                    ctx.engine.emit('hardwareCall', {
                        callee: 'servo.write',
                        args: [pin, angle],
                    });
                    return [2 /*return*/, 0];
                case 85:
                    if (!(expr.callee === 'map')) return [3 /*break*/, 90];
                    args = [];
                    _0 = 0, _1 = expr.args;
                    _27.label = 86;
                case 86:
                    if (!(_0 < _1.length)) return [3 /*break*/, 89];
                    a = _1[_0];
                    _3 = (_2 = args).push;
                    return [4 /*yield*/, evalExpr(a, env, ctx)];
                case 87:
                    _3.apply(_2, [_27.sent()]);
                    _27.label = 88;
                case 88:
                    _0++;
                    return [3 /*break*/, 86];
                case 89: return [2 /*return*/, ctx.engine.map(args[0], args[1], args[2], args[3], args[4])];
                case 90:
                    if (!(expr.callee === 'constrain')) return [3 /*break*/, 95];
                    args = [];
                    _4 = 0, _5 = expr.args;
                    _27.label = 91;
                case 91:
                    if (!(_4 < _5.length)) return [3 /*break*/, 94];
                    a = _5[_4];
                    _7 = (_6 = args).push;
                    return [4 /*yield*/, evalExpr(a, env, ctx)];
                case 92:
                    _7.apply(_6, [_27.sent()]);
                    _27.label = 93;
                case 93:
                    _4++;
                    return [3 /*break*/, 91];
                case 94: return [2 /*return*/, ctx.engine.constrain(args[0], args[1], args[2])];
                case 95:
                    if (!(expr.callee === 'abs')) return [3 /*break*/, 97];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 96:
                    arg = _27.sent();
                    return [2 /*return*/, Math.abs(Number(arg))];
                case 97:
                    if (!(expr.callee === 'sqrt')) return [3 /*break*/, 99];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 98:
                    arg = _27.sent();
                    return [2 /*return*/, Math.sqrt(Number(arg))];
                case 99:
                    if (!(expr.callee === 'pow')) return [3 /*break*/, 102];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 100:
                    arg0 = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.args[1], env, ctx)];
                case 101:
                    arg1 = _27.sent();
                    return [2 /*return*/, Math.pow(Number(arg0), Number(arg1))];
                case 102:
                    if (!(expr.callee === 'sin')) return [3 /*break*/, 104];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 103:
                    arg = _27.sent();
                    return [2 /*return*/, Math.sin(Number(arg))];
                case 104:
                    if (!(expr.callee === 'cos')) return [3 /*break*/, 106];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 105:
                    arg = _27.sent();
                    return [2 /*return*/, Math.cos(Number(arg))];
                case 106:
                    if (!(expr.callee === 'tan')) return [3 /*break*/, 108];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 107:
                    arg = _27.sent();
                    return [2 /*return*/, Math.tan(Number(arg))];
                case 108:
                    if (!(expr.callee === 'log')) return [3 /*break*/, 110];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 109:
                    arg = _27.sent();
                    return [2 /*return*/, Math.log(Number(arg))];
                case 110:
                    if (!(expr.callee === 'min')) return [3 /*break*/, 113];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 111:
                    arg0 = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.args[1], env, ctx)];
                case 112:
                    arg1 = _27.sent();
                    return [2 /*return*/, Math.min(Number(arg0), Number(arg1))];
                case 113:
                    if (!(expr.callee === 'max')) return [3 /*break*/, 116];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 114:
                    arg0 = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.args[1], env, ctx)];
                case 115:
                    arg1 = _27.sent();
                    return [2 /*return*/, Math.max(Number(arg0), Number(arg1))];
                case 116:
                    if (!(expr.callee === 'round')) return [3 /*break*/, 118];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 117:
                    arg = _27.sent();
                    return [2 /*return*/, Math.round(Number(arg))];
                case 118:
                    if (!(expr.callee === 'floor')) return [3 /*break*/, 120];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 119:
                    arg = _27.sent();
                    return [2 /*return*/, Math.floor(Number(arg))];
                case 120:
                    if (!(expr.callee === 'ceil')) return [3 /*break*/, 122];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 121:
                    arg = _27.sent();
                    return [2 /*return*/, Math.ceil(Number(arg))];
                case 122:
                    if (!(expr.callee === 'isnan')) return [3 /*break*/, 124];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 123:
                    arg = _27.sent();
                    return [2 /*return*/, isNaN(Number(arg)) ? 1 : 0];
                case 124:
                    if (!(expr.callee === 'isinf')) return [3 /*break*/, 126];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 125:
                    arg = _27.sent();
                    return [2 /*return*/, !isFinite(Number(arg)) ? 1 : 0];
                case 126:
                    if (!(expr.callee === 'strlen')) return [3 /*break*/, 128];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 127:
                    s = _27.sent();
                    return [2 /*return*/, String(s !== null && s !== void 0 ? s : '').length];
                case 128:
                    if (!(expr.callee === 'strcmp')) return [3 /*break*/, 131];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 129:
                    a = _27.sent();
                    return [4 /*yield*/, evalExpr(expr.args[1], env, ctx)];
                case 130:
                    b = _27.sent();
                    return [2 /*return*/, String(a) === String(b) ? 0 : 1];
                case 131:
                    if (!(expr.callee === 'atoi')) return [3 /*break*/, 133];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 132:
                    s = _27.sent();
                    return [2 /*return*/, parseInt(String(s), 10) || 0];
                case 133:
                    if (!(expr.callee === 'atof')) return [3 /*break*/, 135];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 134:
                    s = _27.sent();
                    return [2 /*return*/, parseFloat(String(s)) || 0];
                case 135:
                    if (!(expr.callee === 'dtostrf')) return [3 /*break*/, 140];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 136:
                    val = _27.sent();
                    if (!expr.args[2]) return [3 /*break*/, 138];
                    return [4 /*yield*/, evalExpr(expr.args[2], env, ctx)];
                case 137:
                    _8 = _27.sent();
                    return [3 /*break*/, 139];
                case 138:
                    _8 = 2;
                    _27.label = 139;
                case 139:
                    prec = _8;
                    return [2 /*return*/, Number(val).toFixed(Math.max(0, Number(prec) || 0))];
                case 140:
                    if (!(expr.callee === 'int')) return [3 /*break*/, 142];
                    return [4 /*yield*/, evalExpr((_24 = expr.args[0]) !== null && _24 !== void 0 ? _24 : { kind: 'literal', value: 0 }, env, ctx)];
                case 141:
                    v = _27.sent();
                    return [2 /*return*/, Number(v) | 0];
                case 142:
                    if (!(expr.callee === 'float')) return [3 /*break*/, 144];
                    return [4 /*yield*/, evalExpr((_25 = expr.args[0]) !== null && _25 !== void 0 ? _25 : { kind: 'literal', value: 0 }, env, ctx)];
                case 143:
                    v = _27.sent();
                    return [2 /*return*/, Number(v) || 0];
                case 144:
                    if (!(expr.callee === 'String')) return [3 /*break*/, 146];
                    return [4 /*yield*/, evalExpr((_26 = expr.args[0]) !== null && _26 !== void 0 ? _26 : { kind: 'literal', value: '' }, env, ctx)];
                case 145:
                    v = _27.sent();
                    return [2 /*return*/, String(v)];
                case 146:
                    if (!(expr.callee === '__len' || expr.callee === 'len')) return [3 /*break*/, 148];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 147:
                    arr = _27.sent();
                    if (Array.isArray(arr))
                        return [2 /*return*/, arr.length];
                    if (typeof arr === 'string')
                        return [2 /*return*/, arr.length];
                    return [2 /*return*/, 0];
                case 148:
                    if (!(expr.callee === 'reversed')) return [3 /*break*/, 150];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 149:
                    arr = _27.sent();
                    if (Array.isArray(arr))
                        return [2 /*return*/, __spreadArray([], arr, true).reverse()];
                    if (typeof arr === 'string')
                        return [2 /*return*/, arr.split('').reverse().join('')];
                    return [2 /*return*/, arr];
                case 150:
                    if (!(expr.callee === 'format')) return [3 /*break*/, 156];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 151:
                    str = _27.sent();
                    if (typeof str !== 'string')
                        str = String(str);
                    args = [];
                    i = 1;
                    _27.label = 152;
                case 152:
                    if (!(i < expr.args.length)) return [3 /*break*/, 155];
                    _10 = (_9 = args).push;
                    return [4 /*yield*/, evalExpr(expr.args[i], env, ctx)];
                case 153:
                    _10.apply(_9, [_27.sent()]);
                    _27.label = 154;
                case 154:
                    i++;
                    return [3 /*break*/, 152];
                case 155:
                    for (_11 = 0, args_1 = args; _11 < args_1.length; _11++) {
                        arg = args_1[_11];
                        str = str.replace('{}', String(arg));
                    }
                    return [2 /*return*/, str];
                case 156:
                    if (!(expr.callee === 'enumerate')) return [3 /*break*/, 158];
                    return [4 /*yield*/, evalExpr(expr.args[0], env, ctx)];
                case 157:
                    arr = _27.sent();
                    if (Array.isArray(arr)) {
                        return [2 /*return*/, arr.map(function (val, idx) { return [idx, val]; })];
                    }
                    return [2 /*return*/, []];
                case 158:
                    if (!(expr.callee.includes('.') || expr.callee === 'KeypadRead')) return [3 /*break*/, 163];
                    args = [];
                    _12 = 0, _13 = expr.args;
                    _27.label = 159;
                case 159:
                    if (!(_12 < _13.length)) return [3 /*break*/, 162];
                    a = _13[_12];
                    _15 = (_14 = args).push;
                    return [4 /*yield*/, evalExpr(a, env, ctx)];
                case 160:
                    _15.apply(_14, [_27.sent()]);
                    _27.label = 161;
                case 161:
                    _12++;
                    return [3 /*break*/, 159];
                case 162:
                    ctx.engine.emit('hardwareCall', { callee: expr.callee, args: args });
                    return [2 /*return*/, 0];
                case 163:
                    funcDef = ctx.functions.get(expr.callee);
                    if (!funcDef) return [3 /*break*/, 173];
                    callEnv = new Map();
                    i = 0;
                    _27.label = 164;
                case 164:
                    if (!(i < funcDef.params.length)) return [3 /*break*/, 169];
                    if (!expr.args[i]) return [3 /*break*/, 166];
                    return [4 /*yield*/, evalExpr(expr.args[i], env, ctx)];
                case 165:
                    _16 = _27.sent();
                    return [3 /*break*/, 167];
                case 166:
                    _16 = 0;
                    _27.label = 167;
                case 167:
                    val = _16;
                    safeVal = (val && typeof val === 'object')
                        ? JSON.parse(JSON.stringify(val))
                        : val;
                    callEnv.set(funcDef.params[i].name, safeVal);
                    _27.label = 168;
                case 168:
                    i++;
                    return [3 /*break*/, 164];
                case 169:
                    _27.trys.push([169, 171, , 172]);
                    return [4 /*yield*/, executeStatements(funcDef.body, callEnv, ctx)];
                case 170:
                    _27.sent();
                    return [3 /*break*/, 172];
                case 171:
                    e_8 = _27.sent();
                    if (e_8 instanceof ReturnSignal)
                        return [2 /*return*/, e_8.value];
                    throw e_8;
                case 172: return [2 /*return*/, 0];
                case 173:
                    // Unknown function fallback with warning
                    ctx.engine.log("\u26A0\uFE0F Unknown function '".concat(expr.callee, "' in ASLExecutor; returning 0"));
                    return [2 /*return*/, 0];
                case 174:
                    arr = [];
                    _17 = 0, _18 = expr.elements;
                    _27.label = 175;
                case 175:
                    if (!(_17 < _18.length)) return [3 /*break*/, 178];
                    el = _18[_17];
                    _20 = (_19 = arr).push;
                    return [4 /*yield*/, evalExpr(el, env, ctx)];
                case 176:
                    _20.apply(_19, [_27.sent()]);
                    _27.label = 177;
                case 177:
                    _17++;
                    return [3 /*break*/, 175];
                case 178: return [2 /*return*/, arr];
                case 179: return [4 /*yield*/, evalExpr(expr.condition, env, ctx)];
                case 180:
                    cond = _27.sent();
                    return [2 /*return*/, cond ? evalExpr(expr.whenTrue, env, ctx) : evalExpr(expr.whenFalse, env, ctx)];
                case 181:
                    obj = {};
                    _21 = 0, _22 = expr.properties;
                    _27.label = 182;
                case 182:
                    if (!(_21 < _22.length)) return [3 /*break*/, 186];
                    prop = _22[_21];
                    return [4 /*yield*/, evalExpr(prop.key, env, ctx)];
                case 183:
                    k = _27.sent();
                    return [4 /*yield*/, evalExpr(prop.value, env, ctx)];
                case 184:
                    v = _27.sent();
                    obj[k] = v;
                    _27.label = 185;
                case 185:
                    _21++;
                    return [3 /*break*/, 182];
                case 186: return [2 /*return*/, obj];
                case 187: return [2 /*return*/];
            }
        });
    });
}
