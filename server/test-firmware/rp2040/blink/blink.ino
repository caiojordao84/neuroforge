/**
 * NeuroForge RP2040 GPIO Test Firmware
 * 
 * Pisca o LED onboard (GP25) e emite eventos GPIO via Serial
 * usando o protocolo NeuroForge: G:pin=X,v=Y
 * 
 * Emulador: Renode
 * Board: Raspberry Pi Pico (RP2040)
 * FQBN: rp2040:rp2040:rpipico
 */

// Configurações
#define LED_PIN 25           // LED onboard do Pico (GP25)
#define BLINK_INTERVAL 1000  // Intervalo em ms (1 segundo)
#define BAUD_RATE 115200     // Baud rate da UART

// Variáveis globais
bool ledState = false;
unsigned long lastToggle = 0;

/**
 * Emite evento GPIO no formato NeuroForge
 * Formato: G:pin=X,v=Y
 * 
 * @param pin Número do pino GPIO
 * @param value Estado do pino (0=LOW, 1=HIGH)
 */
void emitGpioEvent(uint8_t pin, uint8_t value) {
  Serial.print("G:pin=");
  Serial.print(pin);
  Serial.print(",v=");
  Serial.println(value);
}

/**
 * Controla LED e emite evento GPIO
 * 
 * @param state true=ON, false=OFF
 */
void setLed(bool state) {
  digitalWrite(LED_PIN, state ? HIGH : LOW);
  emitGpioEvent(LED_PIN, state ? 1 : 0);
  
  // Debug message
  Serial.println(state ? "LED ON" : "LED OFF");
}

void setup() {
  // Inicializar Serial
  Serial.begin(BAUD_RATE);
  
  // Aguardar estabilização (importante para Renode)
  delay(100);
  
  // Configurar LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  // Mensagem de boas-vindas
  Serial.println();
  Serial.println("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  Serial.println("  NeuroForge GPIO Test - RP2040");
  Serial.println("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  Serial.print("Board: Raspberry Pi Pico");
  Serial.println();
  Serial.print("LED Pin: GP");
  Serial.println(LED_PIN);
  Serial.println("Protocol: G:pin=X,v=Y");
  Serial.println("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  Serial.println();
  
  // Inicializar timestamp
  lastToggle = millis();
}

void loop() {
  unsigned long now = millis();
  
  // Toggle LED a cada BLINK_INTERVAL
  if (now - lastToggle >= BLINK_INTERVAL) {
    ledState = !ledState;
    setLed(ledState);
    lastToggle = now;
  }
  
  // Pequeno delay para não sobrecarregar CPU
  delay(10);
}
