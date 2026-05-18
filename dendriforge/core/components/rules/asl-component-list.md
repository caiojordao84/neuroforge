# NeuroForge — Componentes Simulados
# família / subfamília / componente / slug

---

## Elétricos Fundamentais

### Fontes
- Fonte DC                              | dc-source
- Fonte AC                              | ac-source
- Fonte AC trifásica                    | ac-source-3phase
- Bateria                               | battery
- Fonte de bancada                      | bench-supply
- Fonte PWM                             | pwm-source
- Gerador de sinais                     | signal-generator
- Fonte de corrente ideal               | current-source
- Fonte de ruído                        | noise-source
- Fonte solar / painel fotovoltaico     | solar-panel-source

### Passivos
- Resistor                              | resistor
- Potenciómetro                         | potentiometer
- Trimmer                               | trimmer
- Pack pull-up / pull-down              | pullup-pulldown-pack
- Ladder de resistores                  | resistor-ladder
- Capacitor                             | capacitor
- Indutor                               | inductor
- Transformador                         | transformer
- Cristal / oscilador                   | crystal-oscillator
- NTC                                   | thermistor-ntc
- PTC                                   | thermistor-ptc
- Shunt resistivo                       | shunt-resistor

### Semicondutores
- LED                                   | led
- LED RGB                               | led-rgb
- Display 7 segmentos                   | display-7seg
- Matriz LED                            | led-matrix
- Diodo                                 | diode
- Diodo Schottky                        | diode-schottky
- Diodo Zener                           | diode-zener
- Diodo TVS                             | diode-tvs
- BJT NPN                               | bjt-npn
- BJT PNP                               | bjt-pnp
- Foto-transístor                       | phototransistor
- Optoacoplador                         | optocoupler
- MOSFET N                              | mosfet-n
- MOSFET P                              | mosfet-p
- IGBT                                  | igbt
- SCR / tirístor                        | scr-thyristor
- Triac                                 | triac
- Ponte H                               | h-bridge
- Driver de relé                        | relay-driver
- SSR                                   | ssr

### Proteção Elétrica
- Fusível                               | fuse
- Disjuntor miniatura                   | mcb
- Disjuntor motor                       | motor-circuit-breaker
- Varistor MOV                          | varistor-mov
- TVS de linha                          | tvs-line
- Ferrite bead                          | ferrite-bead
- Supressor RC                          | rc-snubber
- Proteção inversão de polaridade       | reverse-polarity-protection
- Proteção sobrecorrente eletrónica     | overcurrent-protection
- Proteção sobretensão                  | overvoltage-protection

### Interligação e Distribuição
- Terminal de alimentação DC            | terminal-dc-power
- Terminal AC                           | terminal-ac-power
- Bornes plugáveis                      | pluggable-terminals
- Header macho/fêmea                    | header-pin
- Jumper / ponte                        | jumper
- Barramento positivo                   | busbar-positive
- Barramento negativo                   | busbar-negative
- Barramento PE / terra                 | busbar-pe
- Bloco distribuidor                    | distribution-block
- Conector rápido industrial            | industrial-quick-connector

---

## Sensores

### Sensores de Ambiente
- LDR                                   | sensor-ldr
- Termístor                             | sensor-thermistor
- Temperatura                           | sensor-temperature
- Temperatura e humidade                | sensor-temp-humidity
- Pressão barométrica                   | sensor-barometric-pressure
- Gás série MQ                          | sensor-gas-mq
- Chuva                                 | sensor-rain
- Humidade do solo                      | sensor-soil-moisture
- Cor                                   | sensor-color
- Receptor IR                           | sensor-ir-receiver
- UV                                    | sensor-uv
- Qualidade do ar / VOC                 | sensor-air-quality-voc
- CO2                                   | sensor-co2
- Luminosidade digital                  | sensor-light-digital

### Sensores de Movimento e Posição
- Ultrassónico                          | sensor-ultrasonic
- PIR                                   | sensor-pir
- Hall                                  | sensor-hall
- Tilt sensor                           | sensor-tilt
- Encoder incremental                   | sensor-encoder-incremental
- Encoder absoluto                      | sensor-encoder-absolute
- Encoder rotativo manual               | sensor-rotary-encoder
- IMU 6 eixos                           | sensor-imu-6axis
- IMU 9 eixos                           | sensor-imu-9axis
- Sensor táctil capacitivo              | sensor-touch-capacitive
- Flex sensor                           | sensor-flex
- Fim de curso mecânico                 | sensor-limit-switch
- Sensor magnético de posição           | sensor-magnetic-position
- Sensor de distância ToF               | sensor-tof-distance

