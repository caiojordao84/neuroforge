use pest_derive::Parser;
use pest::Parser;

/// The ASL Parser generated securely at compile-time by the Pest PEG grammar.
#[derive(Parser)]
#[grammar = "asl.pest"] // Links to the grammar file we just created
pub struct AslPestParser;

/// Utility function to validate syntax before building the AST
pub fn check_syntax(source_code: &str) -> Result<(), String> {
    // Attempt to parse the source string against the `asl_document` rule
    match AslPestParser::parse(Rule::asl_document, source_code) {
        Ok(_) => Ok(()),
        Err(e) => {
            // Pest provides beautiful error messages automatically!
            Err(format!("Syntax Error: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::asl_builder::AslBuilder;
    use std::fs;

    #[test]
    fn test_diagnose_each_block() {
        let path = "d:/Documents/NeuroForge/dendriForge/dendriforge/core/asl/v010/examples/basic-blink-logic.toon";
        let content = fs::read_to_string(path).expect("Failed to read");
        
        let metadata_res = AslPestParser::parse(Rule::metadata_block, &content);
        println!("Metadata Res: {:?}", metadata_res.is_ok());
        if let Ok(mut pairs) = metadata_res {
            let pair = pairs.next().unwrap();
            let span = pair.as_span();
            let remaining = &content[span.end()..];
            println!("Remaining after metadata (len {}):\n{:?}", remaining.len(), remaining);
            
            // Trim leading whitespace/newlines for parsing the next block
            let hw_res = AslPestParser::parse(Rule::hardware_block, remaining);
            println!("Hardware Res: {:?}", hw_res.is_ok());
            if let Ok(mut hw_pairs) = hw_res {
                let hw_pair = hw_pairs.next().unwrap();
                println!("Hardware Pair: {:?}", hw_pair);
                let hw_span = hw_pair.as_span();
                let remaining = &remaining[hw_span.end()..];
                println!("Remaining after hardware (len {}):\n{:?}", remaining.len(), remaining);
                
                let data_res = AslPestParser::parse(Rule::data_block, remaining);
                println!("Data Res: {:?}", data_res.is_ok());
                if let Ok(mut data_pairs) = data_res {
                    let data_pair = data_pairs.next().unwrap();
                    let data_span = data_pair.as_span();
                    let remaining = &remaining[data_span.end()..];
                    println!("Remaining after data (len {}):\n{:?}", remaining.len(), remaining);
                    
                    let routines_res = AslPestParser::parse(Rule::routines_block, remaining);
                    println!("Routines Res: {:?}", routines_res.is_ok());
                    if let Ok(mut routines_pairs) = routines_res {
                        let routines_pair = routines_pairs.next().unwrap();
                        let routines_span = routines_pair.as_span();
                        let routines_remaining = &remaining[routines_span.end()..];
                        println!("Remaining after routines (len {}):\n{:?}", routines_remaining.len(), routines_remaining);
                    } else if let Err(e) = routines_res {
                        println!("Routines Error: {:?}", e);
                    }
                } else if let Err(e) = data_res {
                    println!("Data Error: {:?}", e);
                }
            } else if let Err(e) = hw_res {
                println!("Hardware Error: {:?}", e);
            }
        }
    }

    #[test]
    fn test_parse_basic_blink() {
        let path = "d:/Documents/NeuroForge/dendriForge/dendriforge/core/asl/v010/examples/basic-blink-logic.toon";
        let content = fs::read_to_string(path).expect("Failed to read blink logic toon");
        
        let parsed = AslPestParser::parse(Rule::asl_document, &content);
        assert!(parsed.is_ok(), "Pest parsing failed: {:?}", parsed.err());
        
        let pair = parsed.unwrap().next().unwrap();
        let program = AslBuilder::build_program(pair);
        assert!(program.is_ok(), "Builder failed: {:?}", program.err());
        
        let program = program.unwrap();
        assert_eq!(program.hardware_map.len(), 1);
        assert!(program.constants.contains_key("BLINK_INTERVAL"));
        assert!(program.routines.iter().any(|r| r.name == "setup"));
        assert!(program.routines.iter().any(|r| r.name == "loop"));
        assert!(program.routines.iter().any(|r| r.name == "toggle_led"));
    }

    #[test]
    fn test_parse_reservatorio_controle() {
        let path = "d:/Documents/NeuroForge/dendriForge/dendriforge/core/asl/v010/examples/reservatorio-controle-logic.toon";
        let content = fs::read_to_string(path).expect("Failed to read reservatorio logic toon");
        
        let parsed = AslPestParser::parse(Rule::asl_document, &content);
        assert!(parsed.is_ok(), "Pest parsing failed: {:?}", parsed.err());
        
        let pair = parsed.unwrap().next().unwrap();
        let program = AslBuilder::build_program(pair);
        assert!(program.is_ok(), "Builder failed: {:?}", program.err());
    }
}
