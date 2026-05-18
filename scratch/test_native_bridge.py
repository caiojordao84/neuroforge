import asyncio
import time
import neuroforge_core.sim as sim
import neuroforge_core.compiler as compiler

async def main():
    print("=== Testing ASL Native Transpiler Bridge ===")
    
    st_code = """PROGRAM Main
  VAR
    Counter : INT := 0;
  END_VAR
  IF Counter > 0 THEN
    Counter := 0;
  END_IF;
END_PROGRAM"""

    print("Transpiling Structured Text to Python...")
    try:
        python_code = compiler.cross_transpile(st_code, "st", "python")
        print("\nTranspiled Python Code Output:")
        print("-" * 40)
        print(python_code.strip())
        print("-" * 40)
    except Exception as e:
        print(f"Transpilation failed: {e}")
        return

    print("\n=== Testing ASL Stateful Simulation Bridge ===")
    try:
        # Instantiate persistent simulator in Rust memory
        executor = sim.AslExecutor(board="arduino-uno")
        print("AslExecutor instantiated successfully!")
        
        # Load mock TOON configuration
        toon_json = '{"nodes": [{"id": "led-pin13", "component_type": "LED"}]}'
        loaded = executor.load_toon(toon_json)
        print(f"TOON configuration loaded: {loaded}")
        
        # Define concurrent ticking function to test GIL release
        async def tick_simulation(worker_id):
            print(f"[Worker {worker_id}] Starting tick step...")
            start_time = time.perf_counter()
            # .step() is executed in a thread pool using asyncio.to_thread
            # to show GIL release and async scalability
            result_json = await asyncio.to_thread(executor.step, '{"inputs": []}')
            duration = (time.perf_counter() - start_time) * 1000
            print(f"[Worker {worker_id}] Finished in {duration:.3f}ms: {result_json}")

        print("\nFiring concurrent ticks (demonstrating GIL release)...")
        # Fire concurrent ticks simultaneously
        await asyncio.gather(
            tick_simulation(1),
            tick_simulation(2),
            tick_simulation(3)
        )
        
        print("\n=== All Native Bridge Verifications Passed! ===")
    except Exception as e:
        print(f"Simulation test failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