### Sensores Elétricos
- Sensor de corrente                    | sensor-current
- Sonda divisor de tensão               | sensor-voltage-divider
- Sensor de tensão isolado              | sensor-voltage-isolated
- Transdutor 4-20 mA                    | sensor-4-20ma-transducer
- Transformador de corrente             | sensor-current-transformer
- Sensor de potência                    | sensor-power
- Shunt monitor                         | sensor-shunt-monitor
- Detetor de fase                       | sensor-phase-detector
- Monitor de frequência                 | sensor-frequency-monitor
- Detetor de zero-cross                 | sensor-zero-cross

### Sensores de Processo
- Transmissor de pressão                | sensor-pressure-transmitter
- Pressostato                           | sensor-pressure-switch
- Sensor de caudal                      | sensor-flow
- Caudalímetro mássico virtual          | sensor-mass-flow
- Sensor de nível boia                  | sensor-level-float
- Sensor de nível ultrassónico          | sensor-level-ultrasonic
- Sensor de nível capacitivo            | sensor-level-capacitive
- Load cell / strain gauge              | sensor-load-cell
- Sensor de pH                          | sensor-ph
- Sensor de condutividade               | sensor-conductivity
- Sensor ORP                            | sensor-orp
- Sensor de turbidez                    | sensor-turbidity

### Sensores Industriais de Presença e Segurança
- Sensor indutivo                       | sensor-inductive
- Sensor capacitivo                     | sensor-capacitive
- Sensor fotoelétrico barreira          | sensor-photoelectric-barrier
- Sensor fotoelétrico retro-reflexivo   | sensor-photoelectric-retroreflective
- Sensor fotoelétrico difuso            | sensor-photoelectric-diffuse
- Sensor laser de distância             | sensor-laser-distance
- Cortina de luz de segurança           | sensor-light-curtain-safety
- Tapete de segurança                   | sensor-safety-mat
- Chave magnética de porta              | sensor-magnetic-door-switch
- Interlock de segurança                | sensor-safety-interlock
- Scanner de segurança stub             | sensor-safety-scanner-stub

---

## Elementos de Comando

### Pushbuttons momentâneos
- Pushbutton NO start                   | cmd-pushbutton-no-start
- Pushbutton NC stop                    | cmd-pushbutton-nc-stop
- Pushbutton changeover                 | cmd-pushbutton-changeover
- Pushbutton iluminado NO               | cmd-pushbutton-lit-no
- Pushbutton iluminado NC               | cmd-pushbutton-lit-nc
- Pushbutton duplo bimanual             | cmd-pushbutton-two-hand
- Mushroom head não-segurança           | cmd-mushroom-head
- Foot switch NO                        | cmd-foot-switch-no
- Foot switch NC                        | cmd-foot-switch-nc

### Selectors e switches mantidos
- Selector 2 posições NO/NC             | cmd-selector-2pos-nonc
- Selector 2 posições changeover        | cmd-selector-2pos-changeover
- Selector 3 posições 0-1-2             | cmd-selector-3pos-012
- Selector 3 posições spring return     | cmd-selector-3pos-spring
- Selector rotativo multiposição        | cmd-selector-rotary-multi
- Key switch manual/auto/off            | cmd-key-switch
- Interruptor basculante                | cmd-toggle-switch
- Interruptor alavanca                  | cmd-lever-switch
- Comutador cam                         | cmd-cam-switch

### Comandos de emergência e segurança
- E-Stop mushroom changeover            | cmd-estop-mushroom
- E-Stop key release                    | cmd-estop-key-release
- E-Stop rope pull                      | cmd-estop-rope-pull
- Safety gate switch                    | cmd-safety-gate-switch
- Enabling switch 3 posições            | cmd-enabling-switch-3pos
- Reset de segurança                    | cmd-safety-reset
- Botão acknowledge safety              | cmd-safety-acknowledge

