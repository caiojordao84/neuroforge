//! Módulo de análise estática do ASL.

pub mod type_checker;
pub mod variable_scope;
pub mod dependency_graph;

pub use type_checker::{check_types, Diagnostic};
pub use variable_scope::check_variable_scope;
pub use dependency_graph::{build_call_graph, find_unreachable_functions, CallGraph};
