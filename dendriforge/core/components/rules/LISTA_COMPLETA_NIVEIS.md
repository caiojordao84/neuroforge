# LISTA COMPLETA DE COMPONENTES, SENSORES E ATUADORES
> Documento de referência técnica — Organizado por nível de complexidade e domínio funcional

---

## NÍVEL 1 — BÁSICO DIGITAL (GPIO / Lógica Digital)
> Componentes de entrada e saída digitais simples, sem necessidade de protocolos complexos.

---

### 1.1 Entradas Digitais — Botões e Chaves

#### Botões Momentâneos
- Botão momentâneo NO (Normalmente Aberto)
- Botão momentâneo NC (Normalmente Fechado)
- Botão tátil (tact switch)
- Botão iluminado
- Botão de pressão industrial
- Botão tipo cogumelo (não-emergência)
- Pedal / footswitch

#### Chaves e Seletores
- Chave liga/desliga (SPST)
- Chave de 2 posições
- Chave de 3 posições
- Switch on/off (toggle switch)
- Switch deslizante (slide switch)
- Switch DIP
- Chave seletora rotativa (rotary switch)
- Chave reed (magnética)
- Selector switch industrial (2 posições)
- Selector switch industrial (3 posições)
- Chave de emergência com chave física

#### Entradas de Toque e Posição
- Sensor de toque capacitivo (TTP223)
- Sensor de toque multicanal (MPR121)
- Joystick analógico de 2 eixos
- Joystick industrial com mola de retorno
- Thumbstick (tipo controle de videogame)
- Slider analógico (potenciômetro deslizante)
- Encoder rotativo com botão (KY-040)

#### Teclados e Leitores
- Teclado matricial 3×4
- Teclado matricial 4×4
- Leitor de cartão magnético
- Leitor de cartão RFID simples

#### Entradas Industriais
- Entrada digital 24 VDC
- Entrada digital isolada
- Entrada digital com filtro de ruído
- Entrada digital com detecção de borda
- Entrada analógica 0–5 V
- Entrada analógica 0–10 V
- Entrada analógica 4–20 mA
- Entrada de pulso (contador)

---

### 1.2 Saídas Digitais — Indicação e Sinalização

#### LEDs e Fitas
- LED simples (1 cor)
- LED de alto brilho
- LED RGB (cátodo comum)
- LED endereçável (WS2812B / Neopixel)
- Barra de LEDs (bargraph)
- Fita LED monocromática (PWM)
- Fita LED RGB (PWM)
- Fita LED endereçável WS2812B
- Fita LED endereçável SK6812
- Fita LED endereçável APA102
- Matriz de LEDs (8×8)

#### Iluminação Industrial
- Lâmpada incandescente (com relé / TRIAC)
- Lâmpada fluorescente (com relé / ballast)
- Lâmpada LED de potência (com driver)
- Lâmpada halógena (com dimmer TRIAC)
- Sinalizador luminoso piscante (strobe / beacon)
- Indicador luminoso industrial (pilot light)
- Indicador luminoso com difusor
- Torre de sinalização luminosa (vermelho)
- Torre de sinalização luminosa com buzzer integrado
- Mini torre de sinalização

#### Sonorizadores
- Buzzer ativo
- Buzzer passivo (PWM)
- Sirene piezoelétrica
- Sirene industrial 12 V
- Alto-falante (com amplificador)
- Módulo de som básico

#### Relés e Saídas de Potência
- Relé eletromecânico
- Relé de estado sólido (SSR)
- Módulo relé 1 canal
- Módulo relé 2 canais
- Módulo relé 4 canais
- Módulo relé 8 canais
- Saída digital 5 V
- Saída digital 12 V
- Saída digital 24 V
- Saída digital isolada
- Saída digital com transistor (NPN/PNP)
- Saída analógica 0–5 V
- Saída analógica 0–10 V
- Saída analógica 4–20 mA
- Saída PWM
- Saída DAC (conversor digital-analógico)
- Driver MOSFET
- Driver de motor DC básico
- Driver de carga resistiva
- Driver de carga indutiva (flyback)

---

### 1.3 Sensores Digitais — Presença e Posição

#### Sensores Mecânicos
- Fim de curso (limit switch)
- Micro switch
- Reed switch
- Sensor de inclinação (tilt switch)
- Sensor de vibração mecânico (ball switch — SW-420)
- Sensor de impacto (piezo)
- Sensor de porta/janela magnético

#### Sensores de Proximidade e Presença
- Sensor PIR (movimento)
- Sensor de proximidade IR simples
- Sensor de proximidade capacitivo simples
- Sensor de presença capacitivo
- Sensor de presença indutivo
- Sensor de presença por feixe laser
- Sensor fotoelétrico de barreira (through-beam)
- Sensor de ruptura de feixe

#### Sensores de Cor, Transparência e Marcação
- Sensor de cor digital (TCS3200)
- Sensor de cor digital (TCS34725)
- Sensor de transparência / opacidade (fork sensor)
- Sensor de transparência / opacidade (slot sensor)
- Detector de borda / registration sensor
- Sensor de marcação (registration mark sensor)

#### Sensores de Velocidade e Rotação
- Encoder óptico
- Encoder magnético
- Sensor de velocidade (tacômetro digital)
- Sensor de rotação com disco fendido
- Sensor de contagem de peças (fotocélula)
- Hall effect sensor

#### Sensores de Nível e Fluxo
- Sensor de nível (boia)
- Sensor de nível capacitivo
- Sensor de nível ultrassônico digital
- Sensor de fluxo de água (hall digital)
- Sensor de chuva digital

#### Sensores Industriais de Posição
- Fim de curso industrial (roller lever)
- Fim de curso industrial (plunger)
- Fim de curso industrial (rod)
- Chave de pressão digital (pressure switch industrial)

#### Sensores de Chama e Gás
- Flame sensor
- Sensor de gás digital (MQ-x com saída digital)

#### Sensores de Segurança (Digital)
- Cortina de luz de segurança Tipo 2
- Cortina de luz de segurança Tipo 4
- Tapete de segurança (safety mat)
- Scanner a laser de segurança (SICK)
- Scanner a laser de segurança (Pilz)
- Sensor de transparência industrial
- Sensor de opacidade industrial
- Sensor de presença laser industrial

---

### 1.4 Atuadores Digitais

#### Solenoides e Travas
- Solenoide linear
- Solenoide de tração
- Solenoide de empurrar
- Trava solenoide (porta/gaveta)
- Solenoide industrial de alta força
- Fechadura magnética
- Eletroímã
- Trava elétrica
- Atuador de travamento mecânico
- Atuador de engate/desengate

#### Válvulas Digitais
- Válvula solenóide 12 V
- Válvula solenóide 24 V
- Válvula pneumática 3/2
- Válvula pneumática 5/2
- Válvula de controle on/off 2 vias motorizada
- Válvula de controle on/off 3 vias motorizada
- Válvula de água on/off
- Válvula de ar on/off
- Válvula de combustível on/off
- Damper motorizado (HVAC)

