use neuroforge_asl::parser::NeuroParser;
use neuroforge_asl::plugins::rust_std::RustParser;

fn main() {
    let src = r#"
#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_time::Timer;
use esp_hal::ledc::{
    channel::{self, ChannelIFace},
    timer::{self, TimerIFace},
    LSGlobalClkSource, Ledc, LowSpeed,
};
use esp_hal::time::Rate;
use {esp_backtrace as _, esp_println as _};

const LED_PIN: u8 = 9;

#[esp_hal_embassy::main]
async fn main(_spawner: Spawner) {
    let peripherals = esp_hal::init(esp_hal::Config::default());

    let mut ledc = Ledc::new(peripherals.LEDC);
    ledc.set_global_slow_clock(LSGlobalClkSource::APBClk);

    let mut lstimer0 = ledc.timer::<LowSpeed>(timer::Number::Timer0);
    lstimer0
        .configure(timer::config::Config {
            duty: timer::config::Duty::Duty8Bit,
            clock_source: timer::LSClockSource::APBClk,
            frequency: Rate::from_khz(5),
        })
        .unwrap();

    let led_gpio = esp_hal::gpio::Output::new(
        esp_hal::gpio::AnyPin::new(unsafe { esp_hal::gpio::GpioPin::<9>::steal() }),
        esp_hal::gpio::Level::Low,
    );

    let mut channel0 = ledc.channel(channel::Number::Channel0, led_gpio);
    channel0
        .configure(channel::config::Config {
            timer: &lstimer0,
            duty_pct: 0,
            drive_mode: channel::config::DriveMode::PushPull,
        })
        .unwrap();

    let mut brightness: i32 = 0;
    let mut fade_amount: i32 = 5;

    loop {
        let duty_pct = ((brightness * 100) / 255) as u8;
        channel0.set_duty(duty_pct).unwrap();

        brightness += fade_amount;

        if brightness <= 0 || brightness >= 255 {
            fade_amount = -fade_amount;
        }

        Timer::after_millis(30).await;
    }
}
"#;

    let program = RustParser::parse(src).expect("parse failed");
    let toon = serde_toon::to_string(&program).expect("serialize failed");
    println!("{}", toon);
}
