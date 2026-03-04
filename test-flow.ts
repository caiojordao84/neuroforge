import { flowToASL } from './src/engine/asl/flowToASL';
import { ASLProgram } from './src/engine/asl/ASLTypes';

const nodes = [
    {
        id: 'start-1',
        type: 'start',
        data: { label: 'Start' },
        position: { x: 0, y: 0 }
    },
    {
        id: 'timer-1',
        type: 'ladder_timer',
        data: {
            id: 'T1',
            preset: 2000,
            variable: 'true',
            subType: 'TON'
        },
        position: { x: 0, y: 100 }
    },
    {
        id: 'latch-1',
        type: 'ladder_latch',
        data: {
            id: 'L1',
            setVar: 'T1_done', // We wait for timer to finish
            resetVar: 'false',
            subType: 'SR' // Set Dominant
        },
        position: { x: 0, y: 200 }
    },
    {
        id: 'coil-1',
        type: 'ladder_coil',
        data: { pin: 13, label: 'LED' },
        position: { x: 0, y: 300 }
    }
];

const edges = [
    { id: 'e1', source: 'start-1', target: 'timer-1' },
    { id: 'e2', source: 'timer-1', target: 'latch-1' },
    { id: 'e3', source: 'latch-1', target: 'coil-1' }
];

console.log("=== Generating ASL Program from Flow ===");
const program: ASLProgram = flowToASL(nodes as any, edges as any);

console.log("\n== Globals ==");
Object.keys(program.globals).forEach(k => {
    console.log(`- ${k}: ${JSON.stringify(program.globals[k])}`);
});

console.log("\n== Logic Functions ==");
program.functions.forEach((f) => {
    console.log(`Function ${f.name}:`);
    console.log(JSON.stringify(f.body, null, 2));
});

console.log("\n== Logic Tasks ==");
program.tasks.forEach((t) => {
    console.log(`Task ${t.name}:`);
    console.log(JSON.stringify(t.body, null, 2));
});
