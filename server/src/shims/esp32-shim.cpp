
#include <Arduino.h>
#include <hal/gpio_hal.h>

// Forward declarations of the original weak functions in the core
extern "C" void __digitalWrite(uint8_t pin, uint8_t val);
extern "C" void __pinMode(uint8_t pin, uint8_t mode);

// We use ets_printf to write directly to UART0 (Serial)
// avoiding direct dependency on Serial object initialization
extern "C" int ets_printf(const char *fmt, ...);

// Override digitalWrite
void digitalWrite(uint8_t pin, uint8_t val) {
  // Call the original implementation in the core
  __digitalWrite(pin, val);

  // Report to NeuroForge
  // Format: G:pin=2,v=1
  // We use ets_printf because it works even if Serial is not begin()'d
  ets_printf("G:pin=%d,v=%d\n", pin, val);
}

// Override pinMode
void pinMode(uint8_t pin, uint8_t mode) {
  // Call the original implementation
  __pinMode(pin, mode);

  // Report to NeuroForge
  // Format: M:pin=2,m=1 (OUTPUT)
  // Mapping of modes might differ, but Arduino constants are usually:
  // INPUT=0x01, OUTPUT=0x02, PULLUP=0x04, etc.
  // We simplify reporting for the frontend parser
  uint8_t reportMode = 0; // INPUT
  if (mode == OUTPUT)
    reportMode = 1;
  else if (mode == INPUT_PULLUP)
    reportMode = 2;

  ets_printf("M:pin=%d,m=%d\n", pin, reportMode);
}
