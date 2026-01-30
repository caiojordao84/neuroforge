import React from 'react';
import {
  Code,
  Cpu,
  Terminal,
  Zap,
  PanelTopOpen,
  Book,
} from 'lucide-react';
import { useUIStore, type WindowId } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

interface SidebarTab {
  id: WindowId;
  icon: React.ElementType;
  label: string;
}

const tabs: SidebarTab[] = [
  { id: 'codeEditor', icon: Code, label: 'Code Editor' },
  { id: 'componentsLibrary', icon: Cpu, label: 'Components' },
  { id: 'libraries', icon: Book, label: 'Libraries' },
  { id: 'properties', icon: PanelTopOpen, label: 'Properties' },
  { id: 'serialMonitor', icon: Terminal, label: 'Serial Monitor' },
  { id: 'terminal', icon: Zap, label: 'Terminal' },
];

export const LeftSidebar: React.FC = () => {
  const { windows, toggleWindow, openWindow } = useUIStore();

  const handleTabClick = (tabId: WindowId) => {
    const window = windows[tabId];
    if (window?.isOpen) {
      // If already open, just bring to front or minimize
      if (window.isMinimized) {
        openWindow(tabId);
      } else {
        toggleWindow(tabId);
      }
    } else {
      openWindow(tabId);
    }
  };

  return (
    <div
      className={cn(
        'fixed left-0 top-0 h-full w-[60px]',
        'bg-[#0a0e14] border-r border-[rgba(0,217,255,0.2)]',
        'flex flex-col items-center py-4 z-50',
        'shadow-lg shadow-black/30'
      )}
    >
      {/* Logo */}
      <div className="mb-6">
        <div
          className={cn(
            'w-10 h-10 rounded-lg',
            'bg-gradient-to-br from-[#00d9ff] to-[#0088cc]',
            'flex items-center justify-center',
            'shadow-lg shadow-[#00d9ff]/20'
          )}
        >
          <Zap className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const window = windows[tab.id];
          // Use optional chaining carefully - defaultWindows usually has all keys but persistence might mess it up temporarily if schema changed
          const isOpen = window?.isOpen || false;
          const isMinimized = window?.isMinimized || false;
          const isActive = isOpen && !isMinimized;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                'group relative w-12 h-12 rounded-lg',
                'flex items-center justify-center',
                'transition-all duration-200',
                'hover:bg-[rgba(0,217,255,0.1)]',
                isActive
                  ? 'bg-[rgba(0,217,255,0.15)] border-2 border-[#ffd600]'
                  : 'border-2 border-transparent'
              )}
              title={tab.label}
            >
              <Icon
                className={cn(
                  'w-5 h-5 transition-colors',
                  isActive
                    ? 'text-[#00d9ff]'
                    : 'text-[#9ca3af] group-hover:text-[#00d9ff]'
                )}
              />

              {/* Tooltip */}
              <div
                className={cn(
                  'absolute left-full ml-2 px-2 py-1 rounded',
                  'bg-[#151b24] border border-[rgba(0,217,255,0.3)]',
                  'text-[#e6e6e6] text-xs whitespace-nowrap',
                  'opacity-0 group-hover:opacity-100',
                  'pointer-events-none transition-opacity',
                  'z-50'
                )}
              >
                {tab.label}
              </div>

              {/* Active indicator dot */}
              {isOpen && (
                <div
                  className={cn(
                    'absolute -top-0.5 -right-0.5',
                    'w-2.5 h-2.5 rounded-full',
                    isMinimized ? 'bg-yellow-500' : 'bg-green-500',
                    'border-2 border-[#0a0e14]'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="mt-auto">
        <div
          className={cn(
            'w-8 h-8 rounded-full',
            'bg-[#151b24] border border-[rgba(0,217,255,0.3)]',
            'flex items-center justify-center'
          )}
        >
          <span className="text-[#00d9ff] text-xs font-bold">NF</span>
        </div>
      </div>
    </div>
  );
};

export default LeftSidebar;
