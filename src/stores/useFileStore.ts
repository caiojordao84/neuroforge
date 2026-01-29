import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '@/types';

// Unique file identifier
export interface CodeFile {
  id: string;
  name: string;
  code: string;
  language: Language;
  mcuId: string | null; // Associated MCU component ID
  isMain: boolean; // Whether this is the main file (entry point)
  lastModified: number;
}

interface FileStore {
  files: CodeFile[];
  activeFileId: string | null;
  nextFileNumber: number;
  
  // Actions
  createFile: (name?: string, language?: Language) => string;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  setActiveFile: (id: string) => void;
  updateFileCode: (id: string, code: string) => void;
  updateFileLanguage: (id: string, language: Language) => void;
  assignMCU: (fileId: string, mcuId: string | null) => void;
  setMainFile: (id: string) => void;
  getFileById: (id: string) => CodeFile | undefined;
  getFilesByMCU: (mcuId: string) => CodeFile[];
}

const defaultCppCode = `// Arduino LED Blink Example
// LED connected to pin 13

void setup() {
  // Initialize digital pin 13 as an output
  pinMode(13, OUTPUT);
  
  // Initialize Serial communication
  Serial.begin(9600);
  Serial.println("Arduino started!");
}

void loop() {
  // Turn the LED on
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(1000);
  
  // Turn the LED off
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(1000);
}`;

const generateFileId = (): string => {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      files: [
        {
          id: 'main',
          name: 'main.ino',
          code: defaultCppCode,
          language: 'cpp',
          mcuId: null,
          isMain: true,
          lastModified: Date.now(),
        },
      ],
      activeFileId: 'main',
      nextFileNumber: 1,

      createFile: (name?: string, language: Language = 'cpp') => {
        const { nextFileNumber } = get();
        const fileName = name || `sketch_${nextFileNumber}.${language === 'cpp' ? 'ino' : 'py'}`;
        
        const newFile: CodeFile = {
          id: generateFileId(),
          name: fileName,
          code: '',
          language,
          mcuId: null,
          isMain: false,
          lastModified: Date.now(),
        };

        set((state) => ({
          files: [...state.files, newFile],
          activeFileId: newFile.id,
          nextFileNumber: state.nextFileNumber + 1,
        }));

        return newFile.id;
      },

      deleteFile: (id) => {
        const { files, activeFileId } = get();
        
        // Don't allow deleting the last file
        if (files.length <= 1) {
          return;
        }

        // Don't allow deleting the main file
        const file = files.find((f) => f.id === id);
        if (file?.isMain) {
          return;
        }

        set((state) => {
          const newFiles = state.files.filter((f) => f.id !== id);
          const newActiveId = activeFileId === id 
            ? newFiles.find((f) => f.isMain)?.id || newFiles[0]?.id 
            : activeFileId;
          
          return {
            files: newFiles,
            activeFileId: newActiveId,
          };
        });
      },

      renameFile: (id, newName) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id
              ? { ...f, name: newName, lastModified: Date.now() }
              : f
          ),
        }));
      },

      setActiveFile: (id) => {
        set({ activeFileId: id });
      },

      updateFileCode: (id, code) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, code, lastModified: Date.now() } : f
          ),
        }));
      },

      updateFileLanguage: (id, language) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id
              ? { ...f, language, lastModified: Date.now() }
              : f
          ),
        }));
      },

      assignMCU: (fileId, mcuId) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === fileId ? { ...f, mcuId } : f
          ),
        }));
      },

      setMainFile: (id) => {
        set((state) => ({
          files: state.files.map((f) => ({
            ...f,
            isMain: f.id === id,
          })),
        }));
      },

      getFileById: (id) => {
        return get().files.find((f) => f.id === id);
      },

      getFilesByMCU: (mcuId) => {
        return get().files.filter((f) => f.mcuId === mcuId);
      },
    }),
    {
      name: 'neuroforge-file-store',
      partialize: (state) => ({ 
        files: state.files,
        nextFileNumber: state.nextFileNumber,
      }),
    }
  )
);
