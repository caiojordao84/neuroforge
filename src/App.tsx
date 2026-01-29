import React, { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

// Components
import { LeftSidebar } from '@/components/LeftSidebar';
import { FloatingWindow } from '@/components/FloatingWindow';
import { CodeEditorWithTabs } from '@/components/CodeEditorWithTabs';
import { ComponentsLibrary } from '@/components/ComponentsLibrary';
import { SerialMonitor } from '@/components/SerialMonitor';
import { Terminal } from '@/components/Terminal';
import { CanvasArea } from '@/components/CanvasArea';
import { TopToolbar } from '@/components/TopToolbar';

// Stores
import { useSerialStore } from '@/stores/useSerialStore';

// Styles
import './App.css';

// Initialize app
const AppInitializer: React.FC = () => {
  const { addTerminalLine } = useSerialStore();

  useEffect(() => {
    // Welcome message
    addTerminalLine('🚀 NeuroForge initialized', 'success');
    addTerminalLine('📟 Ready to simulate', 'info');
    addTerminalLine('💡 Tip: Open the Code Editor to start programming', 'info');
  }, [addTerminalLine]);

  return null;
};

// Main app content
const AppContent: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0e14] text-[#e6e6e6] font-sans overflow-hidden">
      {/* Top Toolbar */}
      <TopToolbar />

      {/* Left Sidebar */}
      <LeftSidebar />

      {/* Main Canvas Area */}
      <main className="fixed left-[60px] top-14 right-0 bottom-0">
        <CanvasArea />
      </main>

      {/* Floating Windows */}
      <FloatingWindow windowId="codeEditor" minWidth={500} minHeight={400}>
        <CodeEditorWithTabs />
      </FloatingWindow>

      <FloatingWindow windowId="componentsLibrary" minWidth={250} minHeight={350}>
        <ComponentsLibrary />
      </FloatingWindow>

      <FloatingWindow windowId="serialMonitor" minWidth={400} minHeight={250}>
        <SerialMonitor />
      </FloatingWindow>

      <FloatingWindow windowId="terminal" minWidth={400} minHeight={250}>
        <Terminal />
      </FloatingWindow>

      {/* App Initializer */}
      <AppInitializer />
    </div>
  );
};

// Main App with providers
function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}

export default App;
