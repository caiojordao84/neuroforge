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
exports.PythonParser = void 0;
// src/engine/asl/plugins/python/PythonParser.ts
var TreeSitterLoader_1 = require("../../TreeSitterLoader");
// ---------------------------------------------------------------------------
// PythonParser — uses tree-sitter when available, falls back to regex parser
// ---------------------------------------------------------------------------
var PythonParser = /** @class */ (function () {
    function PythonParser() {
        this.parser = null;
        this.ready = false;
    }
    PythonParser.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.ready)
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        _a = this;
                        return [4 /*yield*/, TreeSitterLoader_1.TreeSitterLoader.createParser('python')];
                    case 2:
                        _a.parser = _b.sent();
                        this.ready = true;
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _b.sent();
                        console.warn('[PythonParser] tree-sitter WASM unavailable, will use regex fallback:', e_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    PythonParser.prototype.parse = function (code) {
        if (this.ready && this.parser) {
            return this._parseWithTreeSitter(code);
        }
        return this._parseWithRegex(code);
    };
    PythonParser.prototype._parseWithTreeSitter = function (code) {
        var tree = this.parser.parse(code);
        try {
            var converter = new PythonCstToAst();
            var ast = converter.convert(tree.rootNode);
            var errors_1 = [];
            var findErrors_1 = function (n) {
                if (!n)
                    return;
                var isMissing = typeof n.isMissing === 'function' ? n.isMissing() : !!n.isMissing;
                if (n.type === 'ERROR' || isMissing) {
                    var row = n.startPosition ? n.startPosition.row + 1 : '?';
                    errors_1.push({ severity: 'CRITICAL', message: "Syntax error at line ".concat(row, ": ").concat(n.text || '') });
                }
                if (n.children && Array.isArray(n.children))
                    n.children.forEach(findErrors_1);
            };
            findErrors_1(tree.rootNode);
            return { ast: ast, errors: errors_1 };
        }
        finally {
            tree.delete();
        }
    };
    PythonParser.prototype._parseWithRegex = function (code) {
        var fallback = new RegexPythonParser();
        var ast = fallback.parse(code);
        return { ast: ast, errors: [] };
    };
    return PythonParser;
}());
exports.PythonParser = PythonParser;
// ---------------------------------------------------------------------------
// RegexPythonParser
// ---------------------------------------------------------------------------
var RegexPythonParser = /** @class */ (function () {
    function RegexPythonParser() {
        this.lines = [];
        this.pos = 0;
    }
    RegexPythonParser.prototype.parse = function (source) {
        var _this = this;
        var _a, _b, _c, _d, _e;
        this.lines = source.split('\n');
        this.pos = 0;
        var rootNodes = [];
        var setupNodes = [];
        var loopNodes = [];
        var pendingComments = [];
        var stack = [];
        var getActiveChildren = function () {
            if (stack.length > 0)
                return stack[stack.length - 1].node.children;
            return setupNodes;
        };
        var _loop_1 = function () {
            var raw = this_1.lines[this_1.pos];
            var line = raw.trimEnd();
            var trimmed = line.trim();
            var indent = line.length - line.trimStart().length;
            if (!trimmed) {
                this_1.pos++;
                return "continue";
            }
            // ── do-while hint via comment: # do-while: <cond> ─────────────────
            if (trimmed.startsWith('# do-while:')) {
                var doCondStr = trimmed.replace(/^#\s*do-while:\s*/, '').trim();
                var nextLine = (_a = this_1.lines[this_1.pos + 1]) === null || _a === void 0 ? void 0 : _a.trim();
                if (nextLine && /^while\s+(True|1)\s*:/.test(nextLine)) {
                    var doWhileCond = this_1._parseExpr(doCondStr, this_1.pos + 1);
                    var doNode = {
                        nodeType: 'DoWhileLoop', id: "dw-".concat(this_1.pos), attributes: {},
                        children: [doWhileCond]
                    };
                    getActiveChildren().push(doNode);
                    this_1.pos++; // skip the while True: line
                    var whileIndent = ((_c = (_b = this_1.lines[this_1.pos]) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) - ((_e = (_d = this_1.lines[this_1.pos]) === null || _d === void 0 ? void 0 : _d.trimStart().length) !== null && _e !== void 0 ? _e : 0);
                    stack.push({ node: doNode, indent: whileIndent, type: 'dowhile' });
                    this_1.pos++;
                    return "continue";
                }
                pendingComments.push(trimmed);
                this_1.pos++;
                return "continue";
            }
            if (trimmed.startsWith('#')) {
                pendingComments.push(trimmed);
                this_1.pos++;
                return "continue";
            }
            while (stack.length > 0 && indent <= stack[stack.length - 1].indent)
                stack.pop();
            if (/^(import|from)\s/.test(trimmed)) {
                this_1.pos++;
                return "continue";
            }
            // ── Enum or Struct class ──────────────────────────────────────────
            var classM = trimmed.match(/^class\s+(\w+)\s*(?:\([^)]*\))?\s*:/);
            if (classM) {
                var className = classM[1];
                var members = [];
                var fields = [];
                var j = this_1.pos + 1;
                while (j < this_1.lines.length) {
                    var cl = this_1.lines[j].trim();
                    if (!cl || cl.startsWith('#')) {
                        j++;
                        continue;
                    }
                    var memberM = cl.match(/^(\w+)\s*=\s*(\d+)\s*$/);
                    if (memberM) {
                        members.push({ name: memberM[1], value: parseInt(memberM[2]) });
                        j++;
                        continue;
                    }
                    var fieldAnnotM = cl.match(/^(\w+)\s*:\s*(\w+)/);
                    if (fieldAnnotM) {
                        fields.push({ name: fieldAnnotM[1], type: fieldAnnotM[2] });
                        j++;
                        continue;
                    }
                    var selfFieldM = cl.match(/^self\.(\w+)\s*=\s*(.+)$/);
                    if (selfFieldM) {
                        fields.push({ name: selfFieldM[1], type: 'auto' });
                        j++;
                        continue;
                    }
                    break;
                }
                var isEnum = members.length > 0 && fields.length === 0;
                var structNode = {
                    nodeType: isEnum ? 'EnumDeclaration' : 'StructDeclaration',
                    id: "".concat(isEnum ? 'enum' : 'struct', "-").concat(this_1.pos),
                    attributes: isEnum ? { name: className, members: members } : { name: className, fields: fields },
                    children: [],
                    metadata: { line: this_1.pos + 1 }
                };
                getActiveChildren().push(structNode);
                this_1.pos = j;
                return "continue";
            }
            // ── while <any condition>: ────────────────────────────────────────
            var whileM = trimmed.match(/^while\s+(.+?)\s*:/);
            if (whileM) {
                var condStr = whileM[1].trim();
                var isInfinite = condStr === 'True' || condStr === '1';
                var condNode = isInfinite
                    ? { nodeType: 'Literal', id: "lit-true-".concat(this_1.pos), attributes: { value: 1 }, children: [] }
                    : this_1._parseExpr(condStr, this_1.pos + 1);
                var whileNode = {
                    nodeType: 'WhileLoop', id: "while-".concat(this_1.pos),
                    attributes: { isInfinite: isInfinite },
                    children: [condNode]
                };
                if (stack.length === 0 && isInfinite)
                    loopNodes.push(whileNode);
                else if (stack.length === 0)
                    setupNodes.push(whileNode);
                else
                    getActiveChildren().push(whileNode);
                stack.push({ node: whileNode, indent: indent, type: 'while' });
                this_1.pos++;
                return "continue";
            }
            var forM = trimmed.match(/^for\s+(\w+)\s+in\s+([^:]+):/);
            if (forM) {
                var varName = forM[1];
                var iterableStr = forM[2].trim();
                if (iterableStr.startsWith('range(')) {
                    var forNode = { nodeType: 'ForLoop', id: "for-".concat(this_1.pos), attributes: { hasInit: true, hasUpdate: true }, children: [] };
                    var argStr = iterableStr.substring(6, iterableStr.length - 1);
                    var args = argStr.split(',').map(function (s) { return s.trim(); });
                    var start = 0, stop_1 = 10;
                    if (args.length === 1)
                        stop_1 = parseInt(args[0]) || 0;
                    else if (args.length >= 2) {
                        start = parseInt(args[0]) || 0;
                        stop_1 = parseInt(args[1]) || 0;
                    }
                    forNode.children.push({ nodeType: 'VariableDeclaration', id: "init-".concat(this_1.pos), attributes: { name: varName, type: 'int' }, children: [{ nodeType: 'Literal', id: "l0-".concat(this_1.pos), attributes: { value: start }, children: [] }] }, { nodeType: 'BinaryExpression', id: "cond-".concat(this_1.pos), attributes: { operator: '<' }, children: [{ nodeType: 'Identifier', id: "id-".concat(this_1.pos), attributes: { name: varName }, children: [] }, { nodeType: 'Literal', id: "l1-".concat(this_1.pos), attributes: { value: stop_1 }, children: [] }] }, { nodeType: 'UnaryExpression', id: "upd-".concat(this_1.pos), attributes: { operator: '++', prefix: false }, children: [{ nodeType: 'Identifier', id: "id-u-".concat(this_1.pos), attributes: { name: varName }, children: [] }] });
                    getActiveChildren().push(forNode);
                    stack.push({ node: forNode, indent: indent, type: 'for' });
                }
                else {
                    var forNode_1 = { nodeType: 'ForLoop', id: "for-".concat(this_1.pos), attributes: { hasInit: true, hasUpdate: true }, children: [] };
                    var target = iterableStr;
                    var isReversed = false;
                    if (iterableStr.startsWith('reversed(')) {
                        target = iterableStr.substring(9, iterableStr.length - 1);
                        isReversed = true;
                    }
                    var indexVar = "__i_".concat(this_1.pos);
                    var lenExpr = { nodeType: 'CallExpression', id: "len-".concat(this_1.pos), attributes: { callee: 'len' }, children: [{ nodeType: 'Identifier', id: "target-".concat(this_1.pos), attributes: { name: target }, children: [] }] };
                    if (!isReversed) {
                        forNode_1.children.push({ nodeType: 'VariableDeclaration', id: "init-".concat(this_1.pos), attributes: { name: indexVar, type: 'int' }, children: [{ nodeType: 'Literal', id: "l0-".concat(this_1.pos), attributes: { value: 0 }, children: [] }] }, { nodeType: 'BinaryExpression', id: "cond-".concat(this_1.pos), attributes: { operator: '<' }, children: [{ nodeType: 'Identifier', id: "id-".concat(this_1.pos), attributes: { name: indexVar }, children: [] }, lenExpr] }, { nodeType: 'UnaryExpression', id: "upd-".concat(this_1.pos), attributes: { operator: '++', prefix: false }, children: [{ nodeType: 'Identifier', id: "id-u-".concat(this_1.pos), attributes: { name: indexVar }, children: [] }] });
                    }
                    else {
                        forNode_1.children.push({ nodeType: 'VariableDeclaration', id: "init-".concat(this_1.pos), attributes: { name: indexVar, type: 'int' }, children: [{ nodeType: 'BinaryExpression', id: "s-".concat(this_1.pos), attributes: { operator: '-' }, children: [lenExpr, { nodeType: 'Literal', id: "lit1-".concat(this_1.pos), attributes: { value: 1 }, children: [] }] }] }, { nodeType: 'BinaryExpression', id: "cond-".concat(this_1.pos), attributes: { operator: '>=' }, children: [{ nodeType: 'Identifier', id: "id-".concat(this_1.pos), attributes: { name: indexVar }, children: [] }, { nodeType: 'Literal', id: "l0-".concat(this_1.pos), attributes: { value: 0 }, children: [] }] }, { nodeType: 'UnaryExpression', id: "upd-".concat(this_1.pos), attributes: { operator: '--', prefix: false }, children: [{ nodeType: 'Identifier', id: "id-u-".concat(this_1.pos), attributes: { name: indexVar }, children: [] }] });
                    }
                    if (varName.includes(',')) {
                        var vars = varName.split(',').map(function (v) { return v.trim(); });
                        var tmpVar_1 = "__val_".concat(this_1.pos);
                        forNode_1.children.push({ nodeType: 'VariableDeclaration', id: "map-tmp-".concat(this_1.pos), attributes: { name: tmpVar_1, type: 'auto' }, children: [{ nodeType: 'SubscriptExpression', id: "sub-".concat(this_1.pos), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-t-".concat(this_1.pos), attributes: { name: target }, children: [] }, { nodeType: 'Identifier', id: "id-ix-".concat(this_1.pos), attributes: { name: indexVar }, children: [] }] }] });
                        vars.forEach(function (v, idx) { forNode_1.children.push({ nodeType: 'ExpressionStatement', id: "map-".concat(_this.pos, "-").concat(idx), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "map-ass-".concat(_this.pos, "-").concat(idx), attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: "id-v-".concat(_this.pos, "-").concat(idx), attributes: { name: v }, children: [] }, { nodeType: 'SubscriptExpression', id: "sub-v-".concat(_this.pos, "-").concat(idx), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-tmp-".concat(_this.pos, "-").concat(idx), attributes: { name: tmpVar_1 }, children: [] }, { nodeType: 'Literal', id: "lit-ix-".concat(_this.pos, "-").concat(idx), attributes: { value: idx }, children: [] }] }] }] }); });
                    }
                    else {
                        forNode_1.children.push({ nodeType: 'ExpressionStatement', id: "map-".concat(this_1.pos), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "map-ass-".concat(this_1.pos), attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: "id-v-".concat(this_1.pos), attributes: { name: varName }, children: [] }, { nodeType: 'SubscriptExpression', id: "sub-".concat(this_1.pos), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-t-".concat(this_1.pos), attributes: { name: target }, children: [] }, { nodeType: 'Identifier', id: "id-ix-".concat(this_1.pos), attributes: { name: indexVar }, children: [] }] }] }] });
                    }
                    getActiveChildren().push(forNode_1);
                    stack.push({ node: forNode_1, indent: indent, type: 'for' });
                }
                this_1.pos++;
                return "continue";
            }
            var matchM = trimmed.match(/^match\s+(.+)\s*:/);
            if (matchM) {
                var subject = this_1._parseExpr(matchM[1].trim(), this_1.pos + 1);
                var matchNode = { nodeType: 'SwitchStatement', id: "sw-".concat(this_1.pos), attributes: {}, children: [subject] };
                getActiveChildren().push(matchNode);
                stack.push({ node: matchNode, indent: indent, type: 'match' });
                this_1.pos++;
                return "continue";
            }
            if (stack.length > 0 && stack[stack.length - 1].type === 'match') {
                var caseM = trimmed.match(/^case\s+(.+)\s*:/);
                if (caseM) {
                    var pattern = caseM[1].trim();
                    var isDefault = pattern === '_';
                    var caseNode = { nodeType: 'CaseClause', id: "case-".concat(this_1.pos), attributes: { isDefault: isDefault }, children: [] };
                    if (!isDefault)
                        caseNode.children.push(this_1._parseExpr(pattern, this_1.pos + 1));
                    stack[stack.length - 1].node.children.push(caseNode);
                    stack.push({ node: caseNode, indent: indent, type: 'case' });
                    this_1.pos++;
                    return "continue";
                }
            }
            var node = this_1._parseLine(trimmed, this_1.pos + 1);
            if (node) {
                if (pendingComments.length > 0) {
                    node.leadingComments = __spreadArray([], pendingComments, true);
                    pendingComments = [];
                }
                getActiveChildren().push(node);
                if (node.nodeType === 'VariableDeclaration' && stack.length === 0)
                    rootNodes.push(node);
            }
            this_1.pos++;
        };
        var this_1 = this;
        while (this.pos < this.lines.length) {
            _loop_1();
        }
        var addBreaks = function (nodes) {
            nodes.forEach(function (n) {
                if (n.nodeType === 'SwitchStatement') {
                    n.children.slice(1).forEach(function (c) {
                        if (c.nodeType === 'CaseClause')
                            c.children.push({ nodeType: 'BreakStatement', id: "brk-post-".concat(c.id), attributes: {}, children: [] });
                    });
                }
            });
        };
        addBreaks(setupNodes);
        addBreaks(loopNodes);
        return {
            nodeType: 'Program', id: 'root', attributes: {},
            children: __spreadArray(__spreadArray([], rootNodes, true), [
                { nodeType: 'Function', id: 'setup', attributes: { name: 'setup', returnType: 'void' }, children: setupNodes },
                { nodeType: 'Function', id: 'loop', attributes: { name: 'loop', returnType: 'void' }, children: loopNodes },
            ], false),
        };
    };
    RegexPythonParser.prototype._parseLine = function (trimmed, lineNum) {
        var _this = this;
        var meta = { line: lineNum };
        if (/^(import|from)\s/.test(trimmed))
            return null;
        // ── print(...) ──────────────────────────────────────────────────────
        var printM = trimmed.match(/^print\s*\((.+)\)\s*$/);
        if (printM)
            return { nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Print', id: "print-".concat(lineNum), attributes: { newline: true }, children: [this._parseExpr(printM[1].trim(), lineNum)] }], metadata: meta };
        // ── time.sleep_ms / sleep_ms ─────────────────────────────────────────
        var sleepMsM = trimmed.match(/^(?:time\.)?sleep_ms\s*\((.+)\)\s*$/);
        if (sleepMsM)
            return { nodeType: 'DelayMs', id: "delay-".concat(lineNum), attributes: {}, children: [this._parseExpr(sleepMsM[1].trim(), lineNum)], metadata: meta };
        var sleepM = trimmed.match(/^(?:time\.)?sleep\s*\((.+)\)\s*$/);
        if (sleepM) {
            var arg = this._parseExpr(sleepM[1].trim(), lineNum);
            var msArg = arg.nodeType === 'Literal' ? { nodeType: 'Literal', id: "ms-".concat(lineNum), attributes: { value: arg.attributes.value * 1000 }, children: [] } : { nodeType: 'Literal', id: "ms-".concat(lineNum), attributes: { value: 1000 }, children: [] };
            return { nodeType: 'DelayMs', id: "delay-".concat(lineNum), attributes: {}, children: [msArg], metadata: meta };
        }
        var utimeSleepM = trimmed.match(/^utime\.sleep(?:_ms)?\s*\((.+)\)\s*$/);
        if (utimeSleepM)
            return { nodeType: 'DelayMs', id: "delay-".concat(lineNum), attributes: {}, children: [this._parseExpr(utimeSleepM[1].trim(), lineNum)], metadata: meta };
        // ── time.sleep_us / utime.sleep_us ─────────────────────────────────────
        var sleepUsM = trimmed.match(/^(?:time\.)?sleep_us\s*\((.+)\)\s*$/);
        if (sleepUsM) {
            var usVal = this._parseExpr(sleepUsM[1].trim(), lineNum);
            return { nodeType: 'CallExpression', id: "delayus-".concat(lineNum), attributes: { callee: 'delayMicroseconds' }, children: [usVal], metadata: meta };
        }
        var utimeSleepUsM = trimmed.match(/^utime\.sleep_us\s*\((.+)\)\s*$/);
        if (utimeSleepUsM) {
            var usVal = this._parseExpr(utimeSleepUsM[1].trim(), lineNum);
            return { nodeType: 'CallExpression', id: "delayus-".concat(lineNum), attributes: { callee: 'delayMicroseconds' }, children: [usVal], metadata: meta };
        }
        // ── millis() / micros() ──────────────────────────────────────────────
        if (/^(?:time|utime)\.ticks_ms\(\)/.test(trimmed))
            return { nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {}, children: [{ nodeType: 'CallExpression', id: "ms-".concat(lineNum), attributes: { callee: 'millis' }, children: [] }], metadata: meta };
        if (/^(?:time|utime)\.ticks_us\(\)/.test(trimmed))
            return { nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {}, children: [{ nodeType: 'CallExpression', id: "us-".concat(lineNum), attributes: { callee: 'micros' }, children: [] }], metadata: meta };
        // ── GpioRead: var = pin.value() ──────────────────────────────────────
        var pinReadM = trimmed.match(/^(\w+)\s*=\s*(\w+)\.value\(\)\s*$/);
        if (pinReadM)
            return { nodeType: 'VariableDeclaration', id: "decl-".concat(lineNum), attributes: { name: pinReadM[1], type: 'auto' }, children: [{ nodeType: 'GpioRead', id: "gr-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: pinReadM[2] }, children: [] }] }], metadata: meta };
        // ── random.randint / randrange ───────────────────────────────────────
        var randAssignM = trimmed.match(/^(\w+)\s*=\s*random\.rand(?:int|range)\s*\(([^)]+)\)\s*$/);
        if (randAssignM) {
            var args = randAssignM[2].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return { nodeType: 'VariableDeclaration', id: "decl-".concat(lineNum), attributes: { name: randAssignM[1], type: 'auto' }, children: [{ nodeType: 'CallExpression', id: "rnd-".concat(lineNum), attributes: { callee: 'random' }, children: args }], metadata: meta };
        }
        // ── Serial.available stub ─────────────────────────────────────────────
        if (/^(?:\w+\.any\(\)|Serial\.available\(\))/.test(trimmed))
            return { nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {}, children: [{ nodeType: 'CallExpression', id: "sa-".concat(lineNum), attributes: { callee: 'Serial.available' }, children: [] }], metadata: meta };
        // ── Serial.readString stub ────────────────────────────────────────────
        var serialReadM = trimmed.match(/^(\w+)\s*=\s*(?:\w+\.read\(\)|Serial\.readString\(\))\s*$/);
        if (serialReadM)
            return { nodeType: 'VariableDeclaration', id: "decl-".concat(lineNum), attributes: { name: serialReadM[1], type: 'auto' }, children: [{ nodeType: 'CallExpression', id: "sr-".concat(lineNum), attributes: { callee: 'Serial.readString' }, children: [] }], metadata: meta };
        var serialBeginM = trimmed.match(/^(?:#\s*)?Serial\.begin\s*\((.+)\)\s*$/);
        if (serialBeginM)
            return { nodeType: 'ExpressionStatement', id: "serial-".concat(lineNum), attributes: {}, children: [{ nodeType: 'CallExpression', id: "call-".concat(lineNum), attributes: { callee: 'Serial.begin' }, children: [this._parseExpr(serialBeginM[1].trim(), lineNum)] }], metadata: meta };
        var chainedPinM = trimmed.match(/^(?:machine\.)?Pin\s*\(([^)]+)\)\.value\(([^)]+)\)\s*$/);
        if (chainedPinM) {
            var pinArgs = chainedPinM[1].split(',').map(function (s) { return s.trim(); });
            return { nodeType: 'GpioSet', id: "pinval-".concat(lineNum), attributes: {}, children: [this._parseExpr(pinArgs[0], lineNum), this._parseExpr(chainedPinM[2].trim(), lineNum)], metadata: meta };
        }
        var standalonePinM = trimmed.match(/^(?:machine\.)?Pin\s*\(([^)]+)\)\s*$/);
        if (standalonePinM) {
            var args = standalonePinM[1].split(',').map(function (s) { return s.trim(); });
            var pinNum = this._parseExpr(args[0], lineNum);
            var mode = /IN/.test(args[1] || 'Pin.OUT') ? 0 : 1;
            return { nodeType: 'ExpressionStatement', id: "pin-stmt-".concat(lineNum), attributes: {}, children: [{ nodeType: 'CallExpression', id: "pin-call-".concat(lineNum), attributes: { callee: 'Pin' }, children: [pinNum, { nodeType: 'Literal', id: "mode-".concat(lineNum), attributes: { value: mode }, children: [] }] }], metadata: meta };
        }
        var pinOnM = trimmed.match(/^(\w+)\.on\(\)\s*$/);
        if (pinOnM)
            return { nodeType: 'GpioSet', id: "on-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: pinOnM[1] }, children: [] }, { nodeType: 'Literal', id: "l1-".concat(lineNum), attributes: { value: 1 }, children: [] }], metadata: meta };
        var pinOffM = trimmed.match(/^(\w+)\.off\(\)\s*$/);
        if (pinOffM)
            return { nodeType: 'GpioSet', id: "off-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: pinOffM[1] }, children: [] }, { nodeType: 'Literal', id: "l0-".concat(lineNum), attributes: { value: 0 }, children: [] }], metadata: meta };
        var pinValSetM = trimmed.match(/^(\w+)\.value\(([^)]+)\)\s*$/);
        if (pinValSetM)
            return { nodeType: 'GpioSet', id: "pinval-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: pinValSetM[1] }, children: [] }, this._parseExpr(pinValSetM[2].trim(), lineNum)], metadata: meta };
        var adcReadM = trimmed.match(/^(\w+)\.read(?:_u16)?\(\)\s*$/);
        if (adcReadM)
            return { nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {}, children: [{ nodeType: 'AnalogRead', id: "adc-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: adcReadM[1] }, children: [] }] }], metadata: meta };
        var cpDioM = trimmed.match(/^(\w+)\.value\s*=\s*(.+)\s*$/);
        if (cpDioM)
            return { nodeType: 'GpioSet', id: "pinval-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: cpDioM[1] }, children: [] }, this._parseBoolExpr(cpDioM[2].trim(), lineNum)], metadata: meta };
        var pinAssignM = trimmed.match(/^(\w+)\s*=\s*(?:machine\.)?Pin\s*\(([^)]+)\)\s*$/);
        if (pinAssignM) {
            var args = pinAssignM[2].split(',').map(function (s) { return s.trim(); });
            var pinNum = this._parseExpr(args[0], lineNum);
            var mode = /IN/.test(args[1] || 'Pin.OUT') ? 0 : 1;
            return { nodeType: 'VariableDeclaration', id: "decl-".concat(lineNum), attributes: { name: pinAssignM[1], type: 'auto' }, children: [{ nodeType: 'CallExpression', id: "pin-".concat(lineNum), attributes: { callee: 'Pin' }, children: [pinNum, { nodeType: 'Literal', id: "mode-".concat(lineNum), attributes: { value: mode }, children: [] }] }], metadata: meta };
        }
        var cpPinAssignM = trimmed.match(/^(\w+)\s*=\s*digitalio\.DigitalInOut\s*\(([^)]+)\)\s*$/);
        if (cpPinAssignM) {
            var pinNumMatch = cpPinAssignM[2].match(/\d+/);
            var pinNum = { nodeType: 'Literal', id: "pin-".concat(lineNum), attributes: { value: pinNumMatch ? parseInt(pinNumMatch[0]) : 0 }, children: [] };
            return { nodeType: 'VariableDeclaration', id: "decl-".concat(lineNum), attributes: { name: cpPinAssignM[1], type: 'auto' }, children: [{ nodeType: 'CallExpression', id: "pin-".concat(lineNum), attributes: { callee: 'Pin' }, children: [pinNum, { nodeType: 'Literal', id: "mode-".concat(lineNum), attributes: { value: 1 }, children: [] }] }], metadata: meta };
        }
        var cpDirM = trimmed.match(/^(\w+)\.direction\s*=\s*digitalio\.Direction\.(OUTPUT|INPUT)\s*$/);
        if (cpDirM) {
            var mode = cpDirM[2] === 'OUTPUT' ? 1 : 0;
            return { nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {}, children: [{ nodeType: 'CallExpression', id: "mode-".concat(lineNum), attributes: { callee: 'pinMode' }, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: cpDirM[1] }, children: [] }, { nodeType: 'Literal', id: "modelit-".concat(lineNum), attributes: { value: mode }, children: [] }] }], metadata: meta };
        }
        var returnM = trimmed.match(/^return\s*(.*)$/);
        if (returnM) {
            var val = returnM[1].trim();
            var child = val ? this._parseExpr(val, lineNum) : null;
            return { nodeType: 'ReturnStatement', id: "ret-".concat(lineNum), attributes: {}, children: child ? [child] : [], metadata: meta };
        }
        if (trimmed === 'break')
            return { nodeType: 'BreakStatement', id: "brk-".concat(lineNum), attributes: {}, children: [], metadata: meta };
        if (trimmed === 'continue')
            return { nodeType: 'ContinueStatement', id: "cont-".concat(lineNum), attributes: {}, children: [], metadata: meta };
        // ── Augmented assignment: var += expr ────────────────────────────────
        var augM = trimmed.match(/^(\w+)\s*(\+=|-=|\*=|\/=|%=|&=|\|=|\^=)\s*(.+)$/);
        if (augM) {
            var simpleOp = augM[2].replace('=', '');
            var left = { nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: augM[1] }, children: [] };
            var right = this._parseExpr(augM[3].trim(), lineNum);
            return {
                nodeType: 'ExpressionStatement', id: "aug-".concat(lineNum), attributes: {},
                children: [{ nodeType: 'BinaryExpression', id: "op-".concat(lineNum), attributes: { operator: '=' }, children: [left, { nodeType: 'BinaryExpression', id: "aug-inner-".concat(lineNum), attributes: { operator: simpleOp }, children: [left, right] }] }],
                metadata: meta
            };
        }
        // ── LCD (MicroPython I2C LCD) ─────────────────────────────────────────
        //   lcd.move_to(col, row)  lcd.putstr("txt")  lcd.clear()  etc.
        var lcdM = trimmed.match(/^(\w+)\.(move_to|putstr|clear|backlight_on|backlight_off|hide_cursor|show_cursor|blink_cursor_on|blink_cursor_off)\s*\(([^)]*)\)\s*$/);
        if (lcdM) {
            var args = lcdM[3] ? lcdM[3].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); }) : [];
            return {
                nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {},
                children: [{
                        nodeType: 'CallExpression', id: "lcd-".concat(lineNum),
                        attributes: { callee: "lcd.".concat(lcdM[2]) }, children: args
                    }],
                metadata: meta
            };
        }
        // ── OLED SSD1306 (MicroPython framebuf) ───────────────────────────────
        //   oled.fill(c)  oled.text("hi",x,y)  oled.show()  oled.fill_rect(x,y,w,h,c) etc.
        var oledM = trimmed.match(/^(\w+)\.(fill|text|show|fill_rect|pixel|hline|vline|line|rect|scroll|invert|contrast|poweroff|poweron)\s*\(([^)]*)\)\s*$/);
        if (oledM) {
            var args = oledM[3] ? oledM[3].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); }) : [];
            return {
                nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {},
                children: [{
                        nodeType: 'CallExpression', id: "oled-".concat(lineNum),
                        attributes: { callee: "oled.".concat(oledM[2]) }, children: args
                    }],
                metadata: meta
            };
        }
        // ── attachInterrupt: pin.irq(handler=cb, trigger=Pin.IRQ_RISING) ──────
        var irqM = trimmed.match(/^(\w+)\.irq\s*\((.+)\)\s*$/);
        if (irqM) {
            var handlerM = irqM[2].match(/handler\s*=\s*(\w+)/);
            var triggerM = irqM[2].match(/trigger\s*=\s*(.+?)(?:,|$)/);
            var handlerNode = handlerM
                ? { nodeType: 'Identifier', id: "cb-".concat(lineNum), attributes: { name: handlerM[1] }, children: [] }
                : { nodeType: 'Literal', id: "cb-".concat(lineNum), attributes: { value: 0 }, children: [] };
            var triggerNode = triggerM
                ? this._parseExpr(triggerM[1].trim(), lineNum)
                : { nodeType: 'Literal', id: "trig-".concat(lineNum), attributes: { value: 1 }, children: [] };
            return {
                nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {},
                children: [{
                        nodeType: 'CallExpression', id: "irq-".concat(lineNum),
                        attributes: { callee: 'attachInterrupt' },
                        children: [
                            { nodeType: 'Identifier', id: "pin-".concat(lineNum), attributes: { name: irqM[1] }, children: [] },
                            handlerNode,
                            triggerNode
                        ]
                    }],
                metadata: meta
            };
        }
        // ── pulseIn: machine.time_pulse_us(pin, level, timeout) ───────────────
        var pulseM = trimmed.match(/^(?:machine\.)?time_pulse_us\s*\(([^)]+)\)\s*$/);
        if (pulseM) {
            var args = pulseM[1].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return {
                nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {},
                children: [{
                        nodeType: 'CallExpression', id: "pulse-".concat(lineNum),
                        attributes: { callee: 'pulseIn' }, children: args
                    }],
                metadata: meta
            };
        }
        // ── pulseIn assign: var = machine.time_pulse_us(...) ─────────────────
        var pulseAssignM = trimmed.match(/^(\w+)\s*=\s*(?:machine\.)?time_pulse_us\s*\(([^)]+)\)\s*$/);
        if (pulseAssignM) {
            var args = pulseAssignM[2].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return {
                nodeType: 'VariableDeclaration', id: "decl-".concat(lineNum), attributes: { name: pulseAssignM[1], type: 'auto' },
                children: [{
                        nodeType: 'CallExpression', id: "pulse-".concat(lineNum),
                        attributes: { callee: 'pulseIn' }, children: args
                    }],
                metadata: meta
            };
        }
        // ── shiftOut stub ─────────────────────────────────────────────────────
        var shiftOutM = trimmed.match(/^shiftOut\s*\(([^)]*)\)\s*$/);
        if (shiftOutM) {
            var args = shiftOutM[1].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return {
                nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {},
                children: [{
                        nodeType: 'CallExpression', id: "shift-".concat(lineNum),
                        attributes: { callee: 'shiftOut' }, children: args
                    }],
                metadata: meta
            };
        }
        // ── shiftIn assign stub ───────────────────────────────────────────────
        var shiftInM = trimmed.match(/^(\w+)\s*=\s*shiftIn\s*\(([^)]*)\)\s*$/);
        if (shiftInM) {
            var args = shiftInM[2].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return {
                nodeType: 'VariableDeclaration', id: "decl-".concat(lineNum), attributes: { name: shiftInM[1], type: 'auto' },
                children: [{
                        nodeType: 'CallExpression', id: "shift-".concat(lineNum),
                        attributes: { callee: 'shiftIn' }, children: args
                    }],
                metadata: meta
            };
        }
        // ── tone() ────────────────────────────────────────────────────────────
        var toneM = trimmed.match(/^tone\s*\(([^)]+)\)\s*$/);
        if (toneM) {
            var args = toneM[1].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return {
                nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {},
                children: [{
                        nodeType: 'CallExpression', id: "tone-".concat(lineNum),
                        attributes: { callee: 'tone' }, children: args
                    }],
                metadata: meta
            };
        }
        // ── Wire / I2C / SPI hardwareCall ─────────────────────────────────────
        var hwM = trimmed.match(/^(Wire|SPI)\.(\w+)\s*\(([^)]*)\)\s*$/);
        if (hwM) {
            var args = hwM[3] ? hwM[3].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); }) : [];
            return {
                nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {},
                children: [{
                        nodeType: 'CallExpression', id: "hw-".concat(lineNum),
                        attributes: { callee: "".concat(hwM[1], ".").concat(hwM[2]) }, children: args
                    }],
                metadata: meta
            };
        }
        // ── MemberExpression genérico: obj.method(args) ───────────────────────
        // Fallback para qualquer obj.metodo(...) não capturado acima
        var genericCallM = trimmed.match(/^(\w+)\.(\w+)\s*\(([^)]*)\)\s*$/);
        if (genericCallM) {
            var args = genericCallM[3] ? genericCallM[3].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); }) : [];
            return {
                nodeType: 'ExpressionStatement', id: "stmt-".concat(lineNum), attributes: {},
                children: [{
                        nodeType: 'CallExpression', id: "call-".concat(lineNum),
                        attributes: { callee: "".concat(genericCallM[1], ".").concat(genericCallM[2]) }, children: args
                    }],
                metadata: meta
            };
        }
        // ── Generic assignment ───────────────────────────────────────────────
        var assignM = trimmed.match(/^(\w+)\s*=\s*(.+)\s*$/);
        if (assignM && !/^(if|while|for|def|class|import|from|return|pass)$/.test(assignM[1])) {
            return { nodeType: 'VariableDeclaration', id: "decl-".concat(lineNum), attributes: { name: assignM[1], type: 'auto' }, children: [this._parseExpr(assignM[2].trim(), lineNum)], metadata: meta };
        }
        return null;
    };
    RegexPythonParser.prototype._parseBoolExpr = function (s, lineNum) {
        if (s === 'True' || s === '1')
            return { nodeType: 'Literal', id: "b-".concat(lineNum), attributes: { value: 1 }, children: [] };
        if (s === 'False' || s === '0')
            return { nodeType: 'Literal', id: "b-".concat(lineNum), attributes: { value: 0 }, children: [] };
        return this._parseExpr(s, lineNum);
    };
    RegexPythonParser.prototype._parseExpr = function (s, lineNum) {
        var _this = this;
        s = s.trim();
        var meta = { line: lineNum };
        if (s === 'True' || s === 'HIGH')
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: 1 }, children: [], metadata: meta };
        if (s === 'False' || s === 'LOW')
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: 0 }, children: [], metadata: meta };
        if (s === 'None')
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: 0 }, children: [], metadata: meta };
        // ── millis / micros inline ───────────────────────────────────────────
        if (/^(?:time|utime)\.ticks_ms\(\)$/.test(s))
            return { nodeType: 'CallExpression', id: "ms-".concat(lineNum), attributes: { callee: 'millis' }, children: [], metadata: meta };
        if (/^(?:time|utime)\.ticks_us\(\)$/.test(s))
            return { nodeType: 'CallExpression', id: "us-".concat(lineNum), attributes: { callee: 'micros' }, children: [], metadata: meta };
        // ── random inline ────────────────────────────────────────────────────
        var randInlineM = s.match(/^random\.rand(?:int|range)\s*\(([^)]+)\)$/);
        if (randInlineM) {
            var args = randInlineM[1].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return { nodeType: 'CallExpression', id: "rnd-".concat(lineNum), attributes: { callee: 'random' }, children: args, metadata: meta };
        }
        // ── GpioRead inline — pin.value() ────────────────────────────────────
        var pinValueM = s.match(/^(\w+)\.value\(\)$/);
        if (pinValueM)
            return { nodeType: 'GpioRead', id: "gr-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: pinValueM[1] }, children: [] }], metadata: meta };
        // ── ConditionalExpression — val if cond else other ────────────────────
        var condM = s.match(/^(.+?)\s+if\s+(.+?)\s+else\s+(.+)$/);
        if (condM) {
            return {
                nodeType: 'ConditionalExpression', id: "cond-".concat(lineNum), attributes: {},
                children: [
                    this._parseExpr(condM[2].trim(), lineNum),
                    this._parseExpr(condM[1].trim(), lineNum),
                    this._parseExpr(condM[3].trim(), lineNum),
                ],
                metadata: meta
            };
        }
        // ── Unary ─────────────────────────────────────────────────────────────
        if (s.startsWith('not '))
            return { nodeType: 'UnaryExpression', id: "un-".concat(lineNum), attributes: { operator: '!', prefix: true }, children: [this._parseExpr(s.substring(4).trim(), lineNum)], metadata: meta };
        if (s.startsWith('-') && s.length > 1 && !/^-[\d]/.test(s))
            return { nodeType: 'UnaryExpression', id: "un-".concat(lineNum), attributes: { operator: '-', prefix: true }, children: [this._parseExpr(s.substring(1).trim(), lineNum)], metadata: meta };
        // ── Binary & Comparison — all operators ──────────────────────────────
        for (var _i = 0, _a = ['==', '!=', '<=', '>=', ' and ', ' or ', ' < ', ' > ', ' + ', ' - ', ' * ', ' / ', ' % ', ' & ', ' | ', ' ^ ']; _i < _a.length; _i++) {
            var op = _a[_i];
            var idx = s.indexOf(op);
            if (idx > 0) {
                var left = s.substring(0, idx).trim();
                var right = s.substring(idx + op.length).trim();
                var aslOp = op.trim();
                if (aslOp === 'and')
                    aslOp = '&&';
                if (aslOp === 'or')
                    aslOp = '||';
                return { nodeType: 'BinaryExpression', id: "bin-".concat(lineNum), attributes: { operator: aslOp }, children: [this._parseExpr(left, lineNum), this._parseExpr(right, lineNum)], metadata: meta };
            }
        }
        // ── Array literal: [a, b, c] or [[...], [...]] (2D) ──────────────────
        if (s.startsWith('[') && s.endsWith(']')) {
            var inner = s.slice(1, -1).trim();
            if (!inner)
                return { nodeType: 'ArrayInitializer', id: "arr-".concat(lineNum), attributes: { isArray: true }, children: [], metadata: meta };
            var items = [];
            var depth = 0, cur = '';
            for (var _b = 0, inner_1 = inner; _b < inner_1.length; _b++) {
                var ch = inner_1[_b];
                if (ch === '[' || ch === '(')
                    depth++;
                else if (ch === ']' || ch === ')')
                    depth--;
                if (ch === ',' && depth === 0) {
                    items.push(cur.trim());
                    cur = '';
                }
                else
                    cur += ch;
            }
            if (cur.trim())
                items.push(cur.trim());
            var children = items.map(function (item) { return _this._parseExpr(item, lineNum); });
            var is2D = children.length > 0 && children.every(function (c) { return c.nodeType === 'ArrayInitializer'; });
            return { nodeType: 'ArrayInitializer', id: "arr-".concat(lineNum), attributes: { isArray: true, is2D: is2D }, children: children, metadata: meta };
        }
        // ── List comprehension: [expr for var in iterable] ────────────────────
        var lcM = s.match(/^\[(.+?)\s+for\s+(\w+)\s+in\s+(.+)\]$/);
        if (lcM) {
            var expr = lcM[1].trim();
            var varName = lcM[2].trim();
            var iterable = lcM[3].trim();
            if (iterable.startsWith('range(')) {
                var argStr = iterable.substring(6, iterable.length - 1);
                var parts = argStr.split(',').map(function (p) { return p.trim(); });
                var start = 0, stop_2 = 10;
                if (parts.length === 1)
                    stop_2 = parseInt(parts[0]) || 10;
                else if (parts.length >= 2) {
                    start = parseInt(parts[0]) || 0;
                    stop_2 = parseInt(parts[1]) || 10;
                }
                var count = stop_2 - start;
                if (count > 0 && count <= 50) {
                    var elements = [];
                    for (var i = start; i < stop_2; i++) {
                        var resolved = expr.replace(new RegExp("\\b".concat(varName, "\\b"), 'g'), String(i));
                        elements.push(this._parseExpr(resolved, lineNum));
                    }
                    return { nodeType: 'ArrayInitializer', id: "lc-".concat(lineNum), attributes: { isArray: true }, children: elements, metadata: meta };
                }
            }
            return {
                nodeType: 'CallExpression', id: "lc-".concat(lineNum),
                attributes: { callee: 'LIST_COMPREHENSION', varName: varName, iterable: iterable },
                children: [this._parseExpr(expr, lineNum), this._parseExpr(iterable, lineNum)],
                metadata: meta
            };
        }
        // ── Dictionary Literal ────────────────────────────────────────────────
        if (s.startsWith('{') && s.endsWith('}')) {
            var inner = s.slice(1, -1).trim();
            var pairs = inner.split(',').filter(function (p) { return p.trim(); });
            var children = [];
            for (var _c = 0, pairs_1 = pairs; _c < pairs_1.length; _c++) {
                var p = pairs_1[_c];
                var parts = p.split(':');
                if (parts.length >= 2) {
                    children.push(this._parseExpr(parts[0].trim(), lineNum));
                    children.push(this._parseExpr(parts.slice(1).join(':').trim(), lineNum));
                }
            }
            return { nodeType: 'ObjectInitializer', id: "dict-".concat(lineNum), attributes: {}, children: children, metadata: meta };
        }
        // ── Subscript access: obj[key] ────────────────────────────────────────
        var subscriptM = s.match(/^(\w+)\s*\[(.*)\]$/);
        if (subscriptM)
            return { nodeType: 'SubscriptExpression', id: "sub-".concat(lineNum), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: subscriptM[1] }, children: [] }, this._parseExpr(subscriptM[2].trim(), lineNum)], metadata: meta };
        var idCallM = s.match(/^(\w+)\.id\(\)$/);
        if (idCallM)
            return { nodeType: 'CallExpression', id: "id-".concat(lineNum), attributes: { callee: 'Pin.id' }, children: [{ nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: idCallM[1] }, children: [] }], metadata: meta };
        if (/^-?\d+$/.test(s))
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: parseInt(s) }, children: [], metadata: meta };
        if (/^-?\d+\.\d+$/.test(s))
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: parseFloat(s) }, children: [], metadata: meta };
        if (/^['"].*['"]$/.test(s))
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: s.slice(1, -1), isString: true }, children: [], metadata: meta };
        if (s === 'Pin.OUT')
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: 1 }, children: [], metadata: meta };
        if (s === 'Pin.IN')
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: 0 }, children: [], metadata: meta };
        if (s === 'Pin.PULL_UP')
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: 2 }, children: [], metadata: meta };
        var boardM = s.match(/^board\..*?(\d+)$/);
        if (boardM)
            return { nodeType: 'Literal', id: "l-".concat(lineNum), attributes: { value: parseInt(boardM[1]) }, children: [], metadata: meta };
        var formatM = s.match(/^(['"].*?['"])\.format\((.*)\)$/);
        if (formatM) {
            var strLiteral = this._parseExpr(formatM[1], lineNum);
            var args = formatM[2].split(',').filter(function (x) { return x.trim(); }).map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return { nodeType: 'CallExpression', id: "fmt-".concat(lineNum), attributes: { callee: 'format' }, children: __spreadArray([strLiteral], args, true), metadata: meta };
        }
        // ── pulseIn inline ───────────────────────────────────────────────────
        var pulseInlineM = s.match(/^(?:machine\.)?time_pulse_us\s*\(([^)]+)\)$/);
        if (pulseInlineM) {
            var args = pulseInlineM[1].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); });
            return { nodeType: 'CallExpression', id: "pulse-".concat(lineNum), attributes: { callee: 'pulseIn' }, children: args, metadata: meta };
        }
        // ── MemberExpression genérico: obj.prop (sem parênteses) ─────────────
        var memberM = s.match(/^(\w+)\.(\w+)$/);
        if (memberM) {
            return {
                nodeType: 'MemberExpression', id: "mem-".concat(lineNum),
                attributes: { object: memberM[1], property: memberM[2] },
                children: [
                    { nodeType: 'Identifier', id: "obj-".concat(lineNum), attributes: { name: memberM[1] }, children: [] },
                    { nodeType: 'Identifier', id: "prop-".concat(lineNum), attributes: { name: memberM[2] }, children: [] },
                ], metadata: meta
            };
        }
        // ── obj.method(args) inline como expressão ───────────────────────────
        var inlineCallM = s.match(/^(\w+)\.(\w+)\s*\(([^)]*)\)$/);
        if (inlineCallM) {
            var args = inlineCallM[3] ? inlineCallM[3].split(',').map(function (a) { return _this._parseExpr(a.trim(), lineNum); }) : [];
            return {
                nodeType: 'CallExpression', id: "call-".concat(lineNum),
                attributes: { callee: "".concat(inlineCallM[1], ".").concat(inlineCallM[2]) }, children: args, metadata: meta
            };
        }
        return { nodeType: 'Identifier', id: "id-".concat(lineNum), attributes: { name: s }, children: [], metadata: meta };
    };
    return RegexPythonParser;
}());
// ---------------------------------------------------------------------------
// PythonCstToAst — tree-sitter path
// ---------------------------------------------------------------------------
var LCD_METHODS = ['move_to', 'putstr', 'clear', 'backlight_on', 'backlight_off',
    'hide_cursor', 'show_cursor', 'blink_cursor_on', 'blink_cursor_off'];
