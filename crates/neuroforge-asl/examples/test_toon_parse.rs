use neuroforge_asl::asl_types::board::board_profile::BoardProfile;
use std::fs;

fn main() {
    let path = "../../apps/shared/static/boards/arduino-uno-r3.toon";
    println!("Loading: {}", path);
    
    let content = fs::read_to_string(path).expect("Failed to read toon file");
    println!("Content:\n{}", content);
    
    match BoardProfile::from_toon_str(&content) {
        Ok(profile) => {
            println!("✅ SUCCESS! Board parsed correctly.");
            println!("ID: {}", profile.id);
            println!("Name: {}", profile.name);
            println!("Manufacturer: {}", profile.manufacturer);
            println!("Flash: {} bytes", profile.flash_bytes);
            println!("SRAM: {} bytes", profile.sram_bytes);
            println!("Clock: {} Hz", profile.clock_hz);
        }
        Err(e) => {
            println!("❌ FAILURE! Parse error:");
            println!("{}", e);
            std::process::exit(1);
        }
    }
}
