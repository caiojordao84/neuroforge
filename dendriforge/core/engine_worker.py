import asyncio
import time
import neuroforge_core.sim as sim
import neuroforge_core.compiler as compiler

async def run_simulation_example():
    # Ultra-fast native transpilation example
    st_code = 'PROGRAM Main\n  VAR\n    Counter : INT := 0;\n  END_VAR\nEND_PROGRAM'
    python_code = compiler.cross_transpile(st_code, "st", "python")
    print(f"Transpiled structured text: {python_code}")

    # Single instantiation of the stateful Executor in Rust memory
    executor = sim.AslExecutor(board="arduino-uno")
    
    # Load TOON configuration
    toon_json = '{"nodes": [{"id": "led-pin13", "component_type": "LED"}]}'
    loaded = executor.load_toon(toon_json)
    print(f"TOON configuration loaded: {loaded}")

    # Concurrent ticking with GIL release
    async def tick_simulation():
        # .step() is an I/O-bound offload in Rust, hence executed via asyncio.to_thread
        deltas = await asyncio.to_thread(executor.step, '{"inputs": []}')
        print(f"Tick cycle output: {deltas}")

    await asyncio.gather(tick_simulation(), tick_simulation())

if __name__ == "__main__":
    asyncio.run(run_simulation_example())
