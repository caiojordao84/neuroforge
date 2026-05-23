// Test script for transpiling MicroPython to C/Arduino
use neuroforge_core::transpile::transpile;

fn main() {
    let source = r#"
from machine import Pin # Pin
from machine import Pin, ADC
from machine import Pin, PWM
from machine import Pin,
from time import sleep

led = Pin(25,Pin.OUT)
botao = Pin(33,Pin.IN, Pin.PULL_DOWN)
pot0 = ADC(Pin(4))
led_pwm = PWM(Pin(25))

pot0.atten(ADC.ATTN_11DB)
pot0.width(ADC.WIDTH_10BIT)

while 0:
  led.value(1)
  sleep(1)
  led.value(0)
  sleep(1)
  sleep(0.1)

while True:
    estado_pot = pot0.read()
    led_pwm.duty(estado_pot)
    print(f"pot0 valor: {estado_pot}")
    sleep(0.1)
"#;

    println!("=== Source (MicroPython) ===");
    println!("{}", source);

    println!("\n=== Transpiling to C/Arduino ===");
    match transpile(source, "arduino") {
        Ok(code) => {
            println!("{}", code);
        }
        Err(e) => {
            println!("ERROR: {}", e);
        }
    }
}
