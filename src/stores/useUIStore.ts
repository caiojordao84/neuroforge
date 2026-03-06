import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WindowState } from '@/types';

// Export WindowId type - includes properties window for FEATURE 2.4
export type WindowId = 'codeEditor' | 'componentsLibrary' | 'serialMonitor' | 'terminal' | 'properties' | 'libraries' | 'aslViewer' | 'serialTerminal' | 'flowEditor' | 'blocklyEditor';

interface UIStore {
  windows: Record<WindowId, WindowState>;
  activeWindowId: WindowId | null;
  highestZIndex: number;

  // Actions
  toggleWindow: (id: WindowId) => void;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  minimizeWindow: (id: WindowId) => void;
  restoreWindow: (id: WindowId) => void;
  bringToFront: (id: WindowId) => void;
  updateWindowPosition: (id: WindowId, position: { x: number; y: number }) => void;
  updateWindowSize: (id: WindowId, size: { width: number; height: number }) => void;
  dockWindow: (id: WindowId) => void;
  undockWindow: (id: WindowId) => void;
  updateDockWidth: (id: WindowId, width: number) => void;
  resetWindows: () => void;
}

const defaultWindows: Record<WindowId, WindowState> = {
  codeEditor: {
    id: 'codeEditor',
    isOpen: true,
    isMinimized: false,
    position: { x: 80, y: 60 },
    size: { width: 600, height: 500 },
    zIndex: 10,
    title: 'Code Editor',
    isDocked: true,
    dockWidth: 20,
  },
  componentsLibrary: {
    id: 'componentsLibrary',
    isOpen: false,
    isMinimized: false,
    position: { x: 700, y: 60 },
    size: { width: 280, height: 400 },
    zIndex: 10,
    title: 'Components Library',
    isDocked: true,
    dockWidth: 20,
  },
  serialMonitor: {
    id: 'serialMonitor',
    isOpen: false,
    isMinimized: false,
    position: { x: 80, y: 580 },
    size: { width: 500, height: 250 },
    zIndex: 10,
    title: 'Serial Monitor',
    isDocked: true,
    dockWidth: 20,
  },
  terminal: {
    id: 'terminal',
    isOpen: false,
    isMinimized: false,
    position: { x: 600, y: 580 },
    size: { width: 450, height: 250 },
    zIndex: 10,
    title: 'Terminal',
    isDocked: true,
    dockWidth: 20,
  },
  properties: {
    id: 'properties',
    isOpen: false,
    isMinimized: false,
    position: { x: 700, y: 200 },
    size: { width: 300, height: 400 },
    zIndex: 10,
    title: 'Properties',
    isDocked: true,
    dockWidth: 20,
  },
  libraries: {
    id: 'libraries',
    isOpen: false,
    isMinimized: false,
    position: { x: 300, y: 100 },
    size: { width: 600, height: 500 },
    zIndex: 10,
    title: 'Libraries Management',
    isDocked: true,
    dockWidth: 20,
  },
  aslViewer: {
    id: 'aslViewer',
    isOpen: false,
    isMinimized: false,
    position: { x: 100, y: 120 },
    size: { width: 540, height: 480 },
    zIndex: 10,
    title: 'ASL Viewer',
    isDocked: true,
    dockWidth: 20,
  },
  serialTerminal: {
    id: 'serialTerminal',
    isOpen: false,
    isMinimized: false,
    position: { x: 80, y: 580 },
    size: { width: 500, height: 400 },
    zIndex: 10,
    title: 'Serial & Terminal',
    isDocked: true,
    dockWidth: 20,
  },
  flowEditor: {
    id: 'flowEditor',
    isOpen: false,
    isMinimized: false,
    position: { x: 100, y: 100 },
    size: { width: 800, height: 600 },
    zIndex: 10,
    title: 'Flow Programming',
    isDocked: false,
    dockWidth: 20,
  },
  blocklyEditor: {
    id: 'blocklyEditor',
    isOpen: false,
    isMinimized: false,
    position: { x: 120, y: 120 },
    size: { width: 800, height: 600 },
    zIndex: 10,
    title: 'Blockly Logic',
    isDocked: false,
    dockWidth: 20,
  },
};

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      windows: { ...defaultWindows },
      activeWindowId: null,
      highestZIndex: 100,

      toggleWindow: (id) => {
        const window = get().windows[id];
        if (window.isOpen) {
          get().closeWindow(id);
        } else {
          get().openWindow(id);
        }
      },

      openWindow: (id) => {
        set((state) => {
          const newZIndex = state.highestZIndex + 1;
          const targetWindow = state.windows[id];
          const isDocked = targetWindow.isDocked !== false; // Default to docked if undefined

          // If opening a docked window and there's another docked window open, close it
          // But keep floating windows open
          const updatedWindows = { ...state.windows };

          if (isDocked) {
            Object.keys(updatedWindows).forEach((key) => {
              const win = updatedWindows[key as WindowId];
              if (win.isOpen && win.isDocked !== false && key !== id) {
                updatedWindows[key as WindowId] = { ...win, isOpen: false, isMinimized: false };
              }
            });
          }

          return {
            windows: {
              ...updatedWindows,
              [id]: {
                ...state.windows[id],
                isOpen: true,
                isMinimized: false,
                isDocked: isDocked,
                zIndex: newZIndex,
              },
            },
            highestZIndex: newZIndex,
            activeWindowId: id,
          };
        });
      },

      closeWindow: (id) => {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: {
              ...state.windows[id],
              isOpen: false,
              isMinimized: false,
            },
          },
          activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
        }));
      },

      minimizeWindow: (id) => {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: {
              ...state.windows[id],
              isMinimized: true,
            },
          },
          activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
        }));
      },

      restoreWindow: (id) => {
        set((state) => {
          const newZIndex = state.highestZIndex + 1;
          return {
            windows: {
              ...state.windows,
              [id]: {
                ...state.windows[id],
                isMinimized: false,
                zIndex: newZIndex,
              },
            },
            highestZIndex: newZIndex,
            activeWindowId: id,
          };
        });
      },

      bringToFront: (id) => {
        set((state) => {
          const newZIndex = state.highestZIndex + 1;
          return {
            windows: {
              ...state.windows,
              [id]: {
                ...state.windows[id],
                zIndex: newZIndex,
              },
            },
            highestZIndex: newZIndex,
            activeWindowId: id,
          };
        });
      },

      updateWindowPosition: (id, position) => {
        // Ensure position is within viewport bounds
        const windowState = get().windows[id];
        const maxX = typeof window !== 'undefined' ? window.innerWidth - windowState.size.width : position.x;
        const maxY = typeof window !== 'undefined' ? window.innerHeight - windowState.size.height : position.y;

        const boundedPosition = {
          x: Math.max(60, Math.min(maxX - 20, position.x)),
          y: Math.max(10, Math.min(maxY - 20, position.y)),
        };

        set((state) => ({
          windows: {
            ...state.windows,
            [id]: {
              ...state.windows[id],
              position: boundedPosition,
            },
          },
        }));
      },

      updateWindowSize: (id, size) => {
        if (isNaN(size.width) || isNaN(size.height)) return;
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: {
              ...state.windows[id],
              size,
            },
          },
        }));
      },

      dockWindow: (id) => {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: {
              ...state.windows[id],
              isDocked: true,
              position: { x: 60, y: 56 },
            },
          },
        }));
      },

      undockWindow: (id) => {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: {
              ...state.windows[id],
              isDocked: false,
            },
          },
        }));
      },

      updateDockWidth: (id, width) => {
        if (isNaN(width)) return;
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: {
              ...state.windows[id],
              dockWidth: width,
            },
          },
        }));
      },

      resetWindows: () => {
        set({
          windows: { ...defaultWindows },
          highestZIndex: 100,
          activeWindowId: null,
        });
      },
    }),
    {
      name: 'neuroforge-ui-store',
      partialize: (state) => ({
        windows: state.windows,
        highestZIndex: state.highestZIndex
      }),
      merge: (persistedState: any, currentState: UIStore) => {
        return {
          ...currentState,
          ...persistedState,
          windows: {
            ...currentState.windows, // Defaults (including new ones like 'libraries')
            ...(persistedState?.windows || {}), // Persisted values overwrite defaults where keys match
          },
        };
      },
    }
  )
);
