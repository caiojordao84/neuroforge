import { Parser, Language } from 'web-tree-sitter';

export class TreeSitterLoader {
    private static initialized = false;
    private static languages = new Map<string, Language>();

    static async init() {
        if (this.initialized) return;
        try {
            await Parser.init({
                locateFile(scriptName: string) {
                    if (scriptName === 'tree-sitter.wasm') {
                        return '/tree-sitter.wasm';
                    }
                    return scriptName;
                }
            });
            this.initialized = true;
        } catch (e) {
            console.error("Failed to initialize web-tree-sitter", e);
            throw e;
        }
    }

    static async loadLanguage(lang: string): Promise<Language> {
        await this.init();
        if (this.languages.has(lang)) return this.languages.get(lang)!;

        // Assumes .wasm files are in /public
        const wasmPath = `/tree-sitter-${lang}.wasm`;
        try {
            const language = await Language.load(wasmPath);
            this.languages.set(lang, language);
            return language;
        } catch (e) {
            console.error(`Failed to load language: ${lang}`, e);
            throw e;
        }
    }

    static async createParser(lang: string): Promise<Parser> {
        const language = await this.loadLanguage(lang);
        const parser = new Parser();
        parser.setLanguage(language);
        return parser;
    }
}