#### Bombas e Motores Digitais
- Microbomba peristáltica
- Microbomba de ar
- Microbomba de água
- Bomba peristáltica simples
- Bomba submersa 12 V
- Bomba de diafragma 12 V
- Bomba de vácuo miniatura
- Micromotor DC
- Micromotor vibratório
- Motor DC escovado
- Motor DC miniatura
- Motor DC com caixa de redução
- Driver de motor DC (L298N, TB6612)
- Motor de passo NEMA 17
- Motor de passo NEMA 23
- Motor de passo NEMA 34
- Driver de motor de passo (A4988, DRV8825, TMC2209)
- Driver industrial de motor de passo

#### Atuadores Lineares
- Atuador linear miniatura
- Atuador linear com motor DC
- Atuador linear com motor de passo
- Atuador linear telescópico
- Microatuador linear DC

#### Contatores e Relés Industriais
- Contator
- Contator reversor
- Bobina de partida (motor starter)
- Relé industrial
- Módulo relé industrial (DIN rail)
- Módulo de relé industrial isolado

#### Outros Atuadores Digitais
- Freio eletromagnético
- Dispensador / dosador solenóide
- Atuador de bloqueio de porta industrial
- Sirene industrial
- Torre de sinalização luminosa com buzzer
- Buzzer de alta potência
- Atuador piezoelétrico
- Atuador magnetoestrictivo
- Atuador térmico (bimetálico)
- Driver de potência para cargas resistivas
- Driver de ignição / faísca (HV)

---

## NÍVEL 2 — ANALÓGICO E PWM (ADC / DAC / PWM)
> Sensores com sinal analógico contínuo e atuadores com controle proporcional ou PWM.

---

### 2.1 Sensores Analógicos

#### Resistivos e de Posição
- Potenciômetro rotativo
- Potenciômetro deslizante (slider)
- Potenciômetro multivoltas
- Potenciômetro industrial selado
- Sensor resistivo de posição
- Sensor de flexão (flex sensor)
- Sensor de estiramento resistivo

#### Sensores de Luz
- LDR (Light Dependent Resistor) / Fotocélula
- Fotodiodo
- Fototransistor
- Sensor IR analógico (Sharp GP2Yxxx)
- Sensor UV analógico (GUVA-S12SD, ML8511)

#### Sensores de Temperatura
- Termistor NTC
- Termistor PTC
- Termopar tipo K
- Termopar tipo J
- Termopar tipo T
- Condicionador de sinal para termopar

#### Sensores de Pressão e Força
- Sensor de pressão analógico 0–5 V
- Sensor de pressão analógico 0–10 V
- Sensor de pressão 4–20 mA (MPX)
- Sensor de força resistivo (FSR)
- Sensor piezoresistivo de pressão

#### Sensores de Corrente e Tensão
- Sensor de corrente DC (ACS712)
- Sensor de corrente AC (SCT-013)
- Sensor de corrente DC (shunt)
- Sensor de tensão analógico
- Battery monitor
- ADC monitor

#### Sensores de Gás e Qualidade de Ar
- Sensor MQ-2 (gás inflamável)
- Sensor MQ-3 (álcool)
- Sensor MQ-7 (CO)
- Sensor MQ-135 (qualidade do ar)
- Sensor eletroquímico analógico

#### Sensores de Umidade e Ambiente
- Sensor de umidade do solo resistivo
- Sensor de umidade do solo capacitivo
- Sensor de umidade analógico
- Sensor de umidade capacitivo 0–10 V

#### Sensores de Deformação e Vibração
- Sensor de deformação (strain gauge)
- Célula de carga (load cell)
- Sensor de vibração piezoelétrico
- Sensor piezoelétrico
- Sensor de impacto piezo
- Amplificador de carga (load cell amplifier)
- Condicionador de sinal para strain gauge
- Filtro RC para sensores analógicos

#### Sensores de Posição e Inclinação
- Sensor de posição linear (potenciômetro deslizante)
- Sensor de posição angular Hall analógico (AS5600)
- Sensor de inclinação analógico

#### Sensores Analíticos
- Sensor de pH analógico
- Sensor de ORP analógico
- Sensor de turbidez analógico
- Sensor de condutividade analógico
- Sensor de luz UV analógico
- Sensor de oxigênio dissolvido (DO) analógico
- Sensor de ozônio analógico
- Sensor de fluxo de água (hall analógico)
- Microfone analógico
- Amplificador operacional (buffer para sensores)

---

### 2.2 Atuadores Analógicos e PWM

#### Motores e Drivers
- Motor DC com controle PWM
- Motor DC com controle de velocidade analógico
- Motor DC com driver H-bridge
- Motor brushless (BLDC) com ESC
- Motor de passo com driver (controle analógico)
- Servo motor (posição)
- Servo motor contínuo (velocidade)
- Motor linear DC

#### Ventoinhas e Resfriamento
- Ventoinha DC com PWM
- Ventoinha industrial com controle de velocidade
- Ventoinha 4 fios (PWM + tach)

#### Bombas com Controle de Velocidade
- Bomba peristáltica com PWM
- Bomba de diafragma com controle de velocidade
- Bomba de água DC com PWM
- Bomba de vácuo com controle de potência
- Microbomba DC proporcional

#### Válvulas Proporcionais
- Válvula proporcional pneumática
- Válvula proporcional hidráulica
- Válvula proporcional de gás
- Válvula proporcional de líquido
- Válvula de agulha proporcional
- Válvula de vapor proporcional
- Eletroválvula proporcional analógica

#### Atuadores Lineares com Controle
- Atuador linear com controle PWM
- Atuador linear com controle analógico 0–10 V
- Atuador linear com feedback de posição

#### Aquecimento e Temperatura
- Resistência de aquecimento com PWM
- Resistência de aquecimento com controle analógico
- Cartucho de aquecimento controlado
- Fita térmica controlada
- Aquecedor resistivo
- Aquecedor por indução (PWM)
- Peltier (TEC)
- Driver de aquecimento PID (analógico)

#### Drivers de LED e Iluminação
- Driver de LED PWM
- Driver de LED constant current
- Driver de LED industrial
- Driver de LED RGB
- Driver de LED endereçável
- Controlador de iluminação DALI

#### Atuadores Piezoelétricos e Especiais
- Atuador piezoelétrico proporcional
- Atuador piezo para microdosagem
- Atuador piezo para vibração controlada
- Atuador magnetoestrictivo proporcional
- Atuador proporcional de alta precisão
- Motor hidráulico proporcional
- Motor pneumático proporcional
- Driver de laser diode (PWM)

#### Drivers Industriais
- Driver PWM de alta corrente
- Driver analógico 0–10 V
- Driver 4–20 mA para atuadores
- Driver industrial isolado

---

### 2.3 Dispositivos de Medição e Feedback

