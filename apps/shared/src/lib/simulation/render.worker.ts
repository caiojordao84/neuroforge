/// <reference lib="webworker" />

/**
 * sim-renderer.worker.ts
 * 
 * Layer 2: OffscreenCanvas Renderer
 * Runs completely detached from Svelte (Layer 1).
 * Draws simulation states (wire colors, LED glows) reading 
 * from the SharedArrayBuffer at 60fps.
 */

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let buffer: SharedArrayBuffer | null = null;
let stateArray: Uint8Array | null = null;

// The color config received from SchemaSmith definitions via UI
let edgeColors: Record<string, string> = {
    default: "#6B7280"
};

// Edge routing coordinates parsed from UI
// This is a naive structure; UI will sync these when layout changes
interface ScreenEdge {
    id: string;
    type: string; // e.g. "digital", "power", "i2c"
    path: Path2D; // Precompiled SVG path from UI
    // Where this edge is mapped in the SAB
    bufferIndex: number;
}
let edges: ScreenEdge[] = [];

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            canvas = payload.canvas;
            buffer = payload.buffer;
            
            if (canvas && buffer) {
                ctx = canvas.getContext('2d');
                stateArray = new Uint8Array(buffer);
                requestAnimationFrame(renderLoop);
            }
            break;

        case 'RESIZE':
            if (canvas) {
                canvas.width = payload.width;
                canvas.height = payload.height;
            }
            break;

        case 'UPDATE_COLORS':
            payload.colors.forEach((c: any) => {
                edgeColors[c.key] = c.hex;
            });
            break;

        case 'SYNC_GEOMETRY':
            // Receive paths of edges dynamically from SvelteFlow
            edges = payload.edges.map((edgeInfo: any) => ({
                id: edgeInfo.id,
                type: edgeInfo.type || 'digital',
                path: new Path2D(edgeInfo.svgPath), // Construct Path2D to render in canvas
                bufferIndex: edgeInfo.bufferIndex ?? 0
            }));
            break;
    }
};

function renderLoop() {
    if (!ctx || !canvas || !stateArray) return;

    // Clear frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set styling defaults
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3; // Wire width

    // Render edges matching their voltage/logic level state
    for (const edge of edges) {
        // Evaluate SAB state mapping for this edge
        // In this MVP, stateArray[bufferIndex] holds a voltage state or logic state:
        // 0 = LOW/OFF (default color), 1 = HIGH/ON (brighter color)
        const isActive = stateArray[edge.bufferIndex] > 0;
        
        const baseColor = edgeColors[edge.type] || edgeColors.default;
        
        ctx.strokeStyle = baseColor;
        ctx.globalAlpha = isActive ? 1.0 : 0.3; // Glow up on HIGH
        
        // Draw path
        ctx.stroke(edge.path);

        // Optional: Draw glow effect if active
        if (isActive) {
            ctx.save();
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 8;
            ctx.globalAlpha = 0.2;
            ctx.filter = 'blur(4px)';
            ctx.stroke(edge.path);
            ctx.restore();
        }
    }

    requestAnimationFrame(renderLoop);
}
