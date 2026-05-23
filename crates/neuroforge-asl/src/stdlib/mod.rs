use crate::types::asl_types::AslProgram;
use crate::parser::asl_parser::AslPestParser;
use crate::parser::asl_builder::AslBuilder;
use crate::parser::asl_parser::Rule;
use pest::Parser;

pub fn load_standard_library() -> Result<AslProgram, String> {
    let source = include_str!("stdlib.toon");
    let parsed = AslPestParser::parse(Rule::asl_document, source)
        .map_err(|e| format!("Pest parser failed on stdlib.toon: {}", e))?;
    let pair = parsed.into_iter().next().ok_or_else(|| "No parse pairs found in stdlib.toon".to_string())?;
    let toon_prog = AslBuilder::build_program(pair)?;
    let mut program = AslProgram::from(toon_prog);
    program.metadata.name = Some("st-standard-library".to_string());
    Ok(program)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_stdlib() {
        let prog = load_standard_library().expect("Failed to load standard library");
        let time_unit = prog.globals.iter().find(|g| g.name == "TIME_UNIT").expect("TIME_UNIT not found");
        assert_eq!(time_unit.scope, "const");
        
        let routine_names: std::collections::HashSet<String> = prog.functions.iter().map(|f| f.name.clone()).collect();
        assert!(routine_names.contains("TON"));
        assert!(routine_names.contains("TOF"));
        assert!(routine_names.contains("TP"));
        assert!(routine_names.contains("TONR"));
        assert!(routine_names.contains("CTU"));
        assert!(routine_names.contains("CTD"));
        assert!(routine_names.contains("R_TRIG"));
        assert!(routine_names.contains("F_TRIG"));
        assert!(routine_names.contains("SET"));
        assert!(routine_names.contains("RESET"));
        assert!(routine_names.contains("IN_RANGE"));
        assert!(routine_names.contains("compute_PID"));
    }
}
