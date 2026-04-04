//! Optimiza    es sobre o AslProgram.

//! Pipeline recomendado: constant_fold     dead_code     inline_const.



pub mod constant_fold;

pub mod dead_code;

pub mod inline_const;



pub use constant_fold::constant_fold;

pub use dead_code::eliminate_dead_code;

pub use inline_const::inline_constants;



use crate::types::asl_types::AslProgram;



/// Aplica o pipeline completo de optimiza    o (in-place).

/// Ordem: fold literals     elimina dead code     inline constantes.

pub fn optimize(program: &mut AslProgram) {

    constant_fold(program);

    eliminate_dead_code(program);

    inline_constants(program);

}











