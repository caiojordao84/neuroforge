import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, Minus, Maximize2 } from 'lucide-react';
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
  } = useUIStore();

  const windowState = windows[windowId];
  const windowRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Guard: if window state doesn't exist (e.g. new window type added but not in persisted storage), return null
  if (!windowState) return null;

  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Handle window focus
  const handleMouseDown = useCallback(() => {
    bringToFront(windowId);
  }, [bringToFront, windowId]);

  // Handle drag end with smooth position update
  const handleDragEnd = useCallback(
    (_: unknown, info: { point: { x: number; y: number }; offset: { x: number; y: number } }) => {
      // Calculate new position based on current position + drag offset
      const currentX = windowState.position.x;
      const currentY = windowState.position.y;

      const newPosition = {
        x: currentX + info.offset.x,
        y: currentY + info.offset.y,
      };

      // Constrain to viewport with padding
      const padding = 20;
      const constrainedPosition = {
        x: Math.max(
          padding,
          Math.min(window.innerWidth - windowState.size.width - padding, newPosition.x)
        ),
        y: Math.max(
          padding,
          Math.min(window.innerHeight - windowState.size.height - padding, newPosition.y)
        ),
      };

      updateWindowPosition(windowId, constrainedPosition);
    },
    [updateWindowPosition, windowId, windowState.position, windowState.size]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: windowState.size.width,
        height: windowState.size.height,
      });
    },
    [windowState.size]
  );

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.width + deltaX));
      const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStart.height + deltaY));

      updateWindowSize(windowId, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart, minWidth, minHeight, maxWidth, maxHeight, updateWindowSize, windowId]);

  // Don't render if window is closed
  if (!windowState.isOpen) {
    return null;
  }

  // Render minimized state
  if (windowState.isMinimized) {
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
          <span className="text-[#e6e6e6] text-sm">{windowState.title}</span>
          <Maximize2 className="w-4 h-4 text-[#9ca3af]" />
        </div>
      </motion.div>
    );
  }

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
      transition={{
        duration: 0.15
      }}
      style={{
        position: 'fixed',
        left: windowState.position.x,
        top: windowState.position.y,
        width: windowState.size.width,
        height: windowState.size.height,
        zIndex: windowState.zIndex,
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
        <span className="text-[#e6e6e6] text-sm font-medium">{windowState.title}</span>
        <div className="flex items-center gap-1">
          {/* Minimize button */}
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
          {/* Close button */}
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