#### Encoders e Resolvers
- Encoder incremental
- Encoder incremental de alta resolução
- Encoder absoluto single-turn
- Encoder absoluto multi-turn
- Encoder magnético
- Encoder óptico
- Encoder industrial com saída SSI
- Encoder industrial com saída CANopen
- Resolver (sensor rotativo industrial)

#### Sensores de Posição e Deslocamento
- Sensor de posição linear (LVDT)
- Sensor de posição linear draw-wire (string pot)
- Sensor de posição linear por potenciômetro
- Sensor de posição rotativa (RVDT)
- Sensor de posição magnético (Hall linear)
- Sensor de posição indutivo
- Sensor de posição potenciométrico
- Sensor de posição ótico
- Sensor de campo magnético linear Hall industrial

#### Sensores de Força e Torque
- Célula de carga industrial
- Transmissor de força / carga industrial
- Sensor de torque estático
- Sensor de torque rotativo com telemetria
- Sensor de força 1 eixo
- Sensor de força 3 eixos
- Sensor de torque
- Sensor de força/torque 6DOF
- Amplificador de carga (load cell amplifier)

#### Sensores de Velocidade e Aceleração
- Tacômetro
- Sensor Hall de velocidade
- Sensor óptico de rotação
- Sensor de velocidade industrial 4–20 mA
- Sensor de velocidade de roda (ABS)
- Acelerômetro
- Acelerômetro industrial 4–20 mA
- Sensor de vibração triaxial
- Giroscópio
- IMU industrial

#### Medição Elétrica
- Shunt de corrente
- Sensor Hall de corrente
- Transformador de corrente (CT)
- Transformador de potencial (PT)
- Sensor de tensão isolado
- Medidor de energia elétrica kWh (SDM120)
- Medidor de energia elétrica kWh (PZEM-004T)
- Medidor de potência ativa
- Medidor de potência reativa
- Analisador de qualidade de energia
- Analisador de harmônicas
- Sensor de fator de potência

#### Medição de Vazão
- Medidor de vazão tipo turbina
- Medidor de vazão ultrassônico
- Medidor de vazão eletromagnético
- Medidor de vazão mássica (Coriolis)

#### Sensores de Processo (Feedback)
- Transmissor de pressão
- Transmissor de temperatura
- Sensor de pressão diferencial
- Sensor de temperatura PT100 / PT1000
- Sensor de nível capacitivo
- Sensor de nível ultrassônico
- Sensor de nível radar
- Sensor de nível por boia

#### Módulos de Aquisição e Condicionamento
- Módulo condicionador de sinal (strain, RTD, termopar)
- Conversor analógico-digital industrial
- Módulo de aquisição de dados (DAQ)
- Encoder + driver servo
- Resolver + servo drive
- Sensor de torque + controle de força
- IMU + controle de estabilidade

---

## NÍVEL 3 — INTERFACES SERIAIS E BARRAMENTOS LOCAIS (I2C / SPI / UART)
> Componentes com comunicação digital via protocolos de curto alcance.

---

### 3.1 Sensores Ambientais e Climáticos

#### Temperatura e Umidade
- DHT11
- DHT22
- BME280 (pressão / umidade / temperatura)
- BMP280 (pressão / temperatura)
- BMP388 (barômetro / altímetro)
- MS5611 (barômetro / altímetro de alta precisão)
- DS18B20 (temperatura 1-Wire)
- LM35 (temperatura analógico)
- Sensor de temperatura industrial (NTC / PT100 / PT1000)
- Sensor de temperatura para HVAC
- Sensor de ponto de orvalho
- Sensor de neve / geada

#### Qualidade do Ar e Gases
- Sensor de CO₂ NDIR
- Sensor de CO₂ para ventilação
- Sensor de VOC
- Sensor de qualidade do ar (MQ-135)
- Sensor de partículas PM2.5 (PMS5003)
- Sensor de partículas PM10 (PMS5003)
- Sensor de poeira óptica
- Sensor de fumaça industrial
- Sensor de gás industrial H₂S
- Sensor de gás industrial CO
- Sensor de gás industrial O₂
- Sensor de gás industrial CH₄
- Sensor de NOx
- Sensor de O₃ (ozônio) industrial
- Sensor de amônia (NH₃)

#### Luz, UV e Ruído
- Sensor de luz ambiental / lux (BH1750)
- Sensor de luz ambiental / lux (VEML7700)
- Sensor UV-índice (VEML6075)
- Sensor de radiação solar
- Sonômetro / sensor de ruído industrial (dB)

#### Climatologia e Meteorologia
- Anemômetro (sensor de velocidade do vento)
- Pluviômetro (rain gauge)
- Sensor de direção do vento
- Sensor de pressão diferencial (ar)
- Estação meteorológica industrial
- Sensor multiparâmetro ambiental

#### Sensores de Processo Industrial
- Sensor de temperatura industrial (4–20 mA)
- Sensor de umidade industrial (4–20 mA)
- Sensor de pressão industrial (4–20 mA)
- Sensor de nível por radar
- Sensor de nível por ultrassom industrial
- Sensor de fluxo industrial
- Sensor de vazão mássica
- Sensor de vibração industrial (acelerômetro 4–20 mA)
- Sensor de vibração triaxial
- Sensor de integridade estrutural (strain industrial)
- Sensor de interface de fases (líquido-líquido)
- Sensor de corrosão eletroquímica
- Sensor de gelo / formação de cristais
- Sensor de radiação ionizante (Geiger-Müller)

---

### 3.2 Sensores de Movimento e Navegação

#### Acelerômetros, Giroscópios e IMUs
- Acelerômetro 1 eixo
- Acelerômetro 3 eixos
- Giroscópio 3 eixos
- Magnetômetro 3 eixos (bússola eletrônica)
- IMU 6DOF (acelerômetro + giroscópio)
- IMU 9DOF (acelerômetro + giroscópio + magnetômetro)
- IMU industrial 6DOF / 9DOF
- AHRS (Attitude and Heading Reference System)
- Bússola industrial

#### Encoders e Velocidade
- Encoder incremental
- Encoder absoluto
- Tacômetro
- Sensor Hall de velocidade
- Sensor de roda ABS (odometria)

#### Distância e Posição
- Sensor ultrassônico (HC-SR04)
- Sensor IR de distância
- Sensor ToF (VL53L0X / VL53L1X)
- Sensor laser de distância
- LiDAR 1D (rangefinder)
- LiDAR 2D (RPLIDAR, Hokuyo)
- LiDAR 3D (Velodyne, Ouster, Livox)

#### GNSS e Posicionamento
- GPS / GNSS
- GNSS dual-band
- GNSS RTK (alta precisão)
- GNSS industrial com antena externa
- Galileo / BeiDou
- Localização indoor UWB

