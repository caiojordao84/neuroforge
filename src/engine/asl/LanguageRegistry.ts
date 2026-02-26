import type { Language } from '@/types';

export interface LanguageInfo {
    id: Language;
    label: string;
    extension: string;
    monacoLanguage: string;
    isASLSupported: boolean;
}

export const LANGUAGE_REGISTRY: LanguageInfo[] = [
    {
        id: 'cpp',
        label: 'C++ (Arduino)',
        extension: '.ino',
        monacoLanguage: 'cpp',
        isASLSupported: true,
    },
    {
        id: 'c',
        label: 'C',
        extension: '.c',
        monacoLanguage: 'cpp',
        isASLSupported: true, // Should be supported by RecursiveDescentCParser
    },
    {
        id: 'micropython',
        label: 'MicroPython',
        extension: '.py',
        monacoLanguage: 'python',
        isASLSupported: true,
    },
    {
        id: 'circuitpython',
        label: 'CircuitPython',
        extension: '.py',
        monacoLanguage: 'python',
        isASLSupported: true,
    },
    {
        id: 'python',
        label: 'Python',
        extension: '.py',
        monacoLanguage: 'python',
        isASLSupported: true,
    },
    {
        id: 'assembly',
        label: 'Assembly (AVR)',
        extension: '.asm',
        monacoLanguage: 'asm',
        isASLSupported: false, // Not yet in codeToASL
    },
    {
        id: 'rust',
        label: 'Rust',
        extension: '.rs',
        monacoLanguage: 'rust',
        isASLSupported: true,
    },
];

export function getLanguageInfo(id: Language): LanguageInfo | undefined {
    return LANGUAGE_REGISTRY.find((l) => l.id === id);
}

export function getASLSupportedLanguages(): Language[] {
    return LANGUAGE_REGISTRY.filter((l) => l.isASLSupported).map((l) => l.id);
}
