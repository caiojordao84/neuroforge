//! ASL hint types: AslHint, HmiWidget
//!
//! These types provide hints for ASL code generation and HMI visualization.

use serde::{Deserialize, Serialize};

/// ASL hints for code generation from component profile.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslHint {
    /// Semantic type for code generation
    pub semantic_type: Option<String>,
    /// Library to include
    pub library: Option<String>,
    /// Initialization code snippet
    pub init_code: Option<String>,
    /// Setup code snippet
    pub setup_code: Option<String>,
    /// Loop code snippet
    pub loop_code: Option<String>,
    /// HMI widget configuration
    pub hmi_widget: Option<HmiWidget>,
    /// Default pin mappings
    #[serde(default)]
    pub default_pins: Vec<DefaultPinMapping>,
    /// Required includes
    #[serde(default)]
    pub includes: Vec<String>,
    /// Custom properties
    #[serde(default)]
    pub properties: std::collections::HashMap<String, serde_json::Value>,
}

/// Default pin mapping for a component.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultPinMapping {
    /// Signal name from component
    pub signal: String,
    /// Recommended board pin
    pub pin: String,
    /// Pin mode to set
    pub mode: Option<String>,
}

/// HMI widget configuration for visualization.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HmiWidget {
    /// Widget type
    pub widget_type: HmiWidgetType,
    /// Display label
    pub label: Option<String>,
    /// Color for visualization
    pub color: Option<String>,
    /// Icon name
    pub icon: Option<String>,
    /// Widget-specific properties
    #[serde(default)]
    pub properties: std::collections::HashMap<String, serde_json::Value>,
}

/// HMI widget types available in the builder UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HmiWidgetType {
    /// Toggle switch
    Toggle,
    /// Slider control
    Slider,
    /// Button
    Button,
    /// LED indicator
    Led,
    /// RGB LED
    RgbLed,
    /// Progress bar
    ProgressBar,
    /// Chart
    Chart,
    /// Text display
    Text,
    /// Gauge
    Gauge,
    /// Plotter
    Plotter,
    /// Terminal
    Terminal,
    /// Custom
    Custom(String),
}

impl HmiWidgetType {
    /// Get the canonical name for serialization.
    pub fn name(&self) -> &str {
        match self {
            HmiWidgetType::Toggle => "toggle",
            HmiWidgetType::Slider => "slider",
            HmiWidgetType::Button => "button",
            HmiWidgetType::Led => "led",
            HmiWidgetType::RgbLed => "rgb_led",
            HmiWidgetType::ProgressBar => "progress_bar",
            HmiWidgetType::Chart => "chart",
            HmiWidgetType::Text => "text",
            HmiWidgetType::Gauge => "gauge",
            HmiWidgetType::Plotter => "plotter",
            HmiWidgetType::Terminal => "terminal",
            HmiWidgetType::Custom(s) => s,
        }
    }

    /// Parse from string.
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "toggle" => HmiWidgetType::Toggle,
            "slider" => HmiWidgetType::Slider,
            "button" => HmiWidgetType::Button,
            "led" => HmiWidgetType::Led,
            "rgb_led" | "rgbled" => HmiWidgetType::RgbLed,
            "progress_bar" | "progressbar" => HmiWidgetType::ProgressBar,
            "chart" => HmiWidgetType::Chart,
            "text" => HmiWidgetType::Text,
            "gauge" => HmiWidgetType::Gauge,
            "plotter" => HmiWidgetType::Plotter,
            "terminal" => HmiWidgetType::Terminal,
            other => HmiWidgetType::Custom(other.to_string()),
        }
    }
}

impl AslHint {
    /// Create a new ASL hint.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the semantic type.
    pub fn with_semantic_type(mut self, semantic_type: impl Into<String>) -> Self {
        self.semantic_type = Some(semantic_type.into());
        self
    }

    /// Set the library.
    pub fn with_library(mut self, library: impl Into<String>) -> Self {
        self.library = Some(library.into());
        self
    }

    /// Add a default pin mapping.
    pub fn with_default_pin(mut self, signal: impl Into<String>, pin: impl Into<String>) -> Self {
        self.default_pins.push(DefaultPinMapping {
            signal: signal.into(),
            pin: pin.into(),
            mode: None,
        });
        self
    }
}
