# WiFi

> Code generation skill for WiFi network communication

## Purpose

Generate code to connect to WiFi networks and perform HTTP, MQTT, or socket communications.

## Hardware

- **Component**: `wifi`
- **Protocol**: 802.11 b/g/n
- **Boards**: ESP32, ESP8266, ESP32-C3, WiFi shields

## Code Generation Rules

### ESP32 - Arduino

```c
#include <WiFi.h>

const char* ssid = "YourSSID";
const char* password = "YourPassword";

void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nConnected!");
    Serial.println(WiFi.localIP());
}
```

### ESP8266 - Arduino

```c
#include <ESP8266WiFi.h>
// Same API as ESP32
```

### HTTP Client

```c
#include <HTTPClient.h>

void fetchData() {
    HTTPClient http;
    http.begin("http://example.com/api/data");
    int code = http.GET();
    if (code > 0) {
        String payload = http.getString();
    }
    http.end();
}
```

### MicroPython

```python
import network
import urequests

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect('SSID', 'password')

while not wlan.isconnected():
    pass

response = urequests.get('http://example.com')
print(response.text)
```

### CircuitPython

```python
import wifi
import socket

radio = wifi.radio
radio.connect(ssid='SSID', password='password')
print(radio.ipv4_address)
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct credentials | +0.0 |
| Error handling for connect | +0.1 |
| Reconnection logic | +0.1 |
| WiFi + ADC2 conflict | -0.1 |

## Example Output

```c
#include <WiFi.h>

void connectWiFi(const char* ssid, const char* pass) {
    WiFi.begin(ssid, pass);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
    }
}
```

## Constraints

- ESP32: ADC2 unavailable while WiFi on
- Power consumption high (~200mA)
- Limited to 2.4GHz typically

## Related Skills
- bluetooth
- arduino-cpp-esp32