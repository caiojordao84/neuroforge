import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '@/types';

export interface Library {
    id: string;
    name: string;
    content: string;
    language: Language;
    url?: string;
    isExternal: boolean;
    lastModified: number;
}

interface LibraryStore {
    libraries: Library[];
    activeLibraryId: string | null;

    // Actions
    addLibrary: (name: string, language: Language, content?: string) => string;
    updateLibrary: (id: string, updates: Partial<Library>) => void;
    deleteLibrary: (id: string) => void;
    setActiveLibrary: (id: string | null) => void;
    importLibraryFromUrl: (url: string) => Promise<string>;
}

const generateId = () => `lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useLibraryStore = create<LibraryStore>()(
    persist(
        (set) => ({
            libraries: [],
            activeLibraryId: null,

            addLibrary: (name, language, content = '') => {
                const newLib: Library = {
                    id: generateId(),
                    name,
                    language,
                    content,
                    isExternal: false,
                    lastModified: Date.now(),
                };

                set((state) => ({
                    libraries: [...state.libraries, newLib],
                    activeLibraryId: newLib.id,
                }));

                return newLib.id;
            },

            updateLibrary: (id, updates) => {
                set((state) => ({
                    libraries: state.libraries.map((lib) =>
                        lib.id === id ? { ...lib, ...updates, lastModified: Date.now() } : lib
                    ),
                }));
            },

            deleteLibrary: (id) => {
                set((state) => {
                    const newLibs = state.libraries.filter((lib) => lib.id !== id);
                    return {
                        libraries: newLibs,
                        activeLibraryId: state.activeLibraryId === id ? (newLibs[0]?.id || null) : state.activeLibraryId,
                    };
                });
            },

            setActiveLibrary: (id) => set({ activeLibraryId: id }),

            importLibraryFromUrl: async (url) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Failed to fetch library');
                    const content = await response.text();

                    // Try to guess name from URL
                    const urlParts = url.split('/');
                    const fileName = urlParts[urlParts.length - 1] || 'imported_lib';

                    // Guess language
                    let language: Language = 'cpp';
                    if (fileName.endsWith('.py')) language = 'micropython';

                    const newLib: Library = {
                        id: generateId(),
                        name: fileName,
                        content,
                        language,
                        url,
                        isExternal: true,
                        lastModified: Date.now(),
                    };

                    set((state) => ({
                        libraries: [...state.libraries, newLib],
                        activeLibraryId: newLib.id,
                    }));

                    return newLib.id;
                } catch (error) {
                    console.error('Error importing library:', error);
                    throw error;
                }
            },
        }),
        {
            name: 'neuroforge-library-store',
        }
    )
);