### Sinalizadores de painel
- Piloto verde 24VDC                    | signal-pilot-lamp-green
- Piloto amarelo 24VDC                  | signal-pilot-lamp-yellow
- Piloto vermelho 24VDC                 | signal-pilot-lamp-red
- Piloto azul 24VDC                     | signal-pilot-lamp-blue
- Piloto branco 24VDC                   | signal-pilot-lamp-white
- Piloto pulsante                       | signal-pilot-lamp-flashing
- Buzzer industrial                     | signal-buzzer-industrial
- Sirene                                | signal-siren
- Stack light 3 cores                   | signal-stack-light-3
- Stack light 5 cores                   | signal-stack-light-5

### Interfaces manuais especiais
- Joystick 2 eixos                      | cmd-joystick-2axis
- Joystick 2 eixos com pushbutton       | cmd-joystick-2axis-btn
- Joystick 3 eixos                      | cmd-joystick-3axis
- Handwheel / MPG                       | cmd-handwheel-mpg
- Pedal analógico                       | cmd-pedal-analog
- Painel operador simples               | cmd-operator-panel
- Leitor RFID / badge                   | cmd-rfid-reader
- Leitor código de barras stub          | cmd-barcode-reader-stub

---

## Atuadores

### Atuadores elétricos maker / prototipagem
- Buzzer                                | act-buzzer
- Servo                                 | act-servo
- Motor DC                              | act-motor-dc
- Motor passo-a-passo                   | act-stepper-motor
- Motor de vibração                     | act-vibration-motor
- Ventoinha DC                          | act-fan-dc
- Fita RGB                              | act-rgb-strip
- Lâmpada                               | act-lamp
- Relé hobby                            | act-relay-hobby
- Micro bomba DC                        | act-micro-pump-dc

### Atuadores elétricos industriais
- Relé                                  | act-relay-industrial
- Relé de estado sólido                 | act-ssr-industrial
- Contactor                             | act-contactor
- Travão eletromagnético                | act-electromagnetic-brake
- Elemento aquecedor PTC                | act-heater-ptc
- Resistência cartucho                  | act-cartridge-heater
- Motor AC monofásico                   | act-motor-ac-1ph
- Motor AC trifásico                    | act-motor-ac-3ph
- Ventilador industrial                 | act-fan-industrial
- Sirene industrial                     | act-siren-industrial

### Acionamento e partida de motores
- Arranque direto DOL                   | act-starter-dol
- Arranque estrela-triângulo            | act-starter-star-delta
- Soft starter                          | act-soft-starter
- VFD / inversor de frequência          | act-vfd
- Servo drive                           | act-servo-drive
- Drive DC                              | act-drive-dc
- Starter reversível                    | act-starter-reversible
- Proteção térmica de motor             | act-motor-thermal-protection

### Atuadores lineares e válvulas acionadas
- Atuador linear                        | act-linear-actuator
- Solenóide linear                      | act-solenoid-linear
- Válvula solenóide genérica            | act-solenoid-valve-generic
- Válvula proporcional elétrica         | act-proportional-valve-electric
- Damper actuator                       | act-damper-actuator
- Atuador rotativo elétrico             | act-rotary-actuator-electric
- Lock / trinco elétrico                | act-electric-lock

---

## Pneumática

### Atuadores pneumáticos
- Cilindro simples efeito retorno mola  | pneu-cylinder-sa-spring
- Cilindro simples efeito retorno ar    | pneu-cylinder-sa-air
- Cilindro duplo efeito                 | pneu-cylinder-da
- Cilindro DA com amortecimento         | pneu-cylinder-da-cushioned
- Cilindro compacto ISO 21287           | pneu-cylinder-compact
- Cilindro guiado                       | pneu-cylinder-guided
- Cilindro sem haste com carro          | pneu-cylinder-rodless
- Cilindro telescópico                  | pneu-cylinder-telescopic
- Garra pneumática paralela             | pneu-gripper-parallel
- Garra pneumática angular              | pneu-gripper-angular
- Atuador rotativo de palheta           | pneu-rotary-vane
- Atuador rotativo de cremalheira       | pneu-rotary-rack
- Motor pneumático de palhetas          | pneu-motor-vane
- Muscle / atuador de membrana          | pneu-muscle-actuator