#### Fusão Sensorial e Navegação Avançada
- Odometria por encoder
- INS (Inertial Navigation System)
- INS com correção por odometria
- Sensor de inclinação industrial (biaxial)
- Sensor de posição linear draw-wire (string pot)
- Giroscópio a fibra óptica (FOG)
- SLAM óptico
- SLAM LiDAR
- Navegação por fusão sensorial (IMU + GNSS + visão)
- Câmera estéreo
- Câmera ToF
- Câmera global shutter
- Câmera RGB-D
- Radar Doppler (RCWL-0516)

---

### 3.3 Sensores Ópticos e de Visão

#### Sensores de Cor, Luz e Presença
- Sensor de cor digital (TCS3200)
- Sensor de cor industrial
- Sensor de luminosidade (LDR)
- Sensor de luz ambiente digital (BH1750, VEML7700)
- Sensor RGB
- Sensor de presença óptico
- Sensor IR de proximidade
- Sensor IR de barreira
- Sensor IR reflexivo
- Sensor IR industrial

#### Sensores Fotoelétricos Industriais
- Sensor fotoelétrico difuso
- Sensor fotoelétrico retro-reflexivo
- Sensor fotoelétrico barreira (through-beam)
- Sensor de marcação (registration sensor)
- Sensor de transparência / opacidade
- Sensor tipo garfo (fork sensor)
- Sensor tipo slot
- Sensor de brilho especular
- Sensor de reflexão difusa
- Sensor de linha (line tracker)

#### Sensores Laser
- Sensor laser de distância
- Sensor laser de alta precisão (micrômetros)
- Sensor laser de triangulação
- Sensor laser para posicionamento industrial
- Sensor laser de alinhamento
- Sensor laser industrial (classe 1 / 2)
- ToF de curto alcance
- ToF de médio alcance
- ToF industrial
- ToF para mapeamento 3D
- LiDAR 1D
- LiDAR 2D (RPLIDAR, Hokuyo)
- LiDAR 3D (Velodyne, Ouster, Livox)

#### Câmeras
- Câmera USB (UVC)
- Câmera MIPI CSI
- Câmera industrial GigE Vision
- Câmera industrial USB3 Vision
- Câmera industrial com lente C-mount
- Câmera RGB
- Câmera IR
- Câmera térmica
- Câmera global shutter
- Câmera rolling shutter
- Câmera de alta velocidade (high-speed)
- Câmera de inspeção industrial
- Câmera de profundidade (Intel RealSense)
- Câmera de profundidade (Azure Kinect)
- Câmera ToF (Time-of-Flight)
- Câmera estéreo (stereo vision)
- Câmera RGB-D
- Câmera 3D industrial
- Câmera estruturada (structured light)

#### Iluminação para Visão
- Iluminador LED industrial
- Iluminador infravermelho
- Iluminador UV
- Backlight industrial
- Ring light industrial
- Projetor de padrões (structured light)

#### Leitores de Código e Identificação
- Leitor de código de barras 1D
- Leitor de código de barras 2D
- Leitor QR industrial
- Leitor OCR industrial
- Leitor de marcação DPM (Direct Part Marking)

#### Óptica e Espectrometria
- Lente C-mount
- Lente CS-mount
- Lente varifocal
- Lente macro
- Filtros ópticos (IR-cut, polarizador)
- Sensor espectral multicanal
- Espectrômetro miniaturizado
- Sensor de fluorescência
- Sensor de turbidez óptica
- Câmera termográfica / array térmico (AMG8833)
- Sensor de temperatura infravermelho sem contato (MLX90614)
- Pirômetro industrial

#### Sistemas de Visão Industrial
- Sistema de visão de inspeção industrial (smart camera)
- Sistema de visão para pick-and-place
- Sistema de visão para leitura de códigos
- Sistema de visão para metrologia
- OCR industrial
- Scanner óptico de alta velocidade
- Câmera industrial com processamento onboard

---

### 3.4 Sensores Químicos e Laboratoriais

#### Qualidade da Água
- Sensor de pH (eletrodo de vidro)
- Sensor de ORP / redox
- Sensor de condutividade elétrica
- Sensor de turbidez
- Sensor de oxigênio dissolvido (DO)
- Sensor de cloro residual
- Sensor de TDS
- Sensor de dureza da água
- Sensor de salinidade
- Sensor de pH industrial com transmissor
- Sensor de ORP industrial
- Sensor de condutividade industrial
- Sensor de turbidez óptica industrial
- Sensor de íons seletivos (ISE)

#### Gases e Compostos Químicos
- Sensor de CO₂ (NDIR)
- Sensor de O₂ eletroquímico
- Sensor de O₃ (ozônio)
- Sensor de NH₃ (amônia)
- Sensor de H₂S
- Sensor de VOC
- Sensor de CH₄
- Sensor de gás combustível (MQ-x)
- Sensor de partículas PM2.5 / PM10
- Sensor laser de partículas (PMS5003)
- Sensor de concentração de etanol

#### Biossensores e Analítica
- Sensor de concentração de glicose (biossensor)
- Sensor de concentração de lactato
- Sensor de densidade química
- Sensor de índice de refração
- Sensor de biomassa
- Sensor de CO₂ para fermentação
- Sensor de oxigênio dissolvido para biorreatores
- Sensor de pH esterilizável (CIP/SIP)

#### Radiação
- Sensor Geiger-Müller (radiação ionizante)
- Sensor de radiação alfa / beta / gama
- Dosímetro eletrônico
- Sensor de radiação UV industrial

#### Análise Óptica
- Espectrômetro miniaturizado
- Sensor espectral multicanal
- Sensor de fluorescência
- Sensor de quimioluminescência
- Sensor de absorbância

#### Interfaces Laboratoriais
- Interface de cromatógrafo (GC / HPLC)
- Interface de espectrofotômetro

---

### 3.5 Sensores de Energia Elétrica

#### Corrente e Tensão
- Sensor de corrente AC por transformador de corrente (CT)
- Sensor de corrente AC tipo clamp
- Sensor de corrente DC por shunt
- Sensor de corrente Hall (ACS712 / ACS758)
- Sensor de corrente industrial 4–20 mA
- Sensor de corrente trifásica
- Sensor de corrente bidirecional para BMS
- Sensor de tensão AC
- Sensor de tensão DC
- Sensor de tensão isolado (transformador de potencial)
- Sensor de tensão trifásica
- Sensor de tensão para BMS
- Transformador de corrente de alta tensão
- Transformador de potencial de alta tensão
- Sensor óptico de corrente (FOCT)

#### Medição de Energia e Potência
- Medidor de energia elétrica (kWh) — SDM120
- Medidor de energia elétrica (kWh) — PZEM-004T
- Medidor de potência ativa
- Medidor de potência reativa
- Medidor de potência aparente
- Medidor de fator de potência
- Medidor de harmônicas
- Analisador de qualidade de energia
- Analisador de harmônicas

#### Monitoramento de Rede e Bateria
- Sensor de frequência da rede
- Sensor de sincronismo trifásico
- Detector de passagem por zero (zero-cross)
- Sensor de continuidade
- Sensor de isolamento elétrico (megômetro eletrônico)
- Detector de fuga de corrente (RCD tester)
- Monitor de bateria (fuel gauge)
- Sensor de temperatura de bateria

