


| Categoria        | Pattern            | Exemplo                          |
| ---------------- | ------------------ | -------------------------------- |
| Board            | board-*            | board-body, board-outline        |
| Chips            | chip-<name>        | chip-atmega328p, chip-atmega16u2 |
| Conectores       | <type>-connector   | usb-connector, power-jack        |
| Botões           | <function>-button  | reset-button                     |
| Pinos Digitais   | pin-d<N>           | pin-d0, pin-d13                  |
| Pinos Analógicos | pin-a<N>           | pin-a0, pin-a5                   |
| Pinos Power      | pin-<name>         | pin-5v, pin-gnd-1, pin-vin       |
| ICSP             | icsp-<N>-<signal>  | icsp-1-miso, icsp-2-vcc          |
| LEDs             | led-<function>     | led-power, led-tx, led-pin13     |
| Componentes      | <component>-<spec> | crystal-16mhz, voltage-regulator |
| Logo             | logo-arduino       | logo-arduino-infinity            |
| Labels           | label-<type>       | thing-label, thing-text,         |

<!-- Digital Pins (gpio array: pin 0-13) -->
<g id="header-digital">
  <circle id="pin-d0" data-pin="0" data-type="digital" />
  <circle id="pin-d1" data-pin="1" data-type="digital" />
  <circle id="pin-d2" data-pin="2" data-type="digital" />
  <circle id="pin-d3" data-pin="3" data-type="digital" />
  <circle id="pin-d4" data-pin="4" data-type="digital" />
  <circle id="pin-d5" data-pin="5" data-type="digital" />
  <circle id="pin-d6" data-pin="6" data-type="digital" />
  <circle id="pin-d7" data-pin="7" data-type="digital" />
  <circle id="pin-d8" data-pin="8" data-type="digital" />
  <circle id="pin-d9" data-pin="9" data-type="digital" />
  <circle id="pin-d10" data-pin="10" data-type="digital" />
  <circle id="pin-d11" data-pin="11" data-type="digital" />
  <circle id="pin-d12" data-pin="12" data-type="digital" />
  <circle id="pin-d13" data-pin="13" data-type="digital" />
  <g id="header-i2c">
  <circle id="pin-aref" data-pin="AREF" data-type="power" />
  <circle id="pin-gnd-0" data-pin="GND" data-type="ground" />
  <circle id="pin-d18-sda" data-pin="18" data-type="digital" data-i2c="SDA" />
  <circle id="pin-d19-scl" data-pin="19" data-type="digital" data-i2c="SCL" />
</g>

</g>

<!-- Analog Pins (gpio array: pin 14-19) -->
<g id="header-analog">
  <circle id="pin-a0" data-pin="14" data-type="analog" />
  <circle id="pin-a1" data-pin="15" data-type="analog" />
  <circle id="pin-a2" data-pin="16" data-type="analog" />
  <circle id="pin-a3" data-pin="17" data-type="analog" />
  <circle id="pin-a4" data-pin="18" data-type="analog" data-i2c="SDA" />
  <circle id="pin-a5" data-pin="19" data-type="analog" data-i2c="SCL" />
</g>

<!-- Power Pins (powerPins array) -->
<g id="header-power">
  <circle id="pin-vin" data-pin="VIN" data-type="power" />
  <circle id="pin-5v" data-pin="5V" data-type="power" />
  <circle id="pin-3v3" data-pin="3V3" data-type="power" />
  <circle id="pin-gnd-1" data-pin="GND" data-type="ground" />
  <circle id="pin-gnd-2" data-pin="GND" data-type="ground" />
  <circle id="pin-ioref" data-pin="IOREF" data-type="power" />
  <circle id="pin-reset" data-pin="RESET" data-type="power" />
  <circle id="pin-aref" data-pin="AREF" data-type="power" />
</g>

<rect id="crystal-16mhz" />
<rect id="voltage-regulator" />

<circle id="led-power" class="led led-green" data-state="on" />
<circle id="led-tx" class="led led-yellow" data-state="off" />
<circle id="led-rx" class="led led-yellow" data-state="off" />
<circle id="led-pin13" class="led led-orange" data-state="off" />

<g id="icsp-header-main">
  <circle id="icsp-1-miso" />
  <circle id="icsp-1-vcc" />
  <circle id="icsp-1-sck" />
  <circle id="icsp-1-mosi" />
  <circle id="icsp-1-reset" />
  <circle id="icsp-1-gnd" />
</g>

<g id="icsp-header-usb">
  <circle id="icsp-2-miso" />
  <circle id="icsp-2-vcc" />
  <circle id="icsp-2-sck" />
  <circle id="icsp-2-mosi" />
  <circle id="icsp-2-reset" />
  <circle id="icsp-2-gnd" />
</g>

<g id="reset-button">
  <circle id="reset-button-button" />
  <rect id="reset-button-body" />
</g>

<g id="chip-atmega328p">              <!-- ATmega328P -->
  <rect id="chip-atmega328p-body" />
  <text id="chip-atmega328p-label">ATmega328P</text>
</g>

<g id="chip-atmega16u2">              <!-- USB chip -->
  <rect id="chip-atmega16u2-body" />
  <text id="chip-atmega16u2-label">ATmega16U2</text>
</g>

<g id="usb-connector">                <!-- USB Type-B -->
  <rect id="usb-connector-body" />
</g>

<g id="power-jack">                   <!-- Barrel jack -->
  <circle id="power-jack-outer" />
  <circle id="power-jack-inner" />
</g>

<rect id="board-body" />              <!-- Corpo principal -->
<path id="board-outline" />           <!-- Contorno -->