### Válvulas direcionais pneumáticas
- Válvula 2/2 NC                        | pneu-valve-2-2-nc
- Válvula 2/2 NO                        | pneu-valve-2-2-no
- Válvula 3/2 NC solenóide              | pneu-valve-3-2-nc-sol
- Válvula 3/2 NO solenóide              | pneu-valve-3-2-no-sol
- Válvula 3/2 mecânica                  | pneu-valve-3-2-mech
- Válvula 3/2 manual                    | pneu-valve-3-2-manual
- Válvula 5/2 monoestável               | pneu-valve-5-2-mono
- Válvula 5/2 biestável                 | pneu-valve-5-2-bi
- Válvula 5/3 centro fechado            | pneu-valve-5-3-closed
- Válvula 5/3 centro pressurizado       | pneu-valve-5-3-pressurized
- Válvula 5/3 centro aberto             | pneu-valve-5-3-open
- Válvula de retenção                   | pneu-check-valve
- Válvula shuttle                       | pneu-shuttle-valve
- Válvula de duplo bloqueio             | pneu-dual-check-valve
- Válvula de sequência                  | pneu-sequence-valve

### Controlo de caudal e pressão pneumático
- Regulador de caudal unidirecional     | pneu-flow-control-uni
- Regulador de caudal bidirecional      | pneu-flow-control-bi
- Válvula de escape rápido              | pneu-quick-exhaust
- Regulador de pressão                  | pneu-pressure-regulator
- Válvula de alívio de pressão          | pneu-pressure-relief
- Válvula limitadora de pressão         | pneu-pressure-limiter
- Válvula diferencial de pressão        | pneu-pressure-differential
- Regulador caudal proporcional         | pneu-flow-control-proportional

### Solenóides e acionamentos pneumáticos
- Solenóide simples 24VDC               | pneu-solenoid-single-24vdc
- Solenóide duplo 24VDC Y1/Y2           | pneu-solenoid-double-24vdc
- Eletroválvula retorno por mola        | pneu-electrovalve-spring-return
- Pilotagem pneumática interna          | pneu-pilot-internal
- Pilotagem pneumática externa          | pneu-pilot-external
- Pilotagem manual com lock             | pneu-pilot-manual-lock
- Acionamento por came / rolete         | pneu-actuator-cam-roller
- Acionamento por fim de curso          | pneu-actuator-limit-switch

### Preparação de ar
- Filtro de ar comprimido               | pneu-air-filter
- Regulador de pressão com manómetro    | pneu-regulator-gauge
- Lubrificador                          | pneu-lubricator
- Filtro-Regulador-Lubrificador FRL     | pneu-frl-unit
- Secador por adsorção stub             | pneu-dryer-adsorption
- Separador de condensados              | pneu-condensate-separator
- Silenciador / abafador                | pneu-silencer

### Sensores e instrumentação pneumática
- Manómetro analógico                   | pneu-pressure-gauge
- Pressostato mecânico NC               | pneu-pressure-switch-nc
- Pressostato mecânico NO               | pneu-pressure-switch-no
- Transmissor de pressão 4-20 mA        | pneu-pressure-transmitter
- Sensor de pressão digital IO-Link     | pneu-pressure-sensor-iolink
- Reed switch de cilindro               | pneu-reed-switch-cylinder
- Sensor magnético de cilindro          | pneu-magnetic-cylinder-sensor
- Sensor indutivo fim de curso          | pneu-inductive-limit
- Sensor ótico de posição               | pneu-optical-position
- Sensor de caudal de ar                | pneu-air-flow-sensor
- Fim de curso mecânico pneumático      | pneu-mechanical-limit-switch

### Vácuo e manipulação
- Gerador vácuo venturi simples         | pneu-vacuum-generator-single
- Gerador vácuo venturi duplo estágio   | pneu-vacuum-generator-dual
- Ventosa plana                         | pneu-suction-cup-flat
- Ventosa oval                          | pneu-suction-cup-oval
- Ventosa com fole simples              | pneu-suction-cup-bellows-single
- Ventosa com fole duplo                | pneu-suction-cup-bellows-double
- Pinça de vácuo multizona              | pneu-vacuum-gripper-multizone
- Ejetor de vácuo com retenção          | pneu-vacuum-ejector-check
- Sensor de vácuo pressostato           | pneu-vacuum-switch
- Filtro de linha de vácuo              | pneu-vacuum-filter
- Acumulador de vácuo                   | pneu-vacuum-accumulator

---

## Hidráulica

