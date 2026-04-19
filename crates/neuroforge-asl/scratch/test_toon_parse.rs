use neuroforge_asl::asl_types::board::board_profile::BoardProfile;

fn main() {
    let toon_content = r#"# Comment line 1
# Comment line 2

id: test-board
name: Test Board
pin_map:
  logical_pins: []
  physical_pins: []
asl_target:
  platform: arduino
"#;

    match BoardProfile::from_toon_str(toon_content) {
        Ok(profile) => println!("Success: {}", profile.name),
        Err(e) => println!("Error: {}", e),
    }
}
