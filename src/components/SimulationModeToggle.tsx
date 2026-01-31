import { useQEMUStore } from '@/store/useQEMUStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';

/**
 * Toggle between Fake and QEMU Real simulation modes
 */
export function SimulationModeToggle() {
  const { 
    mode, 
    setMode, 
    isBackendConnected,
    isWebSocketConnected 
  } = useQEMUStore();

  const handleToggle = (checked: boolean) => {
    setMode(checked ? 'qemu' : 'fake');
  };

  const getStatusIcon = () => {
    if (mode === 'fake') {
      return null;
    }

    if (!isBackendConnected) {
      return <WifiOff className="w-3 h-3 text-red-500" />;
    }

    if (isWebSocketConnected) {
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    }

    return <AlertCircle className="w-3 h-3 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (mode === 'fake') {
      return 'Interpreter';
    }

    if (!isBackendConnected) {
      return 'Backend Offline';
    }

    if (isWebSocketConnected) {
      return 'QEMU Connected';
    }

    return 'Connecting...';
  };

  const getTooltipText = () => {
    if (mode === 'fake') {
      return 'Using JavaScript interpreter (fast, limited features)';
    }

    if (!isBackendConnected) {
      return 'QEMU backend is not running. Start server: cd server && npm run dev';
    }

    if (isWebSocketConnected) {
      return 'Connected to QEMU backend (real AVR emulation)';
    }

    return 'Connecting to QEMU backend...';
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 px-3 py-2 bg-[#1a1a1a] rounded-lg border border-[#333]">
        <div className="flex items-center gap-2">
          <Label htmlFor="qemu-mode" className="text-xs text-[#9ca3af] cursor-pointer">
            Simulation:
          </Label>
          <Switch
            id="qemu-mode"
            checked={mode === 'qemu'}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-[#00d9ff]"
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`
                flex items-center gap-1.5 text-xs font-normal
                ${mode === 'fake' 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                  : !isBackendConnected
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : isWebSocketConnected
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                }
              `}
            >
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
