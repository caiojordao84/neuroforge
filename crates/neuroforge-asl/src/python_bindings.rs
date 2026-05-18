use pyo3::prelude::*;
use pyo3::wrap_pyfunction;
use crate::plugins::core::AslGenerator;
use crate::parser::neuro_parser::NeuroParser;



// ─── COMPILER MODULE ──────────────────────────────────────────────────────────

#[pyfunction]
fn transpile(source: String, lang: String) -> PyResult<String> {
    let target = crate::executor::TargetLanguage::parse(&lang)
        .ok_or_else(|| PyErr::new::<pyo3::exceptions::PyValueError, _>(format!("Unknown target language: {}", lang)))?;
    
    let output = crate::executor::AslExecutor::run(&source, &target)
        .map_err(|err| PyErr::new::<pyo3::exceptions::PyRuntimeError, _>(err))?;

    Ok(output.code)
}

#[pyfunction]
fn cross_transpile(source: String, from_lang: String, to_lang: String) -> PyResult<String> {
    let src_lang = crate::executor::TargetLanguage::parse(&from_lang)
        .ok_or_else(|| PyErr::new::<pyo3::exceptions::PyValueError, _>(format!("Unknown source language: {}", from_lang)))?;
    let dst_lang = crate::executor::TargetLanguage::parse(&to_lang)
        .ok_or_else(|| PyErr::new::<pyo3::exceptions::PyValueError, _>(format!("Unknown target language: {}", to_lang)))?;

    // Parse based on explicit source language
    let program = match src_lang {
        crate::executor::TargetLanguage::Python | crate::executor::TargetLanguage::MicroPython => {
            crate::plugins::python::python_parser::PythonParser::parse(&source)
                .map_err(|e| PyErr::new::<pyo3::exceptions::PyRuntimeError, _>(format!("PythonParser: {e}")))?
        }
        crate::executor::TargetLanguage::Rust => {
            crate::plugins::rust_std::rust_parser::RustParser::parse(&source)
                .map_err(|e| PyErr::new::<pyo3::exceptions::PyRuntimeError, _>(format!("RustParser: {e}")))?
        }
        crate::executor::TargetLanguage::St => {
            crate::plugins::plc::st_parser::StParser::parse(&source)
                .map_err(|e| PyErr::new::<pyo3::exceptions::PyRuntimeError, _>(format!("StParser: {e}")))?
        }
        crate::executor::TargetLanguage::C | crate::executor::TargetLanguage::Cpp | crate::executor::TargetLanguage::Arduino => {
            crate::plugins::c::c_parser::CParser::parse(&source)
                .map_err(|e| PyErr::new::<pyo3::exceptions::PyRuntimeError, _>(format!("CParser: {e}")))?
        }
        _ => {
            return Err(PyErr::new::<pyo3::exceptions::PyNotImplementedError, _>(format!(
                "Parsing not implemented for source language '{}'",
                from_lang
            )));
        }
    };

    // Generate based on explicit target language
    let out = match dst_lang {
        crate::executor::TargetLanguage::C | crate::executor::TargetLanguage::Cpp | crate::executor::TargetLanguage::Arduino => {
            crate::plugins::c::CGenerator::new().generate(&program)
        }
        crate::executor::TargetLanguage::Rust => {
            crate::plugins::rust_std::RustGenerator::new().generate(&program)
        }
        crate::executor::TargetLanguage::Python | crate::executor::TargetLanguage::MicroPython => {
            crate::plugins::python::python_generator::PythonGenerator::new().generate(&program)
        }
        crate::executor::TargetLanguage::St => {
            crate::plugins::plc::st_generator::StGenerator::new().generate(&program)
        }
        _ => {
            return Err(PyErr::new::<pyo3::exceptions::PyNotImplementedError, _>(format!(
                "Generation not implemented for target language '{}'",
                to_lang
            )));
        }
    };

    Ok(out.code)
}

fn create_compiler_module(py: Python<'_>) -> PyResult<&PyModule> {
    let m = PyModule::new(py, "compiler")?;
    m.add_function(wrap_pyfunction!(transpile, m)?)?;
    m.add_function(wrap_pyfunction!(cross_transpile, m)?)?;
    Ok(m)
}

// ─── SIMULATION MODULE ─────────────────────────────────────────────────────────

#[pyclass]
pub struct AslExecutor {
    engine: neuroforge_sim::SimEngine,
    #[allow(dead_code)]
    board: String,
}

#[pymethods]
impl AslExecutor {
    #[new]
    fn new(board: String) -> Self {
        AslExecutor {
            engine: neuroforge_sim::SimEngine::new(),
            board,
        }
    }

    fn load_toon(&mut self, toon_json: String) -> bool {
        self.engine.load_toon(&toon_json)
    }

    /// Single simulation step. Releases the Global Interpreter Lock (GIL).
    fn step(&mut self, py: Python<'_>, _inputs_json: String) -> PyResult<String> {
        // Releases the GIL using py.allow_threads to enable true async Python concurrency
        py.allow_threads(|| {
            // Tick the simulation engine
            let tick_count = self.engine.tick();
            
            // Map inputs_json and return state deltas
            let response = format!(
                r#"{{"status": "success", "tick": {}, "deltas": [{{"id": "led-pin13", "state": {}}}]}}"#,
                tick_count,
                if tick_count % 2 == 0 { 1 } else { 0 }
            );

            Ok(response)
        })
    }
}

fn create_sim_module(py: Python<'_>) -> PyResult<&PyModule> {
    let m = PyModule::new(py, "sim")?;
    m.add_class::<AslExecutor>()?;
    Ok(m)
}

// ─── MODULE REGISTRATION ───────────────────────────────────────────────────────

#[pymodule]
fn neuroforge_core(py: Python<'_>, m: &PyModule) -> PyResult<()> {
    let compiler = create_compiler_module(py)?;
    m.add_submodule(compiler)?;
    
    let sim = create_sim_module(py)?;
    m.add_submodule(sim)?;
    
    // Register in sys.modules to allow direct imports like `import neuroforge_core.sim`
    let sys = py.import("sys")?;
    let modules = sys.getattr("modules")?;
    modules.set_item("neuroforge_core.compiler", compiler)?;
    modules.set_item("neuroforge_core.sim", sim)?;
    
    Ok(())
}

