export type Language = 'cpp' | 'micropython' | 'rust' | 'python';

export interface Library {
  id: string;
  name: string;
  content: string;
  language: Language;
  url?: string;
  isExternal: boolean;
  lastModified: number;
}

const STORAGE_KEY = 'neuroforge-library-store';
const genId = () => `lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

class LibraryState {
  libraries       = $state<Library[]>([]);
  activeLibraryId = $state<string | null>(null);

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.libraries       = parsed.libraries       ?? [];
        this.activeLibraryId = parsed.activeLibraryId ?? null;
      }
    } catch {}
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      libraries: this.libraries, activeLibraryId: this.activeLibraryId,
    }));
  }

  addLibrary(name: string, language: Language, content = ''): string {
    const lib: Library = { id: genId(), name, language, content, isExternal: false, lastModified: Date.now() };
    this.libraries = [...this.libraries, lib];
    this.activeLibraryId = lib.id;
    this.persist();
    return lib.id;
  }

  updateLibrary(id: string, updates: Partial<Library>) {
    this.libraries = this.libraries.map((l: Library) =>
      l.id === id ? { ...l, ...updates, lastModified: Date.now() } : l
    );
    this.persist();
  }

  deleteLibrary(id: string) {
    const newLibs = this.libraries.filter((l: Library) => l.id !== id);
    this.libraries = newLibs;
    if (this.activeLibraryId === id)
      this.activeLibraryId = newLibs[0]?.id ?? null;
    this.persist();
  }

  setActiveLibrary(id: string | null) {
    this.activeLibraryId = id;
    this.persist();
  }

  async importLibraryFromUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch library');
    const content = await res.text();
    const fileName = url.split('/').at(-1) ?? 'imported_lib';
    const language: Language = fileName.endsWith('.py') ? 'micropython' : 'cpp';
    const lib: Library = { id: genId(), name: fileName, content, language, url, isExternal: true, lastModified: Date.now() };
    this.libraries = [...this.libraries, lib];
    this.activeLibraryId = lib.id;
    this.persist();
    return lib.id;
  }
}

export const library = new LibraryState();