### Atuadores hidráulicos
- Cilindro hid. simples efeito mola     | hyd-cylinder-sa-spring
- Cilindro hid. simples efeito peso     | hyd-cylinder-sa-gravity
- Cilindro hidráulico duplo efeito      | hyd-cylinder-da
- Cilindro hid. DA com amortecimento    | hyd-cylinder-da-cushioned
- Cilindro telescópico SA               | hyd-cylinder-telescopic-sa
- Cilindro telescópico DA               | hyd-cylinder-telescopic-da
- Cilindro diferencial                  | hyd-cylinder-differential
- Motor hid. de engrenagens             | hyd-motor-gear
- Motor hid. de palhetas                | hyd-motor-vane
- Motor hid. de pistões axiais          | hyd-motor-axial-piston
- Atuador rotativo hidráulico           | hyd-rotary-actuator
- Cilindro guiado hidráulico            | hyd-cylinder-guided

### Válvulas direcionais hidráulicas
- Válvula 2/2 NC hidráulica             | hyd-valve-2-2-nc
- Válvula 2/2 NO hidráulica             | hyd-valve-2-2-no
- Válvula 3/2 NC hidráulica             | hyd-valve-3-2-nc
- Válvula 4/2 monoestável               | hyd-valve-4-2-mono
- Válvula 4/2 biestável                 | hyd-valve-4-2-bi
- Válvula 4/3 centro fechado            | hyd-valve-4-3-closed
- Válvula 4/3 centro em tanque          | hyd-valve-4-3-tank
- Válvula 4/3 centro em pressão         | hyd-valve-4-3-pressure
- Válvula 4/3 centro flutuante          | hyd-valve-4-3-float
- Válvula proporcional direcional 4/3   | hyd-valve-4-3-proportional
- Servoválvula 4/3                      | hyd-servo-valve-4-3

### Controlo de pressão hidráulica
- Válvula de alívio de pressão          | hyd-pressure-relief-valve
- Válvula redutora de pressão           | hyd-pressure-reducing-valve
- Válvula de sequência hidráulica       | hyd-sequence-valve
- Válvula de contrapressão              | hyd-back-pressure-valve
- Válvula diferencial de pressão        | hyd-pressure-differential-valve
- Válvula proporcional de pressão       | hyd-pressure-proportional-valve
- Acumulador de bexiga                  | hyd-accumulator-bladder
- Acumulador de pistão                  | hyd-accumulator-piston
- Acumulador de membrana                | hyd-accumulator-diaphragm
- Bloco de manifold                     | hyd-manifold-block

### Controlo de caudal hidráulico
- Regulador de caudal fixo              | hyd-flow-control-fixed
- Regulador de caudal variável          | hyd-flow-control-variable
- Regulador caudal compensado pressão   | hyd-flow-control-pressure-compensated
- Divisor de caudal                     | hyd-flow-divider
- Motor de caudal                       | hyd-flow-meter-motor
- Válvula proporcional de caudal        | hyd-flow-proportional-valve

### Bombas hidráulicas
- Bomba de engrenagens                  | hyd-pump-gear
- Bomba de palhetas                     | hyd-pump-vane
- Bomba de pistões axiais               | hyd-pump-axial-piston
- Bomba de pistões radiais              | hyd-pump-radial-piston
- Bomba de duplo volume variável        | hyd-pump-variable-displacement
- Grupo hidráulico compacto             | hyd-power-unit

### Válvulas de retenção e especiais
- Válvula de retenção simples           | hyd-check-valve
- Válvula de retenção pilotada          | hyd-pilot-check-valve
- Válvula bloqueio duplo pilotada       | hyd-dual-pilot-check-valve
- Válvula shuttle hidráulica            | hyd-shuttle-valve
- Válvula anti-choque de linha          | hyd-line-relief-valve
- Válvula freewheel                     | hyd-freewheel-valve

### Filtração e condicionamento hidráulico
- Filtro de retorno                     | hyd-filter-return
- Filtro de alta pressão                | hyd-filter-high-pressure
- Filtro de ventilação breather         | hyd-filter-breather
- Trocador de calor ar                  | hyd-heat-exchanger-air
- Trocador de calor água                | hyd-heat-exchanger-water
- Indicador de colmatagem               | hyd-filter-clog-indicator
- Sensor de temperatura do óleo         | hyd-oil-temp-sensor
- Nível de reservatório com termómetro  | hyd-reservoir-level-temp

