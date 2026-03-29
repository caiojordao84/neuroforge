export type Language = 'cpp' | 'c' | 'micropython' | 'rust' | 'python' | 'st';

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

/** Infer language from file extension */
function inferLanguage(filename: string): Language {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, Language> = {
    cpp: 'cpp', c: 'c', cc: 'cpp', h: 'cpp', hpp: 'cpp', ino: 'cpp',
    py: 'python', rs: 'rust', st: 'st',
  };
  return map[ext] ?? 'cpp';
}

class LibraryState {
  libraries       = $state<Library[]>([]);
  activeLibraryId = $state<string | null>(null);

  /** The currently active library item */
  activeLibrary = $derived(
    this.libraries.find((l: Library) => l.id === this.activeLibraryId) ?? null
  );

  constructor() {
    if (typeof localStorage === 'undefined') return;
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
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      libraries: this.libraries, activeLibraryId: this.activeLibraryId,
    }));
  }

  /** Create a new empty library file */
  createNew(name: string): string {
    const language = inferLanguage(name);
    const lib: Library = {
      id: genId(), name, language, content: `// ${name}\n`,
      isExternal: false, lastModified: Date.now()
    };
    this.libraries = [...this.libraries, lib];
    this.activeLibraryId = lib.id;
    this.persist();
    return lib.id;
  }

  /** Legacy compat — adds a library with explicit language */
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

  /** Import files from the user's computer via File API */
  async importFromComputer(fileList: FileList): Promise<string[]> {
    const ids: string[] = [];
    for (const file of Array.from(fileList)) {
      const content = await file.text();
      const language = inferLanguage(file.name);
      const lib: Library = {
        id: genId(), name: file.name, language, content,
        isExternal: false, lastModified: Date.now()
      };
      this.libraries = [...this.libraries, lib];
      ids.push(lib.id);
    }
    if (ids.length > 0) {
      this.activeLibraryId = ids[ids.length - 1];
    }
    this.persist();
    return ids;
  }

  /** Import a library from a URL (GitHub raw, etc.) */
  async importFromUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch library');
    const content = await res.text();
    const fileName = url.split('/').at(-1) ?? 'imported_lib';
    const language = inferLanguage(fileName);
    const lib: Library = {
      id: genId(), name: fileName, content, language,
      url, isExternal: true, lastModified: Date.now()
    };
    this.libraries = [...this.libraries, lib];
    this.activeLibraryId = lib.id;
    this.persist();
    return lib.id;
  }
}

export const library = new LibraryState();
