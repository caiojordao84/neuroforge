"use strict";
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
var PythonParser_1 = require("./src/engine/asl/plugins/python/PythonParser");
var ASLExecutor_1 = require("./src/engine/asl/ASLExecutor");
var SimulationEngine_1 = require("./src/engine/SimulationEngine");
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var parser, code, _a, ast, errors, engine, outputs, executor, start, end;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    parser = new PythonParser_1.PythonParser();
                    return [4 /*yield*/, parser.init()];
                case 1:
                    _b.sent();
                    code = "\nimport time\n\nprint(\"Start\")\ntime.sleep_us(10000)\na = millis()\nb = micros()\nprint(\"Millis:\", a)\nprint(\"Micros:\", b)\n";
                    _a = parser.parse(code), ast = _a.ast, errors = _a.errors;
                    if (errors.length > 0) {
                        console.error("Errors:", errors);
                        return [2 /*return*/];
                    }
                    engine = new SimulationEngine_1.SimulationEngine();
                    outputs = [];
                    engine.serialPrint = function (x) { return outputs.push(x); };
                    executor = new ASLExecutor_1.ASLExecutor(engine, 100);
                    start = Date.now();
                    return [4 /*yield*/, executor.execute(ast)];
                case 2:
                    _b.sent();
                    end = Date.now();
                    console.log("Time elapsed:", end - start);
                    console.log("Outputs:", outputs);
                    return [2 /*return*/];
            }
        });
    });
}
run();