### Sensores e instrumentação hidráulica
- Manómetro hidráulico                  | hyd-pressure-gauge
- Pressostato hidráulico NC             | hyd-pressure-switch-nc
- Pressostato hidráulico NO             | hyd-pressure-switch-no
- Transdutor de pressão 4-20 mA         | hyd-pressure-transmitter
- Sensor de pressão digital IO-Link     | hyd-pressure-sensor-iolink
- Caudalímetro de engrenagens           | hyd-flow-meter-gear
- Caudalímetro de turbina               | hyd-flow-meter-turbine
- Sensor de temperatura do fluido       | hyd-fluid-temp-sensor
- Sensor de nível de reservatório       | hyd-reservoir-level-sensor
- Sensor de contaminação do óleo        | hyd-oil-contamination-sensor
- Posicionador linear / LVDT            | hyd-linear-position-sensor
- Sensor de velocidade motor hid.       | hyd-motor-speed-sensor

---

## Comunicação

### Interfaces seriais e buses
- Terminal UART                         | comm-uart-terminal
- Stub RS-232                           | comm-rs232-stub
- Stub RS-485                           | comm-rs485-stub
- Stub I2C                              | comm-i2c-stub
- Monitor I2C                           | comm-i2c-monitor
- Stub SPI                              | comm-spi-stub
- Monitor SPI                           | comm-spi-monitor
- Nó CAN                                | comm-can-node
- Analisador CAN                        | comm-can-analyzer
- Nó LIN                                | comm-lin-node

### Dispositivos industriais de rede
- Device Modbus RTU slave               | comm-modbus-rtu-slave
- Device Modbus TCP slave               | comm-modbus-tcp-slave
- Device EtherNet/IP                    | comm-ethernetip-device
- Device PROFINET                       | comm-profinet-device
- Device BACnet                         | comm-bacnet-device
- Servidor OPC-UA stub                  | comm-opcua-server-stub
- Device EtherCAT stub                  | comm-ethercat-stub
- Device IO-Link master stub            | comm-iolink-master-stub
- Device IO-Link slave stub             | comm-iolink-slave-stub

### Comunicação wireless
- Stub Bluetooth / BLE                  | comm-ble-stub
- Nó Zigbee / Thread                    | comm-zigbee-thread-node
- Nó LoRa                               | comm-lora-node
- Wi-Fi 2.4 GHz                         | comm-wifi-2g4
- Wi-Fi 5 GHz                           | comm-wifi-5g
- Nó cellular LTE-M / NB-IoT            | comm-cellular-ltem-nbiot
- RFID reader wireless stub             | comm-rfid-wireless-stub

### Gateways e stubs de protocolo
- Gateway Modbus RTU-TCP                | comm-gateway-modbus-rtu-tcp
- Gateway CAN-Ethernet                  | comm-gateway-can-eth
- Gateway serial-Ethernet               | comm-gateway-serial-eth
- Gateway MQTT-Modbus                   | comm-gateway-mqtt-modbus
- Broker MQTT virtual                   | comm-mqtt-broker-virtual
- Stub REST / HTTP industrial           | comm-rest-http-stub
- Stub WebSocket industrial             | comm-websocket-stub

### Monitores e analisadores de tráfego
- Monitor Modbus                        | comm-monitor-modbus
- Monitor CAN                           | comm-monitor-can
- Monitor I2C                           | comm-monitor-i2c
- Monitor SPI                           | comm-monitor-spi
- Sniffer Ethernet industrial           | comm-ethernet-sniffer
- Analisador PROFINET stub              | comm-profinet-analyzer-stub
- Analisador EtherNet/IP stub           | comm-ethernetip-analyzer-stub
- Monitor MQTT                          | comm-monitor-mqtt

---

## Industrial

### Blocos de lógica e controlo
- Contacto NO                           | ind-contact-no
- Contacto NC                           | ind-contact-nc
- Bobina                                | ind-coil
- Set / Reset                           | ind-set-reset
- Timer TON                             | ind-timer-ton
- Timer TOF                             | ind-timer-tof
- Timer TP                              | ind-timer-tp
- Counter CTU                           | ind-counter-ctu
- Counter CTD                           | ind-counter-ctd
- PID block                             | ind-pid-block
- Comparador analógico                  | ind-analog-comparator
- Latch                                 | ind-latch
- Bloco two-hand control                | ind-two-hand-control-block

