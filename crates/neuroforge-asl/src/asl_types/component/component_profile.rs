//! Component profile types: ComponentProfile, Signal, SignalType
//!
//! These types define electronic components and their signal interfaces.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::asl_types::component::asl_hint::AslHint;

/// Complete component profile loaded from TOON schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentProfile {
    /// Unique component identifier (e.g., "led-rgb-common-cathode", "dht22")
    pub id: String,
    /// Human-readable component name
    pub name: String,
    /// Component manufacturer
    pub manufacturer: Option<String>,
    /// Component category
    pub category: Option<String>,
    /// Component description
    pub description: Option<String>,
    /// Datasheet URL
    pub datasheet: Option<String>,
    /// Signal interfaces
    pub signals: Vec<Signal>,
    /// Pin connections required
    pub connections: Vec<ComponentConnection>,
    /// ASL hints for code generation
    pub asl_hint: AslHint,
    /// Component parameters
    #[serde(default)]
    pub parameters: HashMap<String, serde_json::Value>,
    /// Requires libraries
    #[serde(default)]
    pub requires_libraries: Vec<String>,
}

/// Signal definition for component interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Signal {
    /// Signal name
    pub name: String,
    /// Signal type
    pub signal_type: SignalType,
    /// Direction (input/output/bidirectional)
    pub direction: SignalDirection,
    /// Pin connection reference
    pub pin: String,
    /// Voltage level if applicable
    pub voltage_mv: Option<u32>,
    /// Default state
    pub default_state: Option<String>,
    /// Pull configuration
    pub pull: Option<String>,
    /// Signal description
    pub description: Option<String>,
    /// Associated peripheral
    pub peripheral: Option<String>,
}

/// Signal type classification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SignalType {
    /// Digital input
    DigitalInput,
    /// Digital output
    DigitalOutput,
    /// Analog input
    AnalogInput,
    /// Analog output (PWM)
    AnalogOutput,
    /// I2C SDA
    I2cSda,
    /// I2C SCL
    I2cScl,
    /// SPI MOSI
    SpiMosi,
    /// SPI MISO
    SpiMiso,
    /// SPI Clock
    SpiClk,
    /// SPI Chip Select
    SpiCs,
    /// UART TX
    UartTx,
    /// UART RX
    UartRx,
    /// OneWire bus
    OneWire,
    /// PWM output
    Pwm,
    /// Interrupt capable
    Interrupt,
    /// Power supply
    Power,
    /// Ground
    Ground,
    /// Custom/unknown
    Custom(String),
}

impl SignalType {
    /// Get the canonical string representation.
    pub fn as_str(&self) -> &str {
        match self {
            SignalType::DigitalInput => "digitalInput",
            SignalType::DigitalOutput => "digitalOutput",
            SignalType::AnalogInput => "analogInput",
            SignalType::AnalogOutput => "analogOutput",
            SignalType::I2cSda => "i2cSda",
            SignalType::I2cScl => "i2cScl",
            SignalType::SpiMosi => "spiMosi",
            SignalType::SpiMiso => "spiMiso",
            SignalType::SpiClk => "spiClk",
            SignalType::SpiCs => "spiCs",
            SignalType::UartTx => "uartTx",
            SignalType::UartRx => "uartRx",
            SignalType::OneWire => "oneWire",
            SignalType::Pwm => "pwm",
            SignalType::Interrupt => "interrupt",
            SignalType::Power => "power",
            SignalType::Ground => "ground",
            SignalType::Custom(s) => s,
        }
    }

    /// Parse from string (including legacy formats).
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "digital_input" | "digitalinput" | "di" => SignalType::DigitalInput,
            "digital_output" | "digitaloutput" | "do" => SignalType::DigitalOutput,
            "analog_input" | "analoginput" | "ai" => SignalType::AnalogInput,
            "analog_output" | "analogoutput" | "ao" => SignalType::AnalogOutput,
            "i2c_sda" | "i2csda" => SignalType::I2cSda,
            "i2c_scl" | "i2cscl" => SignalType::I2cScl,
            "spi_mosi" | "spimosi" => SignalType::SpiMosi,
            "spi_miso" | "spimiso" => SignalType::SpiMiso,
            "spi_clk" | "spiclk" => SignalType::SpiClk,
            "spi_cs" | "spics" => SignalType::SpiCs,
            "uart_tx" | "uarttx" => SignalType::UartTx,
            "uart_rx" | "uartrx" => SignalType::UartRx,
            "onewire" | "1wire" => SignalType::OneWire,
            "pwm" => SignalType::Pwm,
            "interrupt" | "irq" => SignalType::Interrupt,
            "power" | "vcc" | "vin" => SignalType::Power,
            "ground" | "gnd" => SignalType::Ground,
            other => SignalType::Custom(other.to_string()),
        }
    }
}

/// Signal direction.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SignalDirection {
    Input,
    Output,
    Bidirectional,
    Passive,
}

impl Default for SignalDirection {
    fn default() -> Self {
        SignalDirection::Input
    }
}

/// Connection definition for a component.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentConnection {
    /// Connection name (e.g., "VCC", "GND", "DATA")
    pub name: String,
    /// Required signal type
    pub signal_type: SignalType,
    /// Target board pin
    pub target_pin: String,
    /// Whether connection is required
    pub required: bool,
    /// Notes about connection
    pub notes: Option<String>,
}

impl ComponentProfile {
    /// Get all signals of a specific type.
    pub fn signals_of_type(&self, signal_type: &SignalType) -> Vec<&Signal> {
        self.signals
            .iter()
            .filter(|s| &s.signal_type == signal_type)
            .collect()
    }

    /// Get all input signals.
    pub fn input_signals(&self) -> Vec<&Signal> {
        self.signals
            .iter()
            .filter(|s| {
                matches!(
                    s.direction,
                    SignalDirection::Input | SignalDirection::Bidirectional
                )
            })
            .collect()
    }

    /// Get all output signals.
    pub fn output_signals(&self) -> Vec<&Signal> {
        self.signals
            .iter()
            .filter(|s| {
                matches!(
                    s.direction,
                    SignalDirection::Output | SignalDirection::Bidirectional
                )
            })
            .collect()
    }
}
