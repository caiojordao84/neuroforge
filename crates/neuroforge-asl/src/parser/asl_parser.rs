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