var OLED_METHODS = ['fill', 'text', 'show', 'fill_rect', 'pixel',
    'hline', 'vline', 'line', 'rect', 'scroll', 'invert', 'contrast', 'poweroff', 'poweron'];
var PythonCstToAst = /** @class */ (function () {
    function PythonCstToAst() {
    }
    PythonCstToAst.prototype.convert = function (node) {
        var children = this.visitBlockChildren(node);
        return { nodeType: 'Program', id: 'root', attributes: {}, children: children };
    };
    PythonCstToAst.prototype.visit = function (node) {
        switch (node.type) {
            case 'function_definition': return this.visitFunction(node);
            case 'expression_statement': {
                var child = node.namedChild(0);
                if (child && (child.type === 'assignment' || child.type === 'augmented_assignment'))
                    return this.visitAssignment(child);
                return this.visitExprStmt(node);
            }
            case 'if_statement': return this.visitIf(node);
            case 'while_statement': return this.visitWhile(node);
            case 'for_statement': return this.visitFor(node);
            case 'assignment': return this.visitAssignment(node);
            case 'augmented_assignment': return this.visitAssignment(node);
            case 'return_statement': return this.visitReturn(node);
            case 'break_statement': return this.visitBreak(node);
            case 'continue_statement': return this.visitContinue(node);
            case 'match_statement': return this.visitMatch(node);
            case 'list_comprehension': return this.visitListComprehension(node);
            case 'class_definition': return this.visitClass(node);
            case 'import_statement':
            case 'import_from_statement':
                return { nodeType: 'Empty', id: "imp-".concat(node.id), attributes: {}, children: [] };
            default:
                return { nodeType: 'Empty', id: "e-".concat(node.id), attributes: {}, children: [] };
        }
    };
    PythonCstToAst.prototype.visitReturn = function (node) {
        var val = node.child(1) ? this.visitExpr(node.child(1)) : null;
        return { nodeType: 'ReturnStatement', id: "ret-".concat(node.id), attributes: {}, children: val ? [val] : [], metadata: { line: node.startPosition.row + 1 } };
    };
    PythonCstToAst.prototype.visitBreak = function (node) {
        return { nodeType: 'BreakStatement', id: "brk-".concat(node.id), attributes: {}, children: [], metadata: { line: node.startPosition.row + 1 } };
    };
    PythonCstToAst.prototype.visitContinue = function (node) {
        return { nodeType: 'ContinueStatement', id: "cont-".concat(node.id), attributes: {}, children: [], metadata: { line: node.startPosition.row + 1 } };
    };
    PythonCstToAst.prototype.visitFunction = function (node) {
        var _a;
        var name = ((_a = node.childForFieldName('name')) === null || _a === void 0 ? void 0 : _a.text) || 'anon';
        var body = node.childForFieldName('body');
        return { nodeType: 'Function', id: "fn-".concat(node.id), attributes: { name: name }, children: body ? this.visitBlockChildren(body) : [], metadata: { line: node.startPosition.row + 1 } };
    };
    // ── visitClass — EnumDeclaration or StructDeclaration ────────────────────
    PythonCstToAst.prototype.visitClass = function (node) {
        var _a;
        var name = ((_a = node.childForFieldName('name')) === null || _a === void 0 ? void 0 : _a.text) || 'Unknown';
        var body = node.childForFieldName('body');
        var meta = { line: node.startPosition.row + 1 };
        var members = [];
        var fields = [];
        if (body) {
            body.children.forEach(function (c) {
                var _a, _b, _c, _d;
                if (c.type === 'expression_statement') {
                    var a = c.namedChild(0);
                    if ((a === null || a === void 0 ? void 0 : a.type) === 'assignment') {
                        var lname = (_a = a.childForFieldName('left')) === null || _a === void 0 ? void 0 : _a.text;
                        var rval = a.childForFieldName('right');
                        if (lname && (rval === null || rval === void 0 ? void 0 : rval.type) === 'integer') {
                            members.push({ name: lname, value: parseInt(rval.text) });
                            return;
                        }
                    }
                }
                if (c.type === 'annotated_assignment') {
                    var lname = ((_b = c.childForFieldName('name')) === null || _b === void 0 ? void 0 : _b.text) || ((_c = c.child(0)) === null || _c === void 0 ? void 0 : _c.text);
                    var typ = ((_d = c.childForFieldName('type')) === null || _d === void 0 ? void 0 : _d.text) || 'auto';
                    if (lname)
                        fields.push({ name: lname, type: typ });
                }
            });
        }
        if (members.length > 0 && fields.length === 0) {
            return { nodeType: 'EnumDeclaration', id: "enum-".concat(node.id), attributes: { name: name, members: members }, children: [], metadata: meta };
        }
        return { nodeType: 'StructDeclaration', id: "struct-".concat(node.id), attributes: { name: name, fields: fields }, children: [], metadata: meta };
    };
    PythonCstToAst.prototype.visitExprStmt = function (node) {
        var exprNode = node.namedChild(0);
        var expr = exprNode ? this.visitExpr(exprNode) : { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
        return { nodeType: 'ExpressionStatement', id: "stmt-".concat(node.id), attributes: {}, children: [expr], metadata: { line: node.startPosition.row + 1 } };
    };
    PythonCstToAst.prototype.visitAssignment = function (node) {
        var _a, _b;
        var leftExpr = node.childForFieldName('left');
        var rightExpr = node.childForFieldName('right');
        var operator = ((_a = node.childForFieldName('operator')) === null || _a === void 0 ? void 0 : _a.text) || '=';
        var left = this.visitExpr(leftExpr);
        var right = this.visitExpr(rightExpr);
        var meta = { line: node.startPosition.row + 1 };
        if (operator !== '=') {
            var simpleOp = operator.replace('=', '');
            return { nodeType: 'ExpressionStatement', id: "assign-".concat(node.id), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "op-".concat(node.id), attributes: { operator: '=' }, children: [left, { nodeType: 'BinaryExpression', id: "aug-".concat(node.id), attributes: { operator: simpleOp }, children: [left, right] }] }], metadata: meta };
        }
        if (leftExpr && leftExpr.type === 'attribute') {
            var attr = (_b = leftExpr.childForFieldName('attribute')) === null || _b === void 0 ? void 0 : _b.text;
            if (attr === 'value')
                return { nodeType: 'GpioSet', id: "set-".concat(node.id), attributes: {}, children: [this.visitExpr(leftExpr.childForFieldName('object')), right], metadata: meta };
            if (attr === 'direction') {
                var mode = /OUTPUT/.test((rightExpr === null || rightExpr === void 0 ? void 0 : rightExpr.text) || '') ? 1 : 0;
                return { nodeType: 'ExpressionStatement', id: "dir-".concat(node.id), attributes: {}, children: [{ nodeType: 'CallExpression', id: "pm-".concat(node.id), attributes: { callee: 'pinMode' }, children: [this.visitExpr(leftExpr.childForFieldName('object')), { nodeType: 'Literal', id: "m-".concat(node.id), attributes: { value: mode }, children: [] }] }], metadata: meta };
            }
        }
        if (leftExpr && (leftExpr.type === 'pattern_list' || leftExpr.type === 'tuple' || leftExpr.text.includes(','))) {
            var vars = leftExpr.text.split(',').map(function (v) { return v.trim(); });
            var tmpVar_2 = "__tmp_".concat(node.id);
            var result_1 = [{ nodeType: 'VariableDeclaration', id: "tmp-".concat(node.id), attributes: { name: tmpVar_2, type: 'auto' }, children: [right], metadata: meta }];
            vars.forEach(function (v, idx) { result_1.push({ nodeType: 'ExpressionStatement', id: "unpack-".concat(node.id, "-").concat(idx), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "ass-".concat(node.id, "-").concat(idx), attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: "id-".concat(node.id, "-").concat(idx), attributes: { name: v }, children: [] }, { nodeType: 'SubscriptExpression', id: "sub-".concat(node.id, "-").concat(idx), attributes: {}, children: [{ nodeType: 'Identifier', id: "target-".concat(node.id, "-").concat(idx), attributes: { name: tmpVar_2 }, children: [] }, { nodeType: 'Literal', id: "idx-".concat(node.id, "-").concat(idx), attributes: { value: idx }, children: [] }] }] }], metadata: meta }); });
            return { nodeType: 'Block', id: "unpack-blk-".concat(node.id), attributes: {}, children: result_1, metadata: meta };
        }
        if (left.nodeType === 'Identifier')
            return { nodeType: 'VariableDeclaration', id: "decl-".concat(node.id), attributes: { name: left.attributes.name, type: 'auto' }, children: [right], metadata: meta };
        return { nodeType: 'ExpressionStatement', id: "assign-".concat(node.id), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "op-".concat(node.id), attributes: { operator: '=' }, children: [left, right] }], metadata: meta };
    };
    PythonCstToAst.prototype.visitIf = function (node) {
        var cond = this.visitExpr(node.childForFieldName('condition'));
        var cons = node.childForFieldName('consequence');
        var alt = node.childForFieldName('alternative');
        var thenBlock = { nodeType: 'Block', id: "blk-".concat(node.id, "-then"), attributes: {}, children: cons ? this.visitBlockChildren(cons) : [], metadata: { line: node.startPosition.row + 1 } };
        var children = [cond, thenBlock];
        if (alt) {
            var body = alt.child(1);
            if (body && body.type === 'if_statement') {
                var nestedIf = this.visitIf(body);
                if (nestedIf)
                    children.push(nestedIf);
            }
            else if (body)
                children.push({ nodeType: 'Block', id: "blk-".concat(node.id, "-else"), attributes: {}, children: this.visitBlockChildren(body), metadata: { line: alt.startPosition.row + 1 } });
        }
        return { nodeType: 'IfStatement', id: "if-".concat(node.id), attributes: {}, children: children, metadata: { line: node.startPosition.row + 1 } };
    };
    // ── visitWhile — WhileLoop (any cond) + DoWhileLoop heuristic ────────────
    PythonCstToAst.prototype.visitWhile = function (node) {
        var _this = this;
        var _a, _b;
        var condNode = node.childForFieldName('condition');
        var body = node.childForFieldName('body');
        var meta = { line: node.startPosition.row + 1 };
        var condText = ((_a = condNode === null || condNode === void 0 ? void 0 : condNode.text) === null || _a === void 0 ? void 0 : _a.trim()) || '';
        var isInfinite = condText === 'True' || condText === '1';
        var cond = this.visitExpr(condNode);
        // Heuristic do-while detection:
        // while True:
        //     <body>
        //     if not <cond>: break
        if (isInfinite && body) {
            var bodyChildren = body.children.filter(function (c) {
                return c.type !== ':' && c.type !== 'comment';
            });
            var last = bodyChildren[bodyChildren.length - 1];
            if ((last === null || last === void 0 ? void 0 : last.type) === 'if_statement') {
                var ifCond = last.childForFieldName('condition');
                var ifBody = last.childForFieldName('consequence');
                var hasBreak = (_b = ifBody === null || ifBody === void 0 ? void 0 : ifBody.children) === null || _b === void 0 ? void 0 : _b.some(function (c) { return c.type === 'break_statement'; });
                if (hasBreak && ifCond) {
                    var innerCond = ifCond.type === 'not_operator'
                        ? this.visitExpr(ifCond.namedChild(0), undefined)
                        : { nodeType: 'UnaryExpression', id: "neg-".concat(node.id), attributes: { operator: '!', prefix: true }, children: [this.visitExpr(ifCond)] };
                    var realBodyNodes = bodyChildren.slice(0, -1)
                        .map(function (c) { return _this.visit(c); })
                        .filter(Boolean);
                    return {
                        nodeType: 'DoWhileLoop', id: "dw-".concat(node.id), attributes: {},
                        children: [innerCond, { nodeType: 'Block', id: "blk-dw-".concat(node.id), attributes: {}, children: realBodyNodes, metadata: meta }],
                        metadata: meta
                    };
                }
            }
        }
        return {
            nodeType: 'WhileLoop', id: "while-".concat(node.id),
            attributes: { isInfinite: isInfinite },
            children: [cond, { nodeType: 'Block', id: "blk-while-".concat(node.id), attributes: {}, children: body ? this.visitBlockChildren(body) : [], metadata: meta }],
            metadata: meta
        };
    };
    PythonCstToAst.prototype.visitFor = function (node) {
        var _this = this;
        var _a;
        var leftExpr = node.childForFieldName('left');
        var rightExpr = node.childForFieldName('right');
        var body = node.childForFieldName('body');
        var meta = { line: node.startPosition.row + 1 };
        var leftText = (leftExpr === null || leftExpr === void 0 ? void 0 : leftExpr.text) || 'i';
        if ((rightExpr === null || rightExpr === void 0 ? void 0 : rightExpr.type) === 'call' && ((_a = rightExpr.childForFieldName('function')) === null || _a === void 0 ? void 0 : _a.text) === 'range') {
            var argsNode = rightExpr.childForFieldName('arguments');
            var vArgs = argsNode ? argsNode.children.filter(function (c) { return c.type !== '(' && c.type !== ')' && c.type !== ','; }).map(function (c) { return _this.visitExpr(c); }) : [];
            var start = 0, stop_3 = 10, step = 1;
            if (vArgs.length === 1) {
                if (vArgs[0].nodeType === 'Literal')
                    stop_3 = vArgs[0].attributes.value;
            }
            else if (vArgs.length >= 2) {
                if (vArgs[0].nodeType === 'Literal')
                    start = vArgs[0].attributes.value;
                if (vArgs[1].nodeType === 'Literal')
                    stop_3 = vArgs[1].attributes.value;
                if (vArgs.length >= 3 && vArgs[2].nodeType === 'Literal')
                    step = vArgs[2].attributes.value;
            }
            var init = { nodeType: 'VariableDeclaration', id: "init-".concat(node.id), attributes: { name: leftText, type: 'int' }, children: [{ nodeType: 'Literal', id: "lit-0-".concat(node.id), attributes: { value: start }, children: [] }] };
            var condition = { nodeType: 'BinaryExpression', id: "cond-".concat(node.id), attributes: { operator: step > 0 ? '<' : '>' }, children: [{ nodeType: 'Identifier', id: "id-".concat(node.id), attributes: { name: leftText }, children: [] }, vArgs.length >= 2 ? vArgs[1] : (vArgs.length === 1 ? vArgs[0] : { nodeType: 'Literal', id: 'l', attributes: { value: 10 }, children: [] })] };
            var update = { nodeType: 'ExpressionStatement', id: "upd-".concat(node.id), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "u-".concat(node.id), attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: "id-u-".concat(node.id), attributes: { name: leftText }, children: [] }, { nodeType: 'BinaryExpression', id: "add-".concat(node.id), attributes: { operator: '+' }, children: [{ nodeType: 'Identifier', id: "id-u2-".concat(node.id), attributes: { name: leftText }, children: [] }, { nodeType: 'Literal', id: "step-".concat(node.id), attributes: { value: step }, children: [] }] }] }] };
            return { nodeType: 'ForLoop', id: "for-".concat(node.id), attributes: { hasInit: true, hasUpdate: true }, children: [init, condition, update, { nodeType: 'Block', id: "blk-for-".concat(node.id), attributes: {}, children: body ? this.visitBlockChildren(body) : [], metadata: meta }], metadata: meta };
        }
        else {
            var iterable = this.visitExpr(rightExpr);
            var targetExpr = iterable;
            var isReversed = false;
            if (iterable.nodeType === 'CallExpression' && iterable.attributes.callee === 'reversed' && iterable.children.length > 0) {
                targetExpr = iterable.children[0];
                isReversed = true;
            }
            var indexVar = "__i_".concat(node.id % 1000000);
            var lenExpr = { nodeType: 'CallExpression', id: "len-".concat(node.id), attributes: { callee: 'len' }, children: [targetExpr] };
            var init = void 0, condition = void 0, update = void 0;
            if (!isReversed) {
                init = { nodeType: 'VariableDeclaration', id: "init-".concat(node.id), attributes: { name: indexVar, type: 'int' }, children: [{ nodeType: 'Literal', id: "lit-0-".concat(node.id), attributes: { value: 0 }, children: [] }] };
                condition = { nodeType: 'BinaryExpression', id: "cond-".concat(node.id), attributes: { operator: '<' }, children: [{ nodeType: 'Identifier', id: "idx-".concat(node.id), attributes: { name: indexVar }, children: [] }, lenExpr] };
                update = { nodeType: 'ExpressionStatement', id: "upd-".concat(node.id), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "u-".concat(node.id), attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: "id-idx-".concat(node.id), attributes: { name: indexVar }, children: [] }, { nodeType: 'BinaryExpression', id: "add-".concat(node.id), attributes: { operator: '+' }, children: [{ nodeType: 'Identifier', id: "id-idx2-".concat(node.id), attributes: { name: indexVar }, children: [] }, { nodeType: 'Literal', id: "step-".concat(node.id), attributes: { value: 1 }, children: [] }] }] }] };
            }
            else {
                init = { nodeType: 'VariableDeclaration', id: "init-".concat(node.id), attributes: { name: indexVar, type: 'int' }, children: [{ nodeType: 'BinaryExpression', id: "s-".concat(node.id), attributes: { operator: '-' }, children: [lenExpr, { nodeType: 'Literal', id: "lit1-".concat(node.id), attributes: { value: 1 }, children: [] }] }] };
                condition = { nodeType: 'BinaryExpression', id: "cond-".concat(node.id), attributes: { operator: '>=' }, children: [{ nodeType: 'Identifier', id: "idx-".concat(node.id), attributes: { name: indexVar }, children: [] }, { nodeType: 'Literal', id: "l0-".concat(node.id), attributes: { value: 0 }, children: [] }] };
                update = { nodeType: 'ExpressionStatement', id: "upd-".concat(node.id), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "u-".concat(node.id), attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: "id-idx-".concat(node.id), attributes: { name: indexVar }, children: [] }, { nodeType: 'BinaryExpression', id: "add-".concat(node.id), attributes: { operator: '+' }, children: [{ nodeType: 'Identifier', id: "id-idx2-".concat(node.id), attributes: { name: indexVar }, children: [] }, { nodeType: 'Literal', id: "step-".concat(node.id), attributes: { value: -1 }, children: [] }] }] }] };
            }
            var extraBody_1 = [];
            if (leftText.includes(',')) {
                var vars = leftText.split(',').map(function (v) { return v.trim(); });
                var tmpVar_3 = "__val_".concat(node.id);
                extraBody_1.push({ nodeType: 'VariableDeclaration', id: "map-".concat(node.id), attributes: { name: tmpVar_3, type: 'auto' }, children: [{ nodeType: 'SubscriptExpression', id: "sub-".concat(node.id), attributes: {}, children: [targetExpr, { nodeType: 'Identifier', id: "idx-a-".concat(node.id), attributes: { name: indexVar }, children: [] }] }] });
                vars.forEach(function (v, idx) { extraBody_1.push({ nodeType: 'ExpressionStatement', id: "map-".concat(node.id, "-").concat(idx), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "map-ass-".concat(node.id, "-").concat(idx), attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: "id-v-".concat(node.id, "-").concat(idx), attributes: { name: v }, children: [] }, { nodeType: 'SubscriptExpression', id: "sub-v-".concat(node.id, "-").concat(idx), attributes: {}, children: [{ nodeType: 'Identifier', id: "id-tmp-".concat(node.id, "-").concat(idx), attributes: { name: tmpVar_3 }, children: [] }, { nodeType: 'Literal', id: "lit-ix-".concat(node.id, "-").concat(idx), attributes: { value: idx }, children: [] }] }] }] }); });
            }
            else {
                extraBody_1.push({ nodeType: 'ExpressionStatement', id: "map-".concat(node.id), attributes: {}, children: [{ nodeType: 'BinaryExpression', id: "map-ass-".concat(node.id), attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: "id-v-".concat(node.id), attributes: { name: leftText }, children: [] }, { nodeType: 'SubscriptExpression', id: "sub-".concat(node.id), attributes: {}, children: [targetExpr, { nodeType: 'Identifier', id: "idx-a-".concat(node.id), attributes: { name: indexVar }, children: [] }] }] }] });
            }
            return { nodeType: 'ForLoop', id: "for-".concat(node.id), attributes: { hasInit: true, hasUpdate: true }, children: [init, condition, update, { nodeType: 'Block', id: "blk-forin-".concat(node.id), attributes: {}, children: __spreadArray(__spreadArray([], extraBody_1, true), (body ? this.visitBlockChildren(body) : []), true), metadata: meta }], metadata: meta };
        }
    };
    PythonCstToAst.prototype.visitMatch = function (node) {
        var _this = this;
        var subject = node.childForFieldName('subject');
        var discriminant = subject ? this.visitExpr(subject) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] };
        var cases = [];
        node.children.forEach(function (c) {
            if (c.type === 'case_clause') {
                var pattern = c.childForFieldName('pattern');
                var body = c.childForFieldName('body');
                var isDefault = (pattern === null || pattern === void 0 ? void 0 : pattern.text) === '_' || (pattern === null || pattern === void 0 ? void 0 : pattern.type) === 'wildcard_pattern';
                var test = isDefault ? null : (pattern ? _this.visitExpr(pattern) : null);
                cases.push({ nodeType: 'CaseClause', id: "case-".concat(c.id), attributes: { isDefault: isDefault }, children: __spreadArray(__spreadArray(__spreadArray([], (test ? [test] : []), true), (body ? _this.visitBlockChildren(body) : []), true), [{ nodeType: 'BreakStatement', id: "brk-".concat(c.id), attributes: {}, children: [] }], false), metadata: { line: c.startPosition.row + 1 } });
            }
        });
        return { nodeType: 'SwitchStatement', id: "sw-".concat(node.id), attributes: {}, children: __spreadArray([discriminant], cases, true), metadata: { line: node.startPosition.row + 1 } };
    };
    PythonCstToAst.prototype.visitListComprehension = function (node) {
        var _this = this;
        var _a;
        var bodyNode = node.childForFieldName('body');
        var forIn = node.namedChild(1);
        var meta = { line: node.startPosition.row + 1 };
        if (bodyNode && forIn && forIn.type === 'for_in_clause') {
            var left = forIn.childForFieldName('left');
            var right = forIn.childForFieldName('right');
            var varName = left === null || left === void 0 ? void 0 : left.text;
            if ((right === null || right === void 0 ? void 0 : right.type) === 'call' && ((_a = right.childForFieldName('function')) === null || _a === void 0 ? void 0 : _a.text) === 'range' && varName) {
                var argsNode = right.childForFieldName('arguments');
                if (argsNode) {
                    var argsNodes = argsNode.children.filter(function (c) { return c.type !== '(' && c.type !== ')' && c.type !== ','; });
                    var start = 0, stop_4 = 10;
                    var vArgs = argsNodes.map(function (a) { return _this.visitExpr(a); });
                    if (vArgs.length === 1 && vArgs[0].nodeType === 'Literal')
                        stop_4 = vArgs[0].attributes.value;
                    else if (vArgs.length >= 2) {
                        if (vArgs[0].nodeType === 'Literal')
                            start = vArgs[0].attributes.value;
                        if (vArgs[1].nodeType === 'Literal')
                            stop_4 = vArgs[1].attributes.value;
                    }
                    if (stop_4 - start >= 0 && stop_4 - start < 50) {
                        var elements = [];
                        for (var i = start; i < stop_4; i++) {
                            var env = new Map();
                            env.set(varName, { nodeType: 'Literal', id: "lit-".concat(i), attributes: { value: i }, children: [] });
                            elements.push(this.visitExpr(bodyNode, env));
                        }
                        return { nodeType: 'ArrayInitializer', id: "lc-".concat(node.id), attributes: { isArray: true }, children: elements, metadata: meta };
                    }
                }
            }
        }
        return { nodeType: 'ArrayInitializer', id: "lc-".concat(node.id), attributes: { isArray: true }, children: [], metadata: meta };
    };
    PythonCstToAst.prototype.visitBlockChildren = function (node) {
        var _this = this;
        var result = [];
        var pendingComments = [];
        node.children.forEach(function (c) {
            if (c.type === 'comment') {
                pendingComments.push(c.text);
                return;
            }
            if (c.type === ':' || c.type === 'block')
                return;
            var visited = _this.visit(c);
            if (visited) {
                if (pendingComments.length > 0) {
                    visited.leadingComments = __spreadArray([], pendingComments, true);
                    pendingComments = [];
                }
                result.push(visited);
            }
        });
        return result;
    };
    PythonCstToAst.prototype.visitExpr = function (node, env) {
        var _this = this;
        var _a, _b, _c, _d, _e, _f;
        var meta = { line: node.startPosition.row + 1 };
        // ── conditional_expression — val if cond else other ───────────────────
        if (node.type === 'conditional_expression') {
            var body = node.child(0);
            var cond = node.child(2);
            var alt = node.child(4);
            return {
                nodeType: 'ConditionalExpression', id: "tern-".concat(node.id), attributes: {},
                children: [
                    cond ? this.visitExpr(cond, env) : { nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] },
                    body ? this.visitExpr(body, env) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] },
                    alt ? this.visitExpr(alt, env) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] },
                ],
                metadata: meta
            };
        }
        if (node.type === 'integer')
            return { nodeType: 'Literal', id: "l-".concat(node.id), attributes: { value: parseInt(node.text) }, children: [], metadata: meta };
        if (node.type === 'float')
            return { nodeType: 'Literal', id: "l-".concat(node.id), attributes: { value: parseFloat(node.text) }, children: [], metadata: meta };
        if (node.type === 'string')
            return { nodeType: 'Literal', id: "l-".concat(node.id), attributes: { value: node.text.replace(/['\"]/g, ''), isString: true }, children: [], metadata: meta };
        if (node.type === 'identifier') {
            if (env === null || env === void 0 ? void 0 : env.has(node.text))
                return env.get(node.text);
            return { nodeType: 'Identifier', id: "i-".concat(node.id), attributes: { name: node.text }, children: [], metadata: meta };
        }
        if (node.type === 'list') {
            var elements = node.namedChildren.map(function (c) { return _this.visitExpr(c, env); });
            var is2D = elements.length > 0 && elements.every(function (e) { return e.nodeType === 'ArrayInitializer'; });
            return { nodeType: 'ArrayInitializer', id: "list-".concat(node.id), attributes: { isArray: true, is2D: is2D }, children: elements, metadata: meta };
        }
        if (node.type === 'true' || (node.type === 'identifier' && node.text === 'True'))
            return { nodeType: 'Literal', id: "l-".concat(node.id), attributes: { value: 1 }, children: [], metadata: meta };
        if (node.type === 'false' || (node.type === 'identifier' && node.text === 'False'))
            return { nodeType: 'Literal', id: "l-".concat(node.id), attributes: { value: 0 }, children: [], metadata: meta };
        if (node.type === 'none' || (node.type === 'identifier' && node.text === 'None'))
            return { nodeType: 'Literal', id: "l-".concat(node.id), attributes: { value: 0 }, children: [], metadata: meta };
        if (node.type === 'parenthesized_expression') {
            var inner = node.namedChild(0);
            return inner ? this.visitExpr(inner, env) : { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
        }
        if (node.type === 'unary_operator' || node.type === 'not_operator') {
            var op = ((_a = node.childForFieldName('operator')) === null || _a === void 0 ? void 0 : _a.text) || (node.type === 'not_operator' ? 'not' : '-');
            var arg = this.visitExpr(node.childForFieldName('argument') || node.namedChild(0), env);
            return { nodeType: 'UnaryExpression', id: "un-".concat(node.id), attributes: { operator: op === 'not' ? '!' : op, prefix: true }, children: [arg], metadata: meta };
        }
        if (node.type === 'binary_operator' || node.type === 'boolean_operator') {
            var left = this.visitExpr(node.childForFieldName('left'), env);
            var right = this.visitExpr(node.childForFieldName('right'), env);
            var op = ((_b = node.childForFieldName('operator')) === null || _b === void 0 ? void 0 : _b.text) || 'and';
            if (op === 'and')
                op = '&&';
            if (op === 'or')
                op = '||';
            return { nodeType: 'BinaryExpression', id: "bin-".concat(node.id), attributes: { operator: op }, children: [left, right], metadata: meta };
        }
        if (node.type === 'comparison_operator') {
            var left = this.visitExpr(node.child(0), env);
            var right = this.visitExpr(node.child(2), env);
            var op = ((_c = node.child(1)) === null || _c === void 0 ? void 0 : _c.text) || '==';
            return { nodeType: 'BinaryExpression', id: "cmp-".concat(node.id), attributes: { operator: op }, children: [left, right], metadata: meta };
        }
        if (node.type === 'list_comprehension')
            return this.visitListComprehension(node);
        if (node.type === 'dictionary')
            return this.visitDictionary(node, env);
        if (node.type === 'subscript')
            return this.visitSubscript(node, env);
        if (node.type === 'call') {
            var func = node.childForFieldName('function');
            var argsNode = node.childForFieldName('arguments');
            var args = argsNode ? argsNode.children.filter(function (c) { return c.type !== '(' && c.type !== ')' && c.type !== ','; }).map(function (c) { return _this.visitExpr(c, env); }) : [];
            var callee = (func === null || func === void 0 ? void 0 : func.text) || '';
            if ((func === null || func === void 0 ? void 0 : func.type) === 'attribute') {
                var objNode = func.childForFieldName('object');
                var objText = (objNode === null || objNode === void 0 ? void 0 : objNode.text) || '';
                var attr = ((_d = func.childForFieldName('attribute')) === null || _d === void 0 ? void 0 : _d.text) || '';
                callee = "".concat(objText, ".").concat(attr);
                if (attr === 'format' && (objNode === null || objNode === void 0 ? void 0 : objNode.type) === 'string')
                    return { nodeType: 'CallExpression', id: "fmt-".concat(node.id), attributes: { callee: 'format' }, children: __spreadArray([this.visitExpr(objNode, env)], args, true), metadata: meta };
                if (attr === 'on' && args.length === 0)
                    return { nodeType: 'GpioSet', id: "on-".concat(node.id), attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env), { nodeType: 'Literal', id: "l1-".concat(node.id), attributes: { value: 1 }, children: [] }], metadata: meta };
                if (attr === 'off' && args.length === 0)
                    return { nodeType: 'GpioSet', id: "off-".concat(node.id), attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env), { nodeType: 'Literal', id: "l0-".concat(node.id), attributes: { value: 0 }, children: [] }], metadata: meta };
                if (attr === 'value') {
                    if (args.length === 1)
                        return { nodeType: 'GpioSet', id: "set-".concat(node.id), attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env), args[0]], metadata: meta };
                    if (args.length === 0)
                        return { nodeType: 'GpioRead', id: "gr-".concat(node.id), attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env)], metadata: meta };
                }
                if (attr === 'id' && args.length === 0)
                    return { nodeType: 'CallExpression', id: "id-".concat(node.id), attributes: { callee: 'Pin.id' }, children: [this.visitExpr(func.childForFieldName('object'), env)], metadata: meta };
                if ((attr === 'read_u16' || attr === 'read') && args.length === 0)
                    return { nodeType: 'AnalogRead', id: "adc-".concat(node.id), attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env)], metadata: meta };
                if (attr === 'duty' || attr === 'duty_u16' || attr === 'duty_cycle')
                    return { nodeType: 'AnalogWrite', id: "aw-".concat(node.id), attributes: {}, children: __spreadArray([this.visitExpr(func.childForFieldName('object'), env)], args, true), metadata: meta };
                if (attr === 'any')
                    return { nodeType: 'CallExpression', id: "sa-".concat(node.id), attributes: { callee: 'Serial.available' }, children: [], metadata: meta };
                // ── LCD methods ───────────────────────────────────────────────
                if (LCD_METHODS.includes(attr)) {
                    return {
                        nodeType: 'CallExpression', id: "lcd-".concat(node.id),
                        attributes: { callee: "lcd.".concat(attr) }, children: args, metadata: meta
                    };
                }
                // ── OLED methods ──────────────────────────────────────────────
                if (OLED_METHODS.includes(attr)) {
                    return {
                        nodeType: 'CallExpression', id: "oled-".concat(node.id),
                        attributes: { callee: "oled.".concat(attr) }, children: args, metadata: meta
                    };
                }
                // ── pin.irq → attachInterrupt ─────────────────────────────────
                if (attr === 'irq') {
                    return {
                        nodeType: 'CallExpression', id: "irq-".concat(node.id),
                        attributes: { callee: 'attachInterrupt' },
                        children: __spreadArray([this.visitExpr(func.childForFieldName('object'), env)], args, true), metadata: meta
                    };
                }
            }
            // ── pulseIn: machine.time_pulse_us(...) ───────────────────────────
            if (callee === 'machine.time_pulse_us' || callee === 'time_pulse_us') {
                return {
                    nodeType: 'CallExpression', id: "pulse-".concat(node.id),
                    attributes: { callee: 'pulseIn' }, children: args, metadata: meta
                };
            }
            // ── shiftOut / shiftIn ────────────────────────────────────────────
            if (callee === 'shiftOut' || callee === 'shiftIn') {
                return {
                    nodeType: 'CallExpression', id: "shift-".concat(node.id),
                    attributes: { callee: callee }, children: args, metadata: meta
                };
            }
            if (callee === 'print')
                return { nodeType: 'Print', id: "p-".concat(node.id), attributes: { newline: true }, children: args, metadata: meta };
            if (callee === 'enumerate')
                return { nodeType: 'CallExpression', id: "enum-".concat(node.id), attributes: { callee: 'enumerate' }, children: args, metadata: meta };
            if (callee === 'reversed')
                return { nodeType: 'CallExpression', id: "rev-".concat(node.id), attributes: { callee: 'reversed' }, children: args, metadata: meta };
            if (callee === 'len')
                return { nodeType: 'CallExpression', id: "len-".concat(node.id), attributes: { callee: 'len' }, children: args, metadata: meta };
            if (callee === 'time.sleep_ms' || callee === 'sleep_ms' || callee === 'utime.sleep_ms')
                return { nodeType: 'DelayMs', id: "d-".concat(node.id), attributes: {}, children: args, metadata: meta };
            if (callee === 'time.sleep' || callee === 'sleep' || callee === 'utime.sleep') {
                var arg = args[0];
                if (arg && arg.nodeType === 'Literal') {
                    return { nodeType: 'DelayMs', id: "d-".concat(node.id), attributes: {}, children: [{ nodeType: 'Literal', id: "l-".concat(node.id), attributes: { value: arg.attributes.value * 1000 }, children: [] }], metadata: meta };
                }
                // For non-literals, we wrap in a binary expression * 1000 to ensure ASL simulation gets ms
                return {
                    nodeType: 'DelayMs',
                    id: "d-".concat(node.id),
                    attributes: {},
                    children: [{
                            nodeType: 'BinaryExpression',
                            id: "mul-".concat(node.id),
                            attributes: { operator: '*' },
                            children: [arg, { nodeType: 'Literal', id: "ms-".concat(node.id), attributes: { value: 1000 }, children: [] }]
                        }],
                    metadata: meta
                };
            }
            if (callee === 'time.sleep_us' || callee === 'sleep_us' || callee === 'utime.sleep_us')
                return { nodeType: 'CallExpression', id: "delayus-".concat(node.id), attributes: { callee: 'delayMicroseconds' }, children: args, metadata: meta };
            if (callee === 'Pin' || callee === 'machine.Pin')
                return { nodeType: 'CallExpression', id: "pin-".concat(node.id), attributes: { callee: 'Pin' }, children: args, metadata: meta };
            if (callee === 'digitalio.DigitalInOut')
                return { nodeType: 'CallExpression', id: "pin-".concat(node.id), attributes: { callee: 'Pin' }, children: __spreadArray(__spreadArray([], args, true), [{ nodeType: 'Literal', id: "m-".concat(node.id), attributes: { value: 1 }, children: [] }], false), metadata: meta };
            if (callee === 'time.ticks_ms' || callee === 'utime.ticks_ms')
                return { nodeType: 'CallExpression', id: "ms-".concat(node.id), attributes: { callee: 'millis' }, children: [], metadata: meta };
            if (callee === 'time.ticks_us' || callee === 'utime.ticks_us')
                return { nodeType: 'CallExpression', id: "us-".concat(node.id), attributes: { callee: 'micros' }, children: [], metadata: meta };
            if (callee === 'random.randint' || callee === 'random.randrange' || callee === 'urandom.randint')
                return { nodeType: 'CallExpression', id: "rnd-".concat(node.id), attributes: { callee: 'random' }, children: args, metadata: meta };
            if (callee === 'random.random')
                return { nodeType: 'CallExpression', id: "rnd-".concat(node.id), attributes: { callee: 'random' }, children: [], metadata: meta };
            if (callee === 'pyb.Timer' || callee === 'machine.PWM' || callee === 'tone')
                return { nodeType: 'CallExpression', id: "tone-".concat(node.id), attributes: { callee: 'tone' }, children: args, metadata: meta };
            if (callee === 'Serial.begin' || callee === 'UART' || callee === 'machine.UART')
                return { nodeType: 'CallExpression', id: "sb-".concat(node.id), attributes: { callee: 'Serial.begin' }, children: [], metadata: meta };
            if (callee === 'Serial.readString')
                return { nodeType: 'CallExpression', id: "sr-".concat(node.id), attributes: { callee: 'Serial.readString' }, children: [], metadata: meta };
            return { nodeType: 'CallExpression', id: "call-".concat(node.id), attributes: { callee: callee }, children: args, metadata: meta };
        }
        if (node.type === 'attribute') {
            var obj = (_e = node.childForFieldName('object')) === null || _e === void 0 ? void 0 : _e.text;
            var attr = (_f = node.childForFieldName('attribute')) === null || _f === void 0 ? void 0 : _f.text;
            if (obj === 'Pin' || obj === 'machine.Pin') {
                if (attr === 'IN')
                    return { nodeType: 'Literal', id: 'in', attributes: { value: 0 }, children: [], metadata: meta };
                if (attr === 'OUT')
                    return { nodeType: 'Literal', id: 'out', attributes: { value: 1 }, children: [], metadata: meta };
                if (attr === 'PULL_UP')
                    return { nodeType: 'Literal', id: 'pullup', attributes: { value: 2 }, children: [], metadata: meta };
            }
            if (obj === 'digitalio.Direction' || obj === 'Direction') {
                if (attr === 'OUTPUT')
                    return { nodeType: 'Literal', id: 'out', attributes: { value: 1 }, children: [], metadata: meta };
                if (attr === 'INPUT')
                    return { nodeType: 'Literal', id: 'in', attributes: { value: 0 }, children: [], metadata: meta };
            }
            if (obj === 'board' && attr) {
                var match = attr.match(/\d+/);
                if (match)
                    return { nodeType: 'Literal', id: "pin-".concat(node.id), attributes: { value: parseInt(match[0]) }, children: [], metadata: meta };
                if (attr === 'LED')
                    return { nodeType: 'Literal', id: "pin-".concat(node.id), attributes: { value: 25 }, children: [], metadata: meta };
            }
            // ── MemberExpression genérico: qualquer obj.prop ──────────────────
            return {
                nodeType: 'MemberExpression', id: "mem-".concat(node.id),
                attributes: { object: obj || '', property: attr || '' },
                children: [
                    { nodeType: 'Identifier', id: "obj-".concat(node.id), attributes: { name: obj || '' }, children: [] },
                    { nodeType: 'Identifier', id: "prop-".concat(node.id), attributes: { name: attr || '' }, children: [] },
                ], metadata: meta
            };
        }
        return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
    };
    PythonCstToAst.prototype.visitDictionary = function (node, env) {
        var meta = { line: node.startPosition.row + 1 };
        var pairs = node.namedChildren.filter(function (c) { return c.type === 'pair'; });
        var children = [];
        for (var _i = 0, pairs_2 = pairs; _i < pairs_2.length; _i++) {
            var pair = pairs_2[_i];
            var key = pair.childForFieldName('key');
            var val = pair.childForFieldName('value');
            if (key && val) {
                children.push(this.visitExpr(key, env));
                children.push(this.visitExpr(val, env));
            }
        }
        return { nodeType: 'ObjectInitializer', id: "dict-".concat(node.id), attributes: {}, children: children, metadata: meta };
    };
    PythonCstToAst.prototype.visitSubscript = function (node, env) {
        var meta = { line: node.startPosition.row + 1 };
        return { nodeType: 'SubscriptExpression', id: "sub-".concat(node.id), attributes: {}, children: [this.visitExpr(node.childForFieldName('value'), env), this.visitExpr(node.childForFieldName('subscript'), env)], metadata: meta };
    };
    return PythonCstToAst;
}());
