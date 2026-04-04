//! tree_sitter_loader.rs     inicializa    o dos parsers tree-sitter por linguagem

//! Migrado de: src/engine/asl/TreeSitterLoader.ts



use tree_sitter::Language as TsLanguage;



/// Retorna a linguagem tree-sitter para o ID dado.

/// Retorna `None` para linguagens sem grammar tree-sitter dispon  vel.

pub fn get_ts_language(lang_id: &str) -> Option<TsLanguage> {

    match lang_id {

        "cpp" | "c"    => Some(tree_sitter_cpp::LANGUAGE.into()),

        "micropython"  => Some(tree_sitter_python::LANGUAGE.into()),

        "rust_std" | "rust_embassy" => Some(tree_sitter_rust::LANGUAGE.into()),

        "arduino"      => {

            // Fallback para C++ se a grammar Arduino n  o estiver dispon  vel

            Some(tree_sitter_cpp::LANGUAGE.into())

        }

        _ => None,

    }

}



/// Verifica se um ID de linguagem tem parser tree-sitter dispon  vel

pub fn is_ts_supported(lang_id: &str) -> bool {

    get_ts_language(lang_id).is_some()

}



#[cfg(test)]

mod tests {

    use super::*;



    #[test]

    fn test_cpp_ts_available() {

        assert!(get_ts_language("cpp").is_some());

    }



    #[test]

    fn test_python_ts_available() {

        assert!(get_ts_language("micropython").is_some());

    }



    #[test]

    fn test_rust_ts_available() {

        assert!(get_ts_language("rust_std").is_some());

    }



    #[test]

    fn test_st_no_ts() {

        // ST usa parser iec61131 dedicado, n  o tree-sitter

        assert!(get_ts_language("st").is_none());

    }

}











