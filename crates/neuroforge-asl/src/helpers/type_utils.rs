//! Mapeamento de tipos C++/Python/Rust     AslType.

//! Migrado de: src/engine/asl/helpers/typeUtils.ts



use crate::types::asl_types::AslType;



/// Converte uma string de tipo de linguagem-fonte para o tipo ASL equivalente.

/// L  gica id  ntica ao `mapToASLType()` em TypeScript.

pub fn map_to_asl_type(cpp_type: &str) -> AslType {

    let lower = cpp_type.trim().to_lowercase();



    // Inteiros

    if lower.contains("int")

        || lower.contains("long")

        || lower == "short"

        || lower == "byte"

        || lower == "char"

        || lower.contains("uint")

        || lower == "size_t"

    {

        return AslType::Int;

    }



    // Floats

    if lower.contains("float") || lower == "double" {

        return AslType::Float;

    }



    // Bool

    if lower == "bool" || lower == "boolean" {

        return AslType::Bool;

    }



    // String

    if lower == "string" || lower.contains("std::string") {

        return AslType::String;

    }



    // Struct/class/RGB

    if lower == "struct" || lower == "class" || lower == "rgbled" {

        return AslType::Struct;

    }



    // Fallback id  ntico ao TS: 'int'

    AslType::Int

}



#[cfg(test)]

mod tests {

    use super::*;



    #[test]

    fn test_int_variants() {

        assert_eq!(map_to_asl_type("int"),      AslType::Int);

        assert_eq!(map_to_asl_type("uint8_t"),  AslType::Int);

        assert_eq!(map_to_asl_type("long"),     AslType::Int);

        assert_eq!(map_to_asl_type("byte"),     AslType::Int);

        assert_eq!(map_to_asl_type("size_t"),   AslType::Int);

    }



    #[test]

    fn test_float_variants() {

        assert_eq!(map_to_asl_type("float"),    AslType::Float);

        assert_eq!(map_to_asl_type("double"),   AslType::Float);

    }



    #[test]

    fn test_bool_variants() {

        assert_eq!(map_to_asl_type("bool"),     AslType::Bool);

        assert_eq!(map_to_asl_type("boolean"),  AslType::Bool);

    }



    #[test]

    fn test_string_variants() {

        assert_eq!(map_to_asl_type("String"),   AslType::String);

        assert_eq!(map_to_asl_type("std::string"), AslType::String);

    }



    #[test]

    fn test_struct_variants() {

        assert_eq!(map_to_asl_type("struct"),   AslType::Struct);

        assert_eq!(map_to_asl_type("RgbLed"),   AslType::Struct);

    }



    #[test]

    fn test_fallback() {

        assert_eq!(map_to_asl_type("unknown"),  AslType::Int);

    }

}