---

### 3.6 Displays e Interfaces Homem-Máquina (HMI)

#### Displays Simples
- Display de 7 segmentos
- Display de 14 segmentos
- Display de 16 segmentos
- Display LCD 16×2
- Display LCD 20×4
- Display LCD com I2C
- Display gráfico monocromático (Nokia 5110)
- Barra de LEDs (bargraph)

#### Displays OLED e TFT
- Display OLED 0.96" I2C
- Display OLED 1.3" SPI
- Display OLED monocromático
- Display OLED gráfico
- Display TFT 1.8"
- Display TFT 2.4"
- Display TFT 3.5"
- Display IPS de alta resolução
- Display e-paper (e-ink)

#### Touchscreens
- Touch resistivo 4 fios
- Touch resistivo 5 fios
- Touch capacitivo multitoque
- Touch industrial com vidro temperado
- Touch com controlador I2C

#### HMI Industrial
- IHM industrial (HMI)
- IHM touchscreen resistiva
- IHM touchscreen capacitiva
- HMI básica (2–4" com botões virtuais)
- HMI média (7–10")
- HMI grande (12–15")
- IHM com Ethernet
- IHM com Modbus
- IHM com Profibus
- IHM com Profinet
- Painel operador industrial
- Painel HMI com SCADA embarcado
- Painel HMI com OPC-UA
- Painel HMI com MQTT
- Painel HMI com WebServer integrado
- Painel HMI com supervisão remota
- Painel HMI com PLC integrado
- Painel HMI com IA embarcada
- Painel HMI com conectividade 4G/5G

#### HMI Avançado e Industrial
- Painel HMI touchscreen (Siemens)
- Painel HMI touchscreen (Weintek)
- Painel HMI touchscreen (Omron)
- Painel HMI web-based
- Projetor industrial
- Display gráfico industrial
- Display industrial outdoor
- Display de alta luminosidade
- Painel LED
- Painel de mensagens

#### Entradas para HMI
- Botão simples
- Botão iluminado
- Botão industrial
- Teclado matricial (3×4 / 4×4)
- Teclado capacitivo
- Painel de botões industriais
- Seletores rotativos
- Chave comutadora

#### Realidade Aumentada e Gestos
- Holographic display (HUD)
- Display de realidade aumentada industrial
- Óculos AR industriais
- Headset de RA para manutenção
- Sistema de RA para inspeção
- Interface por gestos (Leap Motion / ToF)
- Interface por reconhecimento facial

---

## NÍVEL 4 — PROTOCOLOS INDUSTRIAIS E COMUNICAÇÃO (Modbus / CAN / RS-485 / Ethernet)
> Sensores, atuadores e dispositivos que requerem integração com protocolos industriais complexos.

---

### 4.1 Transmissores de Processo Industrial

#### Pressão
- Transmissor de pressão 4–20 mA
- Transmissor de pressão diferencial (DP transmitter)
- Transmissor de pressão manométrica
- Transmissor de pressão absoluta
- Transmissor de pressão sanitário (CIP/SIP)
- Transmissor de pressão para gases corrosivos
- Pressostato industrial
- Sensor de pressão sanitário (CIP/SIP)

#### Temperatura
- Termopar industrial (K, J, T, N, R, S)
- RTD industrial (PT100, PT1000)
- Termostato industrial
- Transmissor de temperatura 4–20 mA
- Transmissor de temperatura RTD
- Transmissor de temperatura por termopar
- Transmissor de temperatura com protocolo HART
- Transmissor de temperatura para alta temperatura (fornos)
- Sensor de temperatura sanitário (CIP/SIP)

#### Nível
- Transmissor de nível por ultrassom
- Transmissor de nível por radar
- Transmissor de nível capacitivo
- Transmissor de nível por pressão diferencial
- Transmissor de nível guiado (GWR — Guided Wave Radar)
- Sensor de nível ultrassônico
- Sensor de nível radar (FMCW)
- Sensor de nível guiado (GWR)
- Sensor de nível capacitivo
- Sensor de nível por boia
- Sensor de nível sanitário

#### Vazão
- Medidor de vazão eletromagnético
- Medidor de vazão ultrassônico
- Medidor de vazão mássica (Coriolis)
- Medidor de vazão tipo turbina
- Medidor de vazão tipo Vortex
- Medidor de vazão de ar comprimido
- Transmissor de vazão por turbina
- Transmissor de vazão eletromagnético
- Transmissor de vazão Coriolis
- Transmissor de vazão mássica térmica
- Transmissor de vazão tipo Vortex

#### Analítica Industrial
- Transmissor de pH
- Transmissor de condutividade
- Transmissor de densidade
- Transmissor de turbidez
- Transmissor de umidade relativa industrial
- Transmissor de CO₂
- Transmissor de CH₄
- Transmissor de O₂
- Transmissor de H₂S
- Transmissor de oxigênio dissolvido (DO)
- Transmissor de cloro residual
- Transmissor de amônia (NH₃)
- Transmissor de ozônio (O₃)
- Transmissor de NOx
- Sensor de pH industrial
- Sensor de ORP industrial
- Sensor de condutividade industrial
- Sensor de turbidez industrial
- Sensor de oxigênio dissolvido (DO)
- Sensor multiparâmetro (pH + condutividade + temperatura)

#### Gases e Partículas
- Sensor de oxigênio industrial
- Sensor de CO₂ industrial
- Sensor de gás combustível industrial
- Sensor de gás tóxico industrial
- Transmissor de gás 4–20 mA
- Analisador de gases multicanal (CEMS)
- Analisador de partículas em linha

#### Densidade, Viscosidade e Concentração
- Medidor de densidade industrial
- Medidor de viscosidade online
- Medidor de concentração por densidade
- Sensor de condutividade térmica para gases
- Sensor de interface de fases (líquido-líquido)

#### Força, Pesagem e Vibração
- Transmissor de força / carga industrial (4–20 mA)
- Transmissor para células de carga industriais
- Transmissor para strain gauge
- Sensor de vibração industrial
- Sensor de integridade estrutural
- Sensor de desgaste de rolamento
- Sensor de cavitação

#### Transmissores Sanitários
- Sensor sanitário de temperatura
- Sensor sanitário de pressão
- Sensor sanitário de nível
- Sensor sanitário multiparâmetro

#### Transmissores com Protocolo Inteligente
- Transmissor inteligente com HART
- Transmissor Foundation Fieldbus
- Transmissor Profibus PA
- Transmissor WirelessHART
- Transmissor ISA100

---

### 4.2 Atuadores Industriais

#### Motores e Drives
- Motor trifásico de indução
- Motor trifásico de ímã permanente
- Motor brushless industrial (BLDC trifásico)
- Motor servo DC industrial
- Motor de passo industrial (alto torque)
- Motor linear industrial
- Motor hidráulico
- Motor pneumático
- Inversor de frequência (VFD)
- Servo drive AC
- Servo drive DC
- Soft-starter
- Drive com STO (Safe Torque Off)
- Driver industrial de motor de passo
- Servo industrial AC
- Eixo elétrico (servo EtherCAT)
- Controlador de motor inteligente (Smart Motor Controller)
- Módulo de potência trifásico

#### Atuadores Lineares Industriais
- Atuador linear elétrico industrial
- Atuador linear com encoder integrado
- Atuador linear de alta força
- Atuador linear para automação pesada
- Atuador linear de alta precisão (ball screw / servo linear)
- Atuador magnetoestrictivo industrial
- Atuador piezoelétrico industrial
- Atuador de alta precisão para metrologia
- Atuador de posicionamento fino (nanoposição)

#### Cilindros Pneumáticos
- Cilindro pneumático simples ação
- Cilindro pneumático dupla ação
- Cilindro pneumático guiado
- Cilindro pneumático compacto
- Cilindro pneumático rotativo
- Atuador pneumático de garra
- Servo pneumático proporcional

#### Atuadores Hidráulicos
- Atuador hidráulico rotativo
- Atuador hidráulico de alta pressão
- Unidade hidráulica (power pack)
- Servo hidráulico proporcional

#### Válvulas Industriais
- Válvula solenóide industrial
- Válvula direcional pneumática
- Válvula direcional hidráulica
- Válvula gaveta motorizada
- Válvula borboleta motorizada
- Válvula esfera motorizada
- Válvula proporcional hidráulica
- Válvula proporcional pneumática
- Válvula de processo sanitária (CIP/SIP)
- Válvula de controle industrial (globo / gaveta / diafragma)
- Válvula de ar quente/frio on/off
- Válvula de vapor proporcional

#### Bombas Industriais
- Bomba centrífuga industrial
- Bomba de engrenagens
- Bomba de lóbulos
- Bomba peristáltica industrial
- Bomba de diafragma industrial
- Bomba de vácuo industrial
- Bomba dosadora
- Compressor scroll / pistão
- Compressor de ar
- Chiller industrial

#### Garras e Manipulação
- Garra pneumática
- Garra elétrica
- Garra magnética
- Garra de vácuo
- Garra paralela
- Garra angular
- Garra hidráulica
- Gerador de vácuo Venturi
- Copo de vácuo (vacuum cup)
- Módulo de vácuo inteligente

#### Sistemas Térmicos e de Processo
- Forno industrial
- Estufa industrial
- Túnel térmico
- Sistema HVAC industrial
- SSR industrial para controle de forno
- Resistência de aquecimento industrial

#### Robótica Industrial
- Robô industrial articulado
- Robô colaborativo (cobot)
- Robô SCARA
- Robô cartesiano (gantry)
- Robô delta para picking
- Robô de soldagem
- Robô de pintura
- Robô de paletização
- Robô colaborativo com força controlada
- Gripper elétrico
- Gripper pneumático
- Gripper hidráulico

---

### 4.3 Interfaces e Protocolos de Comunicação

#### Barramentos Locais
- I2C
- SPI
- UART / Serial TTL
- USART
- 1-Wire
- LIN Bus

#### Protocolos Seriais Industriais
- RS-485
- Modbus RTU
- Modbus TCP
- CAN Bus
- CANopen
- HART
- M-Bus
- AS-Interface (AS-i)
- IO-Link
- Foundation Fieldbus (FF)
- Interbus
- CC-Link

#### Fieldbus de Alta Velocidade
- Profibus DP
- Profinet
- EtherCAT
- Ethernet/IP
- DeviceNet
- Profibus PA

#### Comunicação USB
- USB HID
- USB CDC
- USB MSC
- USB OTG (host/device)

#### Redes Sem Fio
- Wi-Fi
- Bluetooth Classic
- BLE (Bluetooth Low Energy)
- ZigBee
- UWB (Ultra-Wideband)
- NFC
- RFID 125 kHz (LF)
- RFID 13.56 MHz (HF)
- RFID industrial UHF (860–960 MHz)

#### Redes de Longa Distância (LPWAN)
- LoRa
- LoRaWAN
- NB-IoT
- Cat-M1
- Sigfox
- WirelessHART
- ISA100

#### Protocolos IoT e de Aplicação
- MQTT
- CoAP
- AMQP
- WebSocket
- OPC-UA
- BACnet
- KNX

#### Redes Ethernet Industriais
- Ethernet 10/100/1000
- Ethernet industrial
- Switch industrial
- Gateway industrial
- Conversor serial-Ethernet
- PTP (Precision Time Protocol)
- PPS (Pulse-Per-Second)
- Clock industrial distribuído

#### Modems e Comunicação Celular
- Modem 4G (Quectel EC21)
- Modem 5G (Quectel SIM7600)
- Modem industrial
- NB-IoT

#### Gateways e Conversores
- Conversor RS-485 ↔ USB
- Conversor TTL ↔ RS-232
- Conversor Modbus ↔ MQTT
- Gateway LoRaWAN
- Gateway OPC-UA
- Gateway Modbus ↔ MQTT
- Gateway Profibus ↔ Profinet
- Gateway CAN ↔ Ethernet
- Conversor de protocolo industrial (multi-fieldbus)

---

### 4.4 Segurança Funcional (Safety)

#### Dispositivos de Parada de Emergência
- Botão de emergência (E-Stop)
- Botão cogumelo com trava
- Botão de rearme (reset)
- Botão de parada segura
- Chave de emergência com cabo (pull-cord)
- Parada de emergência (E-Stop) com monitoramento

#### Cortinas e Scanners de Segurança
- Cortina de luz Tipo 2
- Cortina de luz Tipo 4
- Cortina de luz com muting
- Cortina de luz com blanking
- Cortina de luz para proteção de mãos/dedos
- Scanner a laser de segurança (SICK S300)
- Scanner a laser de segurança (SICK S3000)
- Scanner a laser de segurança (Pilz)
- Scanner a laser com zonas configuráveis
- Scanner a laser com muting
- Tapete de segurança (safety mat)

#### Chaves e Sensores de Segurança
- Chave de segurança com trava eletromecânica
- Chave de segurança com trava magnética
- Chave de segurança com atuador separado
- Chave de segurança RFID
- Sensor de porta/janela industrial (safety rated)
- Sensor de posição de segurança
- Sensor de velocidade segura (SLS)
- Sensor de parada segura (SOS)
- Sensor de zona segura
- Sensor de pressão de segurança (SIL-rated)

#### Relés e Controladores de Segurança
- Relé de segurança (PNOZ)
- Relé de segurança (Schmersal)
- Relé de segurança com dupla redundância
- Módulo de segurança configurável
- Safety PLC / controlador de segurança
- Safety I/O (entrada/saída segura)
- Safety controller modular
- Safety controller com fieldbus seguro

#### Proteções Físicas e de Perímetro
- Porta de segurança com bloqueio (safety gate interlock)
- Portão de segurança com intertravamento
- Grade de proteção industrial
- Proteção de perímetro
- Barreira física de proteção
- Proteções móveis com intertravamento
- Proteções fixas certificadas

#### Intertravamentos
- Intertravamento mecânico
- Intertravamento eletromecânico
- Intertravamento magnético
- Intertravamento RFID
- Intertravamento com bloqueio por solenoide
- Atuador com STO (Safe Torque Off)
- Válvula pneumática de segurança
- Válvula hidráulica de segurança
- Contator com monitoramento
- Módulo de monitoramento de velocidade segura

#### Detecção de Riscos
- Detector de fumaça industrial
- Detector de chama UV/IR
- Detector de gás inflamável
- Detector de gás tóxico
- Detector de CO₂ industrial

#### Protocolos de Segurança
- Profisafe
- CIP Safety
- FSoE (Fail-Safe over EtherCAT)
- Safety over IO-Link
- Safety over CAN

#### Funções de Segurança (Safety Functions)
- STO — Safe Torque Off
- SS1 / SS2 — Safe Stop 1 / 2
- SLS — Safe Limited Speed
- SLP — Safe Limited Position / Pressure / Power
- SDI — Safe Direction
- Safe Motion

#### Normas e Documentação
- Análise de risco (ISO 12100)
- Níveis de Performance (PL) — ISO 13849
- SIL (Safety Integrity Level) — IEC 62061
- Validação de segurança funcional
- Documentação de segurança funcional
- Segurança integrada em drives
- Segurança integrada em robôs
- Segurança integrada em PLCs
- Segurança distribuída com redundância

---

### 4.5 Pesagem, Balança e Rastreabilidade

#### Células de Carga
- Célula de carga tipo barra / single-point
- Célula de carga tipo S (S-beam)
- Célula de carga tipo shear beam
- Célula de carga tipo coluna
- Célula de carga de compressão
- Célula de carga de tração
- Célula de carga sanitária (CIP/SIP)
- Célula de carga para tanques e silos
- Kit de pesagem para tanques

#### Indicadores e Transmissores de Peso
- Indicador de peso digital
- Indicador de peso industrial com relés
- Indicador de peso com comunicação Modbus
- Indicador de peso com comunicação Profibus
- Indicador de peso com comunicação Ethernet/IP
- Conversor de célula de carga (amplificador / ADC)
- Transmissor de pesagem 4–20 mA
- Transmissor de peso com Modbus
- Transmissor de peso com Ethernet

#### Balanças Industriais
- Balança industrial de bancada
- Balança de piso
- Balança de plataforma
- Balança de precisão
- Balança analítica
- Balança de faixa (checkweigher)
- Balança contadora

#### Dosagem
- Dosagem gravimétrica
- Dosagem volumétrica
- Dosagem por perda de peso (loss-in-weight)
- Dosagem por batelada (batching)
- Dosagem contínua

#### Leitores e Identificação
- Leitor de código de barras 1D
- Leitor de código de barras 2D (DataMatrix, QR)
- Leitor QR industrial
- Leitor OCR industrial
- Leitor DPM (Direct Part Marking)
- Scanner de etiquetas industriais

#### RFID e Tags
- RFID 125 kHz (LF)
- RFID 13.56 MHz (HF)
- RFID UHF industrial (860–960 MHz)
- Antena RFID direcional
- Antena RFID de longo alcance
- Tag RFID industrial resistente a químicos
- Tag para alta temperatura
- Tag para rastreabilidade de ativos

#### Impressão e Etiquetagem
- Impressora térmica industrial
- Impressora de etiquetas por transferência térmica
- Aplicador automático de etiquetas
- Sistema de etiquetagem inline

#### Sistemas de Rastreabilidade
- Rastreabilidade de lotes
- Rastreabilidade de produção
- Rastreabilidade de matéria-prima
- Rastreabilidade de embalagem
- Rastreabilidade por visão (OCR + código + DPM)
- Sistema de rastreabilidade por RFID + gateway IoT
- Sistema de contagem por visão (machine vision)
- Sistema de conferência de volumes

#### Integração de Pesagem e Rastreabilidade
- Pesagem ↔ PLC
- Pesagem ↔ SCADA
- Pesagem ↔ MES
- Rastreabilidade ↔ ERP
- Rastreabilidade ↔ IoT

---

## NÍVEL 5 — SISTEMAS COMPLEXOS (IoT / IA / Visão Computacional / SCADA)
> Sistemas de alto nível que integram múltiplos domínios, RTOS, pilha de rede e inteligência embarcada.

---

### 5.1 Robótica e Manipulação

#### Estruturas e Manipuladores
- Manipulador cartesiano (XYZ)
- Manipulador SCARA
- Manipulador articulado (3–7 eixos)
- Manipulador delta
- Manipulador paralelo
- Manipulador colaborativo (cobot)

#### Garras e Ferramentas
- Garra paralela
- Garra angular
- Garra pneumática
- Garra elétrica
- Garra magnética
- Garra de vácuo
- Garra adaptativa (flexível)
- Ferramenta de solda
- Ferramenta de parafusamento
- Ferramenta de corte

#### Sensores para Robótica
- Câmera RGB-D
- Câmera estéreo
- Câmera global shutter
- Sistema de visão 3D
- Sistema de visão para pick-and-place
- Sensor de força 1 eixo
- Sensor de força 3 eixos
- Sensor de torque
- Sensor de força/torque 6DOF
- Sensor de força para cobots
- IMU para robótica
- Sensor de posição magnético
- Encoder absoluto multivoltas
- Encoder incremental de alta resolução
- Resolver industrial

#### Controladores de Robôs
- Controlador de robô industrial
- Controlador de robô colaborativo
- Controlador de robô cartesiano
- Controlador de robô SCARA
- Controlador com segurança integrada (Safe Motion)

#### Atuadores para Robótica
- Servo motor industrial
- Servo motor de alta precisão
- Motor BLDC com encoder
- Atuador harmônico (harmonic drive)
- Atuador de junta robótica integrado

#### Veículos Autônomos
- AGV (Automated Guided Vehicle)
- AMR (Autonomous Mobile Robot)
- Robô de inspeção
- Robô de entrega
- Robô de limpeza industrial
- Robô cartesiano de alta velocidade
- Robô delta para picking
- Robô de soldagem
- Robô de pintura
- Robô de paletização

#### Navegação e Localização
- SLAM óptico
- SLAM LiDAR
- Navegação por fusão sensorial (IMU + GNSS + visão)
- Localização indoor UWB
- Navegação autônoma para AGVs / AMRs

---

### 5.2 Sistemas IoT e Edge Computing

#### Plataformas IoT
- Plataforma IoT local (on-premise)
- Plataforma IoT em nuvem
- Plataforma IoT híbrida
- Plataforma IoT industrial (IIoT)
- Plataforma IoT com dashboards integrados

#### Gateways IoT
- Gateway IoT industrial
- Gateway IoT com Modbus
- Gateway IoT com CAN
- Gateway IoT com OPC-UA
- Gateway IoT com MQTT
- Gateway IoT com 4G/5G

#### Edge Computing
- Edge computer industrial
- Edge gateway com IA
- Edge device com Linux embarcado
- Edge device com containers (Docker)
- Edge device com acelerador de IA

#### Infraestrutura em Nuvem
- Armazenamento em nuvem
- Banco de dados em nuvem
- Processamento em nuvem
- Funções serverless
- Pipelines de dados

#### Segurança e Conectividade IoT
- Autenticação por certificado
- Criptografia TLS
- VPN industrial
- Firewall IoT
- Monitoramento de integridade

#### Monitoramento e Análise IoT
- Coleta de dados em tempo real
- Dashboards IoT
- Alarmes e notificações
- Registro histórico (logging)
- Monitoramento preditivo

#### Integração IoT
- IoT ↔ SCADA
- IoT ↔ MES
- IoT ↔ ERP
- IoT ↔ PLC
- IoT ↔ Robôs

#### Manutenção Preditiva via IoT
- Análise de vibração
- Análise de corrente
- Análise de temperatura
- Modelos preditivos
- Edge + Cloud analytics

---

### 5.3 Computação Embarcada

#### Microcontroladores
- Microcontrolador 8 bits
- Microcontrolador 16 bits
- Microcontrolador 32 bits
- Microcontrolador ARM Cortex-M
- Microcontrolador RISC-V
- Microcontrolador automotivo

#### Placas de Desenvolvimento
- Arduino Uno
- Arduino Mega
- Arduino Nano
- STM32 Nucleo
- STM32 Discovery
- Raspberry Pi Pico
- BeagleBone Black
- BeagleBone AI
- Raspberry Pi
- Raspberry Pi Compute Module
- UP Board

#### Módulos de IA e GPU Embarcada
- Jetson Nano
- Jetson Xavier
- Jetson Orin

#### Sistemas Operacionais Embarcados (RTOS / Linux)
- FreeRTOS
- Zephyr RTOS
- Mbed OS
- Linux embarcado
- Yocto
- Buildroot

#### Módulos e Expansões
- Shields Arduino
- HATs Raspberry Pi
- Módulos de relé
- Módulos de sensores
- Módulos de comunicação

#### Processamento de Sinal Embarcado
- DSP embarcado
- Filtros digitais
- Conversores ADC/DAC
- Processamento de áudio embarcado
- Processamento de vibração embarcado

#### Aceleradores de IA em Hardware
- NPU embarcada
- GPU embarcada
- FPGA para IA
- Jetson (GPU integrada)

#### Armazenamento Embarcado
- SD Card
- eMMC
- Flash NOR
- Flash NAND
- NVMe

#### Segurança Embarcada
- Secure Element
- TPM embarcado
- Boot seguro
- Criptografia embarcada
- Assinatura de firmware

#### Ferramentas de Desenvolvimento
- IDEs (Arduino IDE, STM32CubeIDE, PlatformIO)
- Depuradores JTAG/SWD
- Programadores ISP
- Emuladores de hardware

---

### 5.4 IA Embarcada (Edge AI)

#### Hardware para Inferência
- NPU embarcada
- TPU (Tensor Processing Unit)
- GPU embarcada
- FPGA para IA
- ASICs especializados em inferência
- Jetson (Nano, Xavier, Orin)

#### Frameworks de IA Embarcada
- TensorFlow Lite
- PyTorch Mobile
- ONNX Runtime
- OpenVINO
- TensorRT
- Edge Impulse

#### Aplicações de IA em Edge
- Detecção de objetos embarcada
- Classificação de imagens embarcada
- Segmentação semântica embarcada
- Rastreamento de objetos
- OCR embarcado
- IA para vibração (manutenção preditiva)
- IA para áudio (detecção de anomalias)
- IA para sensores de gás
- IA para sensores de energia
- IA para fusão sensorial (IMU + GNSS + visão)

#### Robótica Inteligente com IA
- Planejamento de movimento com IA
- Controle adaptativo
- SLAM com IA
- Navegação autônoma com IA
- Manipulação inteligente (grasping)

#### IA em Sistemas Industriais
- Classificação de eventos em edge
- Detecção de falhas em edge
- Compressão inteligente de dados
- Modelos leves para dispositivos IoT

#### Otimização de Modelos
- Quantização (INT8, INT4)
- Pruning (poda de redes neurais)
- Knowledge distillation
- Modelos tinyML
- Modelos embarcados sob demanda

#### Aplicações Industriais de IA
- Detecção de anomalias em máquinas
- Previsão de falhas
- Controle preditivo de processos
- Inspeção visual automatizada
- Otimização de processos

#### Ferramentas e SDKs
- Edge Impulse Studio
- TensorFlow Model Optimization Toolkit
- ONNX Quantization Tools
- NVIDIA JetPack SDK
- OpenCV embarcado

---

### 5.5 Sistemas de Supervisão, Controle e Automação

#### SCADA
- SCADA local (on-premise)
- SCADA em nuvem
- SCADA híbrido
- SCADA com OPC-UA
- SCADA com Modbus
- SCADA com dashboards avançados

#### MES (Manufacturing Execution System)
- MES para rastreabilidade
- MES para controle de produção
- MES para OEE
- MES para qualidade
- MES integrado com ERP

#### Estratégias de Controle
- Controle PID
- Controle PID avançado (feedforward)
- Controle MPC (Model Predictive Control)
- Controle adaptativo
- Controle distribuído (DCS)
- Controle baseado em IA
- Controle preditivo
- Controle multivariável
- Controle distribuído inteligente

#### PLCs e I/O
- PLC compacto
- PLC modular
- PLC de segurança (Safety PLC)
- PLC com Ethernet
- PLC com fieldbus industrial
- PLC com I/O remoto
- Módulo de I/O digital
- Módulo de I/O analógico
- Módulo de I/O com relés
- Módulo de I/O com 4–20 mA
- I/O remoto via EtherCAT
- I/O remoto via Profinet

#### Alarmes e Notificações
- Alarmes de processo
- Alarmes de segurança
- Alarmes de qualidade
- Alarmes com notificação remota
- Alarmes com análise preditiva

#### Historian e Armazenamento de Dados
- Historian local
- Historian em nuvem
- Historian para alta frequência
- Historian com compressão inteligente
- Historian integrado ao SCADA

#### Dashboards e Visualização
- Dashboard SCADA
- Dashboard IoT
- Dashboard MES
- Dashboard de manutenção preditiva
- Dashboard de energia

#### Integração de Sistemas
- SCADA ↔ Cloud
- PLC ↔ Cloud
- Historian ↔ Cloud
- Edge ↔ Cloud
- Gateway IoT ↔ Cloud

---

*Fim do documento — Versão reorganizada e consolidada*
