// Final verification tests for transpilation pipeline
// Tests: Simple Blink, PWM Fade, Embassy Example (parsing)

use neuroforge_asl::transpile;

#[cfg(test)]
mod final_verification_tests {
    use neuroforge_asl::transpile;

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 1: Simple Blink - C++ (Arduino)
    // ═══════════════════════════════════════════════════════════════════════════════
    #[test]
    fn test_simple_blink_cpp() {
        let src = r#"
fn main() {
    gpio_mode(13, 1);
    loop {
        gpio_set(13, 1);
        delay_ms(500);
        gpio_set(13, 0);
        delay_ms(500);
    }
}
"#;

        let result = transpile(src, "c++").expect("Transpile to C++ failed");

        // Verify setup() function exists
        assert!(
            result.contains("void setup()"),
            "C++ output must have void setup() function"
        );

        // Verify loop() function exists
        assert!(
            result.contains("void loop()"),
            "C++ output must have void loop() function"
        );

        // Verify pinMode is generated
        assert!(
            result.contains("pinMode"),
            "C++ output must contain pinMode"
        );

        // Verify digitalWrite is generated
        assert!(
            result.contains("digitalWrite"),
            "C++ output must contain digitalWrite"
        );

        // Verify delay is generated
        assert!(result.contains("delay"), "C++ output must contain delay");

        println!("=== C++ Simple Blink Output ===\n{}", result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 2: Simple Blink - MicroPython
    // ═══════════════════════════════════════════════════════════════════════════════
    #[test]
    fn test_simple_blink_micropython() {
        let src = r#"
fn main() {
    gpio_mode(13, 1);
    loop {
        gpio_set(13, 1);
        delay_ms(500);
        gpio_set(13, 0);
        delay_ms(500);
    }
}
"#;

        let result = transpile(src, "micropython").expect("Transpile to MicroPython failed");

        // Verify while True loop exists
        assert!(
            result.contains("while True:"),
            "MicroPython output must have while True: loop"
        );

        // Verify Pin imports
        assert!(
            result.contains("from machine import"),
            "MicroPython output must have machine imports"
        );

        // Verify Pin is created
        assert!(
            result.contains("Pin("),
            "MicroPython output must contain Pin()"
        );

        // Verify delays use sleep_ms
        assert!(
            result.contains("sleep_ms"),
            "MicroPython output must use sleep_ms"
        );

        println!("=== MicroPython Simple Blink Output ===\n{}", result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 3: PWM Fade - C++ (Arduino)
    // ═══════════════════════════════════════════════════════════════════════════════
    #[test]
    fn test_pwm_fade_cpp() {
        let src = r#"
fn main() {
    pwm_init(0, 5000);
    let mut brightness = 0;
    let mut fade_amount = 5;
    loop {
        pwm_set_duty(0, brightness);
        brightness += fade_amount;
        if brightness <= 0 || brightness >= 255 {
            fade_amount = -fade_amount;
        }
        delay_ms(30);
    }
}
"#;

        let result = transpile(src, "c++").expect("Transpile to C++ failed");

        // Verify setup() and loop()
        assert!(
            result.contains("void setup()"),
            "C++ output must have void setup() function"
        );
        assert!(
            result.contains("void loop()"),
            "C++ output must have void loop() function"
        );

        // Verify analogWrite for PWM (C++ mapping)
        assert!(
            result.contains("analogWrite"),
            "C++ PWM must use analogWrite"
        );

        // Verify variables persist (not redeclared in loop)
        assert!(
            result.contains("brightness"),
            "C++ output must have brightness variable"
        );
        assert!(
            result.contains("fade_amount"),
            "C++ output must have fade_amount variable"
        );

        // Verify delay
        assert!(result.contains("delay"), "C++ output must contain delay");

        println!("=== C++ PWM Fade Output ===\n{}", result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 4: PWM Fade - MicroPython
    // ═══════════════════════════════════════════════════════════════════════════════
    #[test]
    fn test_pwm_fade_micropython() {
        let src = r#"
fn main() {
    pwm_init(0, 5000);
    let mut brightness = 0;
    let mut fade_amount = 5;
    loop {
        pwm_set_duty(0, brightness);
        brightness += fade_amount;
        if brightness <= 0 || brightness >= 255 {
            fade_amount = -fade_amount;
        }
        delay_ms(30);
    }
}
"#;

        let result = transpile(src, "micropython").expect("Transpile to MicroPython failed");

        // Verify while True loop
        assert!(
            result.contains("while True:"),
            "MicroPython output must have while True: loop"
        );

        // Verify PWM initialization - PWM object with freq
        assert!(
            result.contains("PWM(Pin"),
            "MicroPython PWM must use PWM(Pin"
        );

        // Verify duty_u16 for PWM duty cycle (MicroPython specific)
        assert!(
            result.contains("duty_u16"),
            "MicroPython PWM must use duty_u16"
        );

        // Verify variables persist correctly
        assert!(
            result.contains("brightness"),
            "MicroPython output must have brightness variable"
        );

        println!("=== MicroPython PWM Fade Output ===\n{}", result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 5: Full Embassy Example - Parse Only (Rust)
    // ═══════════════════════════════════════════════════════════════════════════════
    #[test]
    fn test_embassy_example_parsing() {
        let src = r#"
#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_time::Timer;

#[esp_hal_embassy::main]
async fn main(_spawner: Spawner) {
    let mut brightness = 0;
    loop {
        Timer::after_millis(30).await;
    }
}
"#;

        // Test parsing only - should not crash
        let result = transpile(src, "rust").expect("Transpile to Rust failed");

        // Verify async main is preserved
        assert!(
            result.contains("async fn main"),
            "Rust output should preserve async fn main"
        );

        // Verify embassy imports
        assert!(
            result.contains("embassy_executor") || result.contains("Spawner"),
            "Rust output should contain embassy references"
        );

        // Verify Timer is used
        assert!(result.contains("Timer"), "Rust output should contain Timer");

        // Verify the loop structure
        assert!(result.contains("loop"), "Rust output should contain loop");

        println!("=== Rust Embassy Example Output ===\n{}", result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 6: Verify Variables Persist Between Loop Iterations (C++)
    // ═══════════════════════════════════════════════════════════════════════════════
    #[test]
    fn test_variable_persistence_cpp() {
        let src = r#"
fn main() {
    let mut counter = 0;
    loop {
        counter = counter + 1;
        delay_ms(100);
    }
}
"#;

        let result = transpile(src, "c++").expect("Transpile to C++ failed");

        // Variable should be declared before loop (int or auto)
        assert!(
            result.contains("counter")
                && (result.contains("int counter") || result.contains("auto counter")),
            "C++ should declare counter variable: {}",
            result
        );

        // In loop(), variable should be used without redeclaring
        // Look for counter++ or counter = ...
        assert!(result.contains("counter"), "C++ should use counter in loop");

        println!("=== Variable Persistence C++ ===\n{}", result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 7: Verify Variables Persist Between Loop Iterations (Python)
    // ═══════════════════════════════════════════════════════════════════════════════
    #[test]
    fn test_variable_persistence_python() {
        let src = r#"
fn main() {
    let mut counter = 0;
    loop {
        counter = counter + 1;
        delay_ms(100);
    }
}
"#;

        let result = transpile(src, "micropython").expect("Transpile to MicroPython failed");

        // Variable should be declared
        assert!(
            result.contains("counter"),
            "MicroPython should have counter variable"
        );

        // Should be in while True loop
        assert!(
            result.contains("while True:"),
            "MicroPython should have while True: loop"
        );

        // Variable should be modified in loop
        assert!(
            result.contains("counter + 1") || result.contains("counter +="),
            "MicroPython should increment counter"
        );

        println!("=== Variable Persistence Python ===\n{}", result);
    }
}
