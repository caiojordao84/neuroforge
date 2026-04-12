use std::collections::HashMap;
use crate::asl_types::AslProgram;

/// Mapeamento de linha gerada -> linha fonte.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceMapEntry {
    pub generated_line: u32,
    pub source_line: u32,
}

/// Saida unificada de geracao de codigo.
#[derive(Debug, Clone)]
pub struct GeneratorOutput {
    pub code: String,
    pub map: Vec<SourceMapEntry>,
    pub files: Option<HashMap<String, String>>,
}

impl GeneratorOutput {
    pub fn new(code: String) -> Self {
        Self {
            code,
            map: vec![],
            files: None,
        }
    }

    pub fn with_files(mut self, files: HashMap<String, String>) -> Self {
        self.files = Some(files);
        self
    }
}

/// A trait that all language generators should implement.
pub trait AslGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput;
}
