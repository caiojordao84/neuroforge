// src/engine/asl/plugins/core/ShimManager.ts

export type ShimLanguage = 'c' | 'python' | 'rust';

export interface ShimDefinition {
    name: string;
    code: string;
    description?: string;
    dependencies?: string[]; // Other shims this one depends on
}

export class ShimManager {
    private language: ShimLanguage;
    private registry: Map<string, ShimDefinition> = new Map();
    private requiredShims: Set<string> = new Set();

    constructor(language: ShimLanguage) {
        this.language = language;
    }

    /**
     * Registers a shim definition so it can be requested later.
     */
    registerShim(shim: ShimDefinition): void {
        this.registry.set(shim.name, shim);
    }

    /**
     * Registers multiple shims at once.
     */
    registerShims(shims: ShimDefinition[]): void {
        shims.forEach(s => this.registerShim(s));
    }

    /**
     * Flags a shim as required for the current code generation.
     * If the shim has dependencies, they are required recursively.
     */
    requireShim(name: string): void {
        if (!this.registry.has(name)) {
            console.warn(`[ShimManager] Warning: Shim '${name}' requested but not registered for language ${this.language}.`);
            return;
        }

        if (this.requiredShims.has(name)) {
            return; // Already required, prevent infinite loops
        }

        this.requiredShims.add(name);

        // Recursively require dependencies
        const def = this.registry.get(name)!;
        if (def.dependencies) {
            for (const dep of def.dependencies) {
                this.requireShim(dep);
            }
        }
    }

    /**
     * Returns all requested shims formatted as a single source code block
     * to be injected at the top of the generated file.
     */
    getRequiredShimsCode(): string {
        if (this.requiredShims.size === 0) {
            return '';
        }

        const lines: string[] = [];
        lines.push(`\n// --- ASL Auto-Generated Shims (${this.language.toUpperCase()}) ---`);

        for (const shimName of this.requiredShims) {
            const def = this.registry.get(shimName)!;
            if (def.description) {
                lines.push(`// Shim: ${def.name} - ${def.description}`);
            } else {
                lines.push(`// Shim: ${def.name}`);
            }
            lines.push(def.code);
            lines.push('');
        }

        lines.push(`// --- End of Shims ---\n`);
        return lines.join('\n');
    }

    /**
     * Returns whether a specific shim was requested.
     */
    hasRequested(name: string): boolean {
        return this.requiredShims.has(name);
    }

    /**
     * Clears all explicitly requested shims (useful for resetting between runs).
     */
    resetRuntime(): void {
        this.requiredShims.clear();
    }
}
