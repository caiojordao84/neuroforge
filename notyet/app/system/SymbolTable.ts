
import { Symbol } from './types';

export class SymbolTable {
    private scopes: Map<string, Symbol>[] = [];
    private allSymbols: Symbol[] = [];

    constructor() { this.pushScope(); }

    pushScope() { this.scopes.push(new Map()); }
    popScope() { this.scopes.pop(); }

    define(name: string, type: string, line: number, initialValue: any = 0): boolean {
        const currentScope = this.scopes[this.scopes.length - 1];
        if (currentScope.has(name)) return false; 
        const sym: Symbol = { name, type, scopeLevel: this.scopes.length - 1, declaredLine: line, usageCount: 0, value: initialValue };
        currentScope.set(name, sym);
        this.allSymbols.push(sym);
        return true;
    }

    resolve(name: string): Symbol | undefined {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) return this.scopes[i].get(name);
        }
        return undefined;
    }

    markUsage(name: string) {
        const sym = this.resolve(name);
        if (sym) sym.usageCount++;
    }

    getAllSymbols() { return this.allSymbols; }
}
