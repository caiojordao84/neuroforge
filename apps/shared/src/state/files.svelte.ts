export interface ProjectFile {
  id:       string;
  name:     string;
  language: string;      // 'cpp' | 'python' | 'rust' | 'st'
  content:  string;
  modified: boolean;
  path?:    string;      // caminho no filesystem (Desktop)
}

const STORAGE_KEY = 'neuroforge-files-store';
const genId = () => `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

class FilesState {
  files          = $state<ProjectFile[]>([]);
  activeFileId   = $state<string | null>(null);

  // Derived — ficheiro activo para o editor
  activeFile = $derived(
    this.files.find(f => f.id === this.activeFileId) ?? null
  );

  // Derived — tabs para CodeEditorWithTabs
  editorTabs = $derived(
    this.files.map(f => ({
      id:       f.id,
      label:    f.name,
      value:    f.content,
      language: f.language,
      modified: f.modified,
    }))
  );

  constructor() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.files        = parsed.files        ?? [];
        this.activeFileId = parsed.activeFileId ?? null;
      }
      // Se não há ficheiros, criar um ficheiro de boas-vindas
      if (this.files.length === 0) {
        this.newFile('main.ino', 'cpp',
          '// NeuroForge — RP2040 / Arduino\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n'
        );
        this.newFile('helper.h', 'cpp', '// helper header');
      }
    } catch (e) {
        console.error('Error loading files from localStorage:', e);
    }
  }

  private persist() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      files: this.files, activeFileId: this.activeFileId,
    }));
  }

  newFile(name: string, language: string, content = ''): string {
    const f: ProjectFile = { id: genId(), name, language, content, modified: false };
    this.files = [...this.files, f];
    this.activeFileId = f.id;
    this.persist();
    return f.id;
  }

  updateContent(id: string, content: string) {
    this.files = this.files.map(f =>
      f.id === id ? { ...f, content, modified: true } : f
    );
    this.persist();
  }

  saveFile(id: string) {
    this.files = this.files.map(f =>
      f.id === id ? { ...f, modified: false } : f
    );
    this.persist();
  }

  closeFile(id: string) {
    const remaining = this.files.filter(f => f.id !== id);
    this.files = remaining;
    if (this.activeFileId === id)
      this.activeFileId = remaining.at(-1)?.id ?? null;
    this.persist();
  }

  setActiveFile(id: string) {
    this.activeFileId = id;
    this.persist();
  }

  renameFile(id: string, name: string) {
    this.files = this.files.map(f =>
      f.id === id ? { ...f, name, modified: true } : f
    );
    this.persist();
  }
}

export const files = new FilesState();