### Bancos e módulos de I/O
- Banco DI                              | ind-di-bank
- Banco DO                              | ind-do-bank
- Banco AI                              | ind-ai-bank
- Banco AO                              | ind-ao-bank
- Módulo RTD                            | ind-rtd-module
- Módulo termopar                       | ind-thermocouple-module
- Módulo contador rápido                | ind-high-speed-counter
- Módulo PTO/PWM                        | ind-pto-pwm-module
- Módulo safety I/O                     | ind-safety-io-module
- Módulo energia                        | ind-power-meter-module

### Módulos de processo
- Módulo tanque                         | ind-tank-module
- Módulo esteira / conveyor             | ind-conveyor-module
- Módulo bomba                          | ind-pump-module
- Módulo válvula de processo            | ind-process-valve-module
- Módulo solenóide de processo          | ind-process-solenoid-module
- Módulo misturador                     | ind-mixer-module
- Módulo aquecimento                    | ind-heating-module
- Módulo trocador térmico               | ind-heat-exchanger-module

### HMI e sinalização industrial
- Lâmpada HMI                           | ind-hmi-lamp
- Botão HMI                             | ind-hmi-button
- Selector HMI                          | ind-hmi-selector
- Trend chart HMI                       | ind-hmi-trend-chart
- Alarme HMI                            | ind-hmi-alarm
- Banner de estado                      | ind-hmi-status-banner
- Indicador numérico                    | ind-hmi-numeric-indicator
- Bargraph                              | ind-hmi-bargraph

### Segurança funcional
- Bloco safety relay                    | ind-safety-relay-block
- Safety gate                           | ind-safety-gate
- Cortina de luz stub                   | ind-light-curtain-stub
- E-Stop lógico                         | ind-estop-logic
- Sensor proximidade safety stub        | ind-proximity-safety-stub
- Sensor fotoelétrico safety stub       | ind-photoelectric-safety-stub
- Muting block                          | ind-muting-block
- Reset de segurança                    | ind-safety-reset-block

### Potência e controlo de motores
- Perfil VFD                            | ind-vfd-profile
- Perfil servo drive                    | ind-servo-drive-profile
- Perfil soft starter                   | ind-soft-starter-profile
- Starter DOL                           | ind-starter-dol
- Starter reversível                    | ind-starter-reversible
- Proteção térmica                      | ind-thermal-protection
- Monitor de corrente de motor          | ind-motor-current-monitor
- Módulo feedback encoder               | ind-encoder-feedback-module

---

## Instrumentação Virtual

### Probes e medição
- Probe tensão                          | virt-probe-voltage
- Probe corrente                        | virt-probe-current
- Probe temperatura                     | virt-probe-temperature
- Probe pressão                         | virt-probe-pressure
- Probe caudal                          | virt-probe-flow
- Probe lógica digital                  | virt-probe-digital-logic
- Multímetro virtual                    | virt-multimeter
- Clamp meter virtual                   | virt-clamp-meter

### Instrumentos de bancada virtuais
- Osciloscópio                          | virt-oscilloscope
- Analisador lógico                     | virt-logic-analyzer
- Gerador de funções                    | virt-function-generator
- Fonte de bancada virtual              | virt-bench-supply
- Analisador de potência                | virt-power-analyzer
- Analisador de espectro                | virt-spectrum-analyzer
- Frequencímetro                        | virt-frequency-counter
- LCR meter virtual                     | virt-lcr-meter

### Análise de sinal
- FFT / spectrum                        | virt-fft-spectrum
- Trend temporal                        | virt-time-trend
- Eye diagram stub                      | virt-eye-diagram-stub
- Jitter monitor stub                   | virt-jitter-monitor-stub
- State timeline                        | virt-state-timeline
- Decoder PWM                           | virt-decoder-pwm
- Decoder quadratura                    | virt-decoder-quadrature
- Analisador harmónico                  | virt-harmonic-analyzer

### Monitores de protocolo
- Serial monitor                        | virt-serial-monitor
- Event monitor                         | virt-event-monitor
- Watch table                           | virt-watch-table
- Monitor Modbus                        | virt-monitor-modbus
- Monitor CAN                           | virt-monitor-can
- Monitor I2C                           | virt-monitor-i2c
- Monitor SPI                           | virt-monitor-spi
- Monitor OPC-UA stub                   | virt-monitor-opcua-stub

