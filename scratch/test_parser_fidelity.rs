use neuroforge_asl::parser::python::python_parser::PythonParser;
use neuroforge_asl::parser::neuro_parser::NeuroParser;

fn main() {
    let py_code = r#"
H = 300
M = 20
L = 5

dists = [10, 20, 10, 20, 10]
u = sum(dists) / len(dists)
n = H - u
"#;
    let program = PythonParser::parse(py_code).expect("Python parse failed");
    for stmt in program.setup {
        println!("{:?}", stmt);
    }
}
