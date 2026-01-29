import React, { useMemo } from 'react';
import { getSmoothStepPath, type EdgeProps, EdgeLabelRenderer } from '@xyflow/react';
import { cn } from '@/lib/utils';

// Wire color coding based on connection type
const getWireColor = (sourceHandle?: string | null, targetHandle?: string | null): string => {
  // Power wires (5V, VIN) - Red
  if (sourceHandle?.includes('5V') || targetHandle?.includes('5V') || 
      sourceHandle?.includes('VIN') || targetHandle?.includes('VIN')) {
    return '#ff4444';
  }
  
  // Ground wires - Black/Dark Gray
  if (sourceHandle?.includes('GND') || targetHandle?.includes('GND')) {
    return '#444444';
  }
  
  // Analog pins - Yellow
  if (sourceHandle?.includes('A') || targetHandle?.includes('A')) {
    return '#ffd600';
  }
  
  // PWM pins - Orange
  if (sourceHandle?.includes('PWM') || targetHandle?.includes('PWM')) {
    return '#ff8800';
  }
  
  // Digital pins - Cyan (default)
  return '#00d9ff';
};

// Get wire thickness based on type
const getWireThickness = (sourceHandle?: string | null, targetHandle?: string | null): number => {
  // Power and ground wires are thicker
  if (sourceHandle?.includes('5V') || targetHandle?.includes('5V') ||
      sourceHandle?.includes('GND') || targetHandle?.includes('GND') ||
      sourceHandle?.includes('VIN') || targetHandle?.includes('VIN')) {
    return 3;
  }
  return 2;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ManhattanEdgeData extends Record<string, unknown> {
  label?: string;
  isActive?: boolean;
  voltage?: number;
}

export const ManhattanEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  data,
  selected,
}) => {
  const wireColor = useMemo(() => 
    getWireColor(sourceHandleId, targetHandleId),
    [sourceHandleId, targetHandleId]
  );
  
  const wireThickness = useMemo(() => 
    getWireThickness(sourceHandleId, targetHandleId),
    [sourceHandleId, targetHandleId]
  );

  // Use smooth step path for Manhattan routing (orthogonal)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: 20,
  });

  const edgeData = data as ManhattanEdgeData | undefined;
  const isActive = edgeData?.isActive ?? false;
  const label = edgeData?.label;

  return (
    <>
      {/* Base wire */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={wireColor}
        strokeWidth={wireThickness}
        className={cn(
          'transition-all duration-200',
          selected && 'filter drop-shadow-[0_0_4px_rgba(0,217,255,0.8)]'
        )}
        style={{
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />
      
      {/* Active indicator (glow effect when signal is passing) */}
      {isActive && (
        <path
          d={edgePath}
          fill="none"
          stroke={wireColor}
          strokeWidth={wireThickness + 2}
          className="animate-pulse opacity-50"
          style={{
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            filter: `drop-shadow(0 0 6px ${wireColor})`,
          }}
        />
      )}
      
      {/* Selection highlight */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#ffffff"
          strokeWidth={wireThickness + 2}
          className="opacity-30"
          style={{
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        />
      )}

      {/* Label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={cn(
              'nodrag nopan',
              'px-2 py-0.5 rounded text-[10px]',
              'bg-[#151b24] border border-[rgba(0,217,255,0.3)]',
              'text-[#e6e6e6]'
            ) as string}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Wire type indicator dot */}
      <circle
        cx={(sourceX + targetX) / 2}
        cy={(sourceY + targetY) / 2}
        r={4}
        fill={wireColor}
        className={cn(
          'transition-all duration-200',
          isActive && 'animate-ping'
        )}
      />
    </>
  );
};

export default ManhattanEdge;
