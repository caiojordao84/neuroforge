
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { LucideWifi, LucideMonitor, LucideTv, LucideMove, LucideDroplets, LucideThermometer, LucideGamepad2, LucideCompass, LucideGrid3x3, LucidePalette } from 'lucide-react';

export const SimulatorBoard = ({ boardConfig, pins, logs, tones, lcd, dht, ultrasonic, ldr, ir, rgb, sevseg, neopixels, motors, mpu, oled, wifi, files, onPinChange, onDhtChange, onUltrasonicChange, onLdrChange, onIrPress, onKeyPress, onMpuChange }: any) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const joystickRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);

    // Derived pins for components
    const joystickPins = useMemo(() => {
        const analogPins = boardConfig?.gpio.filter((g: any) => g.type === 'analog') || [];
        return {
            x: analogPins[0]?.pin || 34,
            y: analogPins[1]?.pin || 35
        };
    }, [boardConfig]);

    // OLED Render
    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 128, 64);
            ctx.fillStyle = '#0ff'; // Cyan OLED color
            // Draw dummy pixels or text from cheat channel
            if (oled && (oled as any).lastText) {
                const { text, x, y } = (oled as any).lastText;
                ctx.font = '10px monospace';
                ctx.fillText(text, x, y + 10);
            }
        }
    }, [oled]);

    // Joystick Handler
    const handleJoystick = useCallback((e: React.MouseEvent) => {
        if (e.buttons !== 1 || !joystickRef.current) return;
        const rect = joystickRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
        const y = Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100));
        // Map 0-100 to 0-4095
        onPinChange(joystickPins.x, Math.floor(x * 40.95));
        onPinChange(joystickPins.y, Math.floor((100 - y) * 40.95)); // Y is usually inverted
    }, [onPinChange, joystickPins]);

    const resetJoystick = () => {
        onPinChange(joystickPins.x, 2048);
        onPinChange(joystickPins.y, 2048);
    };

    return (
        <div className="flex flex-col h-full bg-slate-200/50">
            <div className="flex-1 p-6 relative overflow-y-auto">
                <div className="bg-emerald-800 rounded-lg p-6 shadow-2xl border-4 border-emerald-900 relative min-w-[500px]">
                    <div className="absolute top-2 left-4 text-xs text-emerald-100/50 font-mono italic">{boardConfig?.name || 'ESP32-SIM'}</div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* LEFT COLUMN */}
                        <div className="space-y-6">
                            {/* WIFI WIDGET */}
                            <div className="absolute top-4 right-4 bg-slate-900/80 p-2 rounded flex items-center gap-2 border border-slate-600">
                                <LucideWifi size={16} className={wifi.status === 3 ? "text-green-400" : wifi.status === 1 ? "text-yellow-400 animate-pulse" : "text-slate-600"} />
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold">WiFi</span>
                                    <span className="text-[10px] text-white font-mono">{wifi.status === 3 ? wifi.ip : wifi.status === 1 ? 'Connecting...' : 'Disconnected'}</span>
                                </div>
                            </div>

                            {/* LCD */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucideMonitor size={12} className="inline mr-1" /> I2C LCD (0x27)</h4>
                                <div className="bg-[#9ea72e] p-2 rounded border-4 border-slate-700 font-mono text-sm shadow-inner text-slate-900 leading-none h-[60px] w-full flex flex-col justify-center">
                                    <pre className="whitespace-pre">{lcd.lines[0]}</pre>
                                    <pre className="whitespace-pre">{lcd.lines[1]}</pre>
                                </div>
                            </div>

                            {/* OLED */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucideTv size={12} className="inline mr-1" /> OLED (SSD1306)</h4>
                                <div className="bg-black p-2 rounded border-4 border-slate-700 w-fit mx-auto">
                                    <canvas ref={canvasRef} width={128} height={64} className="w-[128px] h-[64px] bg-black"></canvas>
                                </div>
                            </div>

                            {/* MOTORS */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucideMove size={12} className="inline mr-1" /> DC Motors</h4>
                                <div className="flex justify-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-emerald-700/50">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-12 h-12 rounded-full border-4 border-dashed border-slate-400 ${motors.left !== 0 ? 'animate-spin' : ''}`} style={{ animationDuration: `${1000 / Math.abs(motors.left || 1)}s`, animationDirection: motors.left > 0 ? 'normal' : 'reverse' }}></div>
                                        <span className="text-xs text-slate-400 mt-1">L: {motors.left}</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className={`w-12 h-12 rounded-full border-4 border-dashed border-slate-400 ${motors.right !== 0 ? 'animate-spin' : ''}`} style={{ animationDuration: `${1000 / Math.abs(motors.right || 1)}s`, animationDirection: motors.right > 0 ? 'normal' : 'reverse' }}></div>
                                        <span className="text-xs text-slate-400 mt-1">R: {motors.right}</span>
                                    </div>
                                </div>
                            </div>

                            {/* DIGITAL PINS (LEDs) */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucidePalette size={12} className="inline mr-1" /> Digital Pins (LEDs)</h4>
                                <div className="grid grid-cols-7 gap-2 bg-slate-900/50 p-3 rounded-lg border border-emerald-700/50">
                                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(p => (
                                        <div key={p} className="flex flex-col items-center gap-1">
                                            <div className={`w-4 h-4 rounded-full border border-slate-700 shadow-sm transition-all duration-100 ${pins[p] ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-800'}`}></div>
                                            <span className="text-[8px] text-slate-400 font-mono">{p}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* DHT */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucideDroplets size={12} className="inline mr-1" /> DHT11 Sensor</h4>
                                <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-700/50 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <LucideThermometer size={16} className="text-red-400" />
                                        <input type="range" min="-10" max="50" value={dht.temp} onChange={(e) => onDhtChange(parseInt(e.target.value), dht.hum)} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-400" />
                                        <span className="text-xs text-red-200 w-8 text-right">{dht.temp}°C</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <LucideDroplets size={16} className="text-blue-400" />
                                        <input type="range" min="0" max="100" value={dht.hum} onChange={(e) => onDhtChange(dht.temp, parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-400" />
                                        <span className="text-xs text-blue-200 w-8 text-right">{dht.hum}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="space-y-6">
                            {/* JOYSTICK */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucideGamepad2 size={12} className="inline mr-1" /> Joystick ({joystickPins.x},{joystickPins.y})</h4>
                                <div
                                    ref={joystickRef}
                                    className="bg-slate-900/50 p-2 rounded-full w-24 h-24 border border-slate-600 mx-auto relative cursor-move"
                                    onMouseMove={handleJoystick}
                                    onMouseLeave={resetJoystick}
                                    onMouseUp={resetJoystick}
                                >
                                    <div className="absolute w-8 h-8 bg-slate-400 rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ left: `${(pins[joystickPins.x] / 4095) * 100}%`, top: `${(1 - pins[joystickPins.y] / 4095) * 100}%` }}></div>
                                </div>
                                <div className="text-center text-[10px] text-slate-400 font-mono">X: {pins[joystickPins.x]} Y: {pins[joystickPins.y]}</div>
                            </div>

                            {/* MPU6050 */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucideCompass size={12} className="inline mr-1" /> MPU6050 (Tilt)</h4>
                                <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-700/50 flex gap-4">
                                    <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center perspective-[500px]">
                                        <div className="w-8 h-8 bg-blue-500 border border-blue-300 transition-transform duration-100" style={{ transform: `rotateX(${mpu.ax}deg) rotateY(${mpu.ay}deg)` }}></div>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 w-4">X</span>
                                            <input type="range" min="-90" max="90" value={mpu.ax} onChange={(e) => onMpuChange({ ...mpu, ax: parseInt(e.target.value) })} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-400" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 w-4">Y</span>
                                            <input type="range" min="-90" max="90" value={mpu.ay} onChange={(e) => onMpuChange({ ...mpu, ay: parseInt(e.target.value) })} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 7-SEGMENT */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucideGrid3x3 size={12} className="inline mr-1" /> TM1637 Display</h4>
                                <div className="bg-black p-2 rounded border-4 border-slate-700 flex justify-center items-center h-[50px]">
                                    <span className="font-mono text-3xl text-red-600 font-bold tracking-[0.2em] drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]">
                                        {sevseg || '----'}
                                    </span>
                                </div>
                            </div>

                            {/* NEOPIXEL */}
                            <div className="space-y-2">
                                <h4 className="text-emerald-100 text-xs font-bold uppercase tracking-wider"><LucidePalette size={12} className="inline mr-1" /> Neopixel Strip</h4>
                                <div className="bg-slate-900/50 p-2 rounded flex justify-between gap-1">
                                    {neopixels.map((p: any, i: number) => (
                                        <div key={i} className="w-8 h-8 rounded-full border border-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-colors duration-200"
                                            style={{ backgroundColor: `rgb(${p.r}, ${p.g}, ${p.b})`, boxShadow: `0 0 8px rgb(${p.r}, ${p.g}, ${p.b})` }}>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