### Depuração e fault injection
- Fault injector                        | virt-fault-injector
- Noise injector                        | virt-noise-injector
- Power glitch injector                 | virt-power-glitch-injector
- Line break injector                   | virt-line-break-injector
- Short-circuit injector                | virt-short-circuit-injector
- Packet loss injector                  | virt-packet-loss-injector
- Latency injector                      | virt-latency-injector
- Force tag / override                  | virt-force-tag-override

---

## Infraestrutura de Painel

### Disjuntores e seccionamento
- Disjuntor 1P                          | panel-mcb-1p
- Disjuntor 2P                          | panel-mcb-2p
- Disjuntor 3P                          | panel-mcb-3p
- Disjuntor 4P                          | panel-mcb-4p
- Seccionador rotativo                  | panel-rotary-isolator
- Interruptor-seccionador com manete    | panel-switch-disconnector
- Diferencial RCCB                      | panel-rccb
- RCBO                                  | panel-rcbo

### Fusíveis e porta-fusíveis
- Fusível gG                            | panel-fuse-gg
- Fusível aM                            | panel-fuse-am
- Fusível cilíndrico                    | panel-fuse-cylindrical
- Porta-fusível DIN                     | panel-fuse-holder-din
- Porta-fusível basculante              | panel-fuse-holder-flip
- Seccionador fusível                   | panel-fuse-switch-disconnector

### Fontes DIN e transformadores de comando
- Fonte DIN 24VDC                       | panel-psu-din-24vdc
- Fonte DIN redundante                  | panel-psu-din-redundant
- UPS DC DIN                            | panel-ups-dc-din
- Transformador de comando 230/24VAC    | panel-transformer-control
- Transformador isolamento              | panel-transformer-isolation

### Bornes e terminal blocks
- Borne passagem                        | panel-terminal-feedthrough
- Borne PE                              | panel-terminal-pe
- Borne fusível                         | panel-terminal-fused
- Borne seccionável                     | panel-terminal-disconnect
- Borne sensor/atuador                  | panel-terminal-sensor-actuator
- Borne múltiplos níveis                | panel-terminal-multilevel
- Borne mola                            | panel-terminal-spring
- Borne para neutro                     | panel-terminal-neutral

### Barramentos e distribuição
- Barramento fase                       | panel-busbar-phase
- Barramento neutro                     | panel-busbar-neutral
- Barramento terra                      | panel-busbar-earth
- Distribuidor 24VDC                    | panel-distributor-24vdc
- Distribuidor 0V                       | panel-distributor-0v
- Pente de alimentação                  | panel-busbar-comb
- Bloco distribuição trifásico          | panel-3phase-distribution-block

### Relés auxiliares e interfaces
- Relé auxiliar 24VDC                   | panel-aux-relay-24vdc
- Relé auxiliar 230VAC                  | panel-aux-relay-230vac
- Base de relé                          | panel-relay-base
- Módulo interface relé                 | panel-relay-interface-module
- Relé temporizado                      | panel-timer-relay
- Relé monitor tensão                   | panel-voltage-monitor-relay
- Relé monitor fase                     | panel-phase-monitor-relay

### Contactores e proteção térmica
- Contactor 3 polos                     | panel-contactor-3p
- Mini contactor                        | panel-contactor-mini
- Relé térmico                          | panel-thermal-relay
- Disjuntor motor                       | panel-motor-circuit-breaker
- Combinado arrancador                  | panel-combination-starter
- Supressor para bobina                 | panel-coil-suppressor

### Inversores e soft starters
- Inversor compacto                     | panel-inverter-compact
- Inversor vetorial                     | panel-inverter-vector
- Soft starter compacta                 | panel-soft-starter-compact
- Soft starter industrial               | panel-soft-starter-industrial
- Filtro EMC                            | panel-emc-filter
- Resistência de travagem               | panel-braking-resistor

### Medição e energia em painel
- Medidor energia monofásico            | panel-energy-meter-1ph
- Medidor energia trifásico             | panel-energy-meter-3ph
- Amperímetro painel                    | panel-ammeter
- Voltímetro painel                     | panel-voltmeter
- Transdutor energia                    | panel-energy-transducer
- Analisador de rede                    | panel-power-quality-analyzer
- TC de painel                          | panel-current-transformer
- TP de painel                          | panel-voltage-transformer

---
*NeuroForge Component Library | 9 famílias · 50 subfamílias · ~450 componentes*