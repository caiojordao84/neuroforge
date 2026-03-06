import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, Minus, Maximize2, Square, ArrowUpRight } from 'lucide-react';
import { useUIStore, type WindowId } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

interface FloatingWindowProps {
  windowId: WindowId;
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

const SIDEBAR_WIDTH = 60;
const HEADER_HEIGHT = 56;

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  windowId,
  children,
  className,
  minWidth = 300,
  minHeight = 200,
  maxWidth = 1200,
  maxHeight = 800,
}) => {
  const {
    windows,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    bringToFront,
    updateWindowPosition,
    updateWindowSize,
    dockWindow,
    undockWindow,
    updateDockWidth,
  } = useUIStore();

  const windowState = windows[windowId];
  const windowRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  if (!windowState) return null;

  const { isOpen, isMinimized, isDocked, position, size, zIndex, title, dockWidth } = windowState;
  const isDockedMode = isDocked && isOpen && !isMinimized;

  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isResizingDock, setIsResizingDock] = useState(false);

  // Calculate docked dimensions
  const getDockedWidth = useCallback(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    return (dockWidth / 100) * viewportWidth;
  }, [dockWidth]);

  const dockedWidth = getDockedWidth();

  // Handle window focus
  const handleMouseDown = useCallback(() => {
    bringToFront(windowId);
  }, [bringToFront, windowId]);

  // Handle dock/undock toggle
  const handleDockToggle = useCallback(() => {
    if (isDocked) {
      undockWindow(windowId);
    } else {
      dockWindow(windowId);
    }
  }, [isDocked, dockWindow, undockWindow, windowId]);

  // Handle drag end for floating windows
  const handleDragEnd = useCallback(
    (_: unknown, info: { point: { x: number; y: number }; offset: { x: number; y: number } }) => {
      const currentX = position.x;
      const currentY = position.y;

      const newPosition = {
        x: currentX + info.offset.x,
        y: currentY + info.offset.y,
      };

      const padding = 20;
      const constrainedPosition = {
        x: Math.max(
          padding,
          Math.min(window.innerWidth - size.width - padding, newPosition.x)
        ),
        y: Math.max(
          padding,
          Math.min(window.innerHeight - size.height - padding, newPosition.y)
        ),
      };

      // Auto-undock if dragged away from docked position
      if (isDocked && (Math.abs(newPosition.x - SIDEBAR_WIDTH) > 50 || Math.abs(newPosition.y - HEADER_HEIGHT) > 50)) {
        undockWindow(windowId);
      }

      updateWindowPosition(windowId, constrainedPosition);
    },
    [updateWindowPosition, windowId, position, size, isDocked, undockWindow]
  );

  // Handle resize start (for floating windows)
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      });
    },
    [size]
  );

  // Handle dock resize start
  const handleDockResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizingDock(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: dockedWidth,
        height: 0,
      });
    },
    [dockedWidth]
  );

  // Handle resize move
  useEffect(() => {
    if (!isResizing && !isResizingDock) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.width + deltaX));
        const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStart.height + deltaY));

        updateWindowSize(windowId, { width: newWidth, height: newHeight });
      } else if (isResizingDock) {
        const deltaX = e.clientX - resizeStart.x;
        const viewportWidth = window.innerWidth;
        const newWidthPercent = Math.max(10, Math.min(50, ((resizeStart.width + deltaX) / viewportWidth) * 100));
        updateDockWidth(windowId, newWidthPercent);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsResizingDock(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isResizingDock, resizeStart, minWidth, minHeight, maxWidth, maxHeight, updateWindowSize, updateDockWidth, windowId]);

  // Don't render if window is closed
  if (!isOpen) {
    return null;
  }

  // Render minimized state
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
      >
        <div
          className={cn(
            'bg-[#151b24] border border-[rgba(0,217,255,0.3)] rounded-lg',
            'flex items-center gap-2 px-4 py-2 cursor-pointer',
            'hover:border-[#00d9ff] transition-colors'
          )}
          onClick={() => restoreWindow(windowId)}
        >
          <span className="text-[#e6e6e6] text-sm">{title}</span>
          <Maximize2 className="w-4 h-4 text-[#9ca3af]" />
        </div>
      </motion.div>
    );
  }

  // Render docked state
  if (isDockedMode) {
    return (
      <motion.div
        ref={windowRef}
        onMouseDown={handleMouseDown}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          left: isNaN(SIDEBAR_WIDTH) ? 60 : SIDEBAR_WIDTH,
          top: isNaN(HEADER_HEIGHT) ? 56 : HEADER_HEIGHT,
          width: isNaN(dockedWidth) ? 300 : dockedWidth,
          height: `calc(100% - ${(isNaN(HEADER_HEIGHT) ? 56 : HEADER_HEIGHT)}px)`,
          zIndex: zIndex,
        }}
        className={cn(
          'flex flex-col rounded-lg overflow-hidden',
          'bg-[#151b24] border border-[rgba(0,217,255,0.3)] border-l-0',
          'shadow-2xl shadow-black/50',
          'cursor-default',
          className
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between px-3 py-2',
            'bg-[#0a0e14] border-b border-[rgba(0,217,255,0.2)]',
            'select-none'
          )}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDockToggle();
              }}
              className={cn(
                'p-1 rounded hover:bg-[rgba(0,217,255,0.1)]',
                'transition-colors'
              )}
              title="Undock Window"
            >
              <ArrowUpRight className="w-4 h-4 text-[#9ca3af] hover:text-[#00d9ff]" />
            </button>
            <span className="text-[#e6e6e6] text-sm font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                minimizeWindow(windowId);
              }}
              className={cn(
                'p-1.5 rounded hover:bg-[rgba(0,217,255,0.1)]',
                'transition-colors'
              )}
            >
              <Minus className="w-4 h-4 text-[#9ca3af] hover:text-[#00d9ff]" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeWindow(windowId);
              }}
              className={cn(
                'p-1.5 rounded hover:bg-red-500/20',
                'transition-colors'
              )}
            >
              <X className="w-4 h-4 text-[#9ca3af] hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto relative">
          {children}
        </div>

        {/* Dock resize handle */}
        <div
          onMouseDown={handleDockResizeStart}
          className={cn(
            'absolute top-0 right-0 w-2 h-full cursor-ew-resize',
            'hover:bg-[#00d9ff]/50 transition-colors',
            'z-10'
          )}
          title="Resize width"
        />
      </motion.div>
    );
  }

  // Render floating state
  return (
    <motion.div
      ref={windowRef}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragSnapToOrigin={false}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed',
        left: isNaN(position.x) ? 100 : position.x,
        top: isNaN(position.y) ? 100 : position.y,
        width: isNaN(size.width) ? 600 : size.width,
        height: isNaN(size.height) ? 400 : size.height,
        zIndex: zIndex,
        willChange: 'transform',
      }}
      className={cn(
        'flex flex-col rounded-lg overflow-hidden',
        'bg-[#151b24] border border-[rgba(0,217,255,0.3)]',
        'shadow-2xl shadow-black/50',
        'cursor-default',
        className
      )}
    >
      {/* Header */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className={cn(
          'flex items-center justify-between px-3 py-2',
          'bg-[#0a0e14] border-b border-[rgba(0,217,255,0.2)]',
          'cursor-move select-none'
        )}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDockToggle();
            }}
            className={cn(
              'p-1 rounded hover:bg-[rgba(0,217,255,0.1)]',
              'transition-colors'
            )}
            title="Dock Window"
          >
            <Square className="w-4 h-4 text-[#9ca3af] hover:text-[#00d9ff]" />
          </button>
          <span className="text-[#e6e6e6] text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(windowId);
            }}
            className={cn(
              'p-1.5 rounded hover:bg-[rgba(0,217,255,0.1)]',
              'transition-colors'
            )}
          >
            <Minus className="w-4 h-4 text-[#9ca3af] hover:text-[#00d9ff]" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(windowId);
            }}
            className={cn(
              'p-1.5 rounded hover:bg-red-500/20',
              'transition-colors'
            )}
          >
            <X className="w-4 h-4 text-[#9ca3af] hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto relative">
        {children}
      </div>

      {/* Resize handle */}
      <div
        ref={resizeHandleRef}
        onMouseDown={handleResizeStart}
        className={cn(
          'absolute bottom-0 right-0 w-4 h-4 cursor-se-resize',
          'flex items-end justify-end p-0.5'
        )}
        style={{
          background: 'linear-gradient(135deg, transparent 50%, rgba(0, 217, 255, 0.3) 50%)',
        }}
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-[#00d9ff] opacity-50" />
      </div>
    </motion.div>
  );
};

export default FloatingWindow;
