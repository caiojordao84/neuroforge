from machine import Pin, ADC, I2C, PWM  # Importa classes necessárias do módulo machine para controle de hardware.
import utime 						    # Importa o módulo utime para funções de tempo.
from pico_i2c_lcd import I2cLcd 	    # Importa a biblioteca específica para o módulo LCD I2C.
from hcsr04 import HCSR04 			    # Importa a biblioteca para o sensor de distância ultrassônico HC-SR04.

# --- Configuração de Constantes Globais ---
H=300 								    # Altura total do reservatório em cm.
M=20 								    # Nível mínimo de enchimento em cm.
L=5 								    # Margem de tolerância/histerese em cm.
CRIT_LOW=10 						    # Limiar crítico baixo em cm.
CRIT_HIGH=10 						    # Margem crítica alta em cm.
DEBOUNCE_TIME_MS = 300 			        # Tempo de debounce para o botão (em milissegundos).

# --- Configuração do Display LCD (I2C) ---
A=0x27 							        # Endereço I2C do módulo LCD.
R=2 								    # Número de linhas do LCD.
C=16 								    # Número de colunas do LCD.
i=I2C(0,sda=Pin(0),scl=Pin(1),freq=400000) # Inicializa o barramento I2C 0.
d=I2cLcd(i,A,R,C) 					    # Cria a instância do objeto LCD.

# --- Configuração de Periféricos ---
p=ADC(Pin(26)) 					        # Inicializa o Canal ADC no pino GP26 (Potenciômetro).
s=HCSR04(trigger_pin=16,echo_pin=17)    # Inicializa o sensor HC-SR04.

v_pin = Pin(15) 					    # Define o pino GP15 para o controle do servomotor (válvula).
v = PWM(v_pin) 					        # Cria o objeto PWM (v).
v.freq(50) 						        # Define a frequência do PWM para 50 Hz.

l=Pin(20, Pin.OUT) 				        # Define o pino GP20 como saída (LED indicador de válvula aberta).
l.value(0) 						        # Inicializa o LED desligado.

b=PWM(Pin(18)) 					        # Define o pino GP18 para o Buzzer (alarme).
b.freq(1000) 						    # Define a frequência do PWM para 1000 Hz.
b.duty_u16(0) 						    # Inicializa o Buzzer desligado.

btn=Pin(19, Pin.IN, Pin.PULL_DOWN)      # Define o pino GP19 como entrada (botão manual) com pull-down interno.

# --- Variáveis de Estado ---
o=False 							    # Variável booleana 'o' (aberta), False = Válvula fechada.
alarming=False 					        # Flag booleana 'alarming', False = Alarme (buzzer) inativo.
# Variável de controle de debounce para interrupção:
last_toggle_time = utime.ticks_ms()     # Guarda o tempo da última troca de estado da válvula.

# --- Constantes de PWM para Servomotor (0º a 180º) ---
MIN_DUTY = 1966 					    # Valor de duty cycle para 0 graus (válvula fechada).
MAX_DUTY = 7864 					    # Valor de duty cycle para 180 graus (válvula aberta).

# --- Funções do Sistema ---

def set_servo_angle(angle):
	""" Define a posição do servomotor em graus (0-180). """
	angle = max(0, min(180, angle))     # Garante que o ângulo esteja entre 0 e 180 graus.
	duty = int(MIN_DUTY + (MAX_DUTY - MIN_DUTY) * (angle / 180.0))
	v.duty_u16(duty) 				    # Aplica o novo duty cycle ao servomotor.

def set_valvula(aberta):
	""" Controla o estado da válvula (aberta/fechada) e o LED indicador. """
	global o 						    # Declara 'o' como global para modificar o estado da válvula.
	o = aberta 					        # Atualiza a variável de estado da válvula.
	if o: 							    # Se a válvula deve estar aberta (True):
		set_servo_angle(180) 		    # Gira o servo para 180 graus (totalmente aberta).
		l.value(1) 				        # Acende o LED (l).
	else: 							    # Se a válvula deve estar fechada (False):
		set_servo_angle(0) 		        # Gira o servo para 0 graus (totalmente fechada).
		l.value(0) 				        # Apaga o LED (l).

def toggle_valvula():
	""" Inverte o estado atual da válvula (aberta <-> fechada). """
	set_valvula(not o) 			        # Chama set_valvula com o estado oposto ao atual.

# --- Rotina de Serviço de Interrupção (ISR) para o Botão ---
def button_interrupt_handler(pin):
	"""
	Esta função é executada imediatamente quando o estado do pino (btn) muda.
	A lógica de debounce impede que múltiplos eventos sejam registrados.
	"""
	global last_toggle_time 		    # Acesso à variável global de tempo.
	current_time = utime.ticks_ms()     # Lê o tempo atual em ms.

	# Verifica se o tempo decorrido desde o último acionamento válido é maior que o tempo de debounce
	if utime.ticks_diff(current_time, last_toggle_time) > DEBOUNCE_TIME_MS:
		toggle_valvula() 			    # Aciona a troca de estado da válvula.
		last_toggle_time = current_time # Atualiza o tempo do último acionamento.

# --- Configuração da Interrupção (IRQ) ---
# btn.irq configura uma interrupção:
#  - trigger=Pin.IRQ_RISING: O evento de interrupção é ativado na borda de subida (quando o botão é pressionado).
#  - handler=button_interrupt_handler: A função a ser chamada quando o evento ocorrer.
btn.irq(trigger=Pin.IRQ_RISING, handler=button_interrupt_handler)


# --- Inicialização do Sistema ---
d.putstr("Iniciando...") 			    # Exibe mensagem inicial no LCD.
set_valvula(False) 				        # Garante que a válvula comece fechada.
b.duty_u16(0) 						    # Garante que o buzzer esteja desligado.
utime.sleep(2) 					        # Pausa de 2 segundos.
d.clear() 							    # Limpa o LCD.


# --- Loop Principal do Programa ---
while True: 						    # Loop infinito de execução do sistema.
		
	# --- Leitura do Nível Pretendido (Setpoint) ---
	# t: Nível Pretendido (em cm)
	t=int((p.read_u16()/65535)*H) 	    # Lê o valor ADC e mapeia para 0-H cm.
	if t<=M:t=M+1 					    # Garante que o setpoint (t) seja pelo menos M+1.
	
	# --- Leitura e Processamento do Sensor Ultrassônico (Média) ---
	dists = [] 					        # Lista para armazenar as leituras de distância.
	for _ in range(5): 			        # Faz 5 leituras para calcular a média.
		try:
			dists.append(s.distance_cm())
		except OSError:
			dists.append(H) 		    # Fallback em caso de erro.
			
	# u: Distância Vazida Média (em cm)
	u = sum(dists) / len(dists) if dists else H
	# n: Nível Atual (em cm)
	n=H-u                               # Calcula o nível atual.
	# Clamping/Saturação: Garante que o nível n esteja dentro do intervalo [0, H]
	n=0 if n<0 else H if n>H else int(n)
	
	# --- Lógica de Controle de Enchimento (Histerese) ---
	if not o: 						    # Se a válvula está FECHADA:
		if n<=M: 					    # E o nível atual for MENOR ou IGUAL ao mínimo (20cm):
			set_valvula(True) 		    # ABRE a válvula.
	else: 							    # Se a válvula está ABERTA:
		if n>=(t-L): 				    # E o nível atual for MAIOR ou IGUAL ao Setpoint menos a Histerese:
			set_valvula(False) 	        # FECHA a válvula.
	
	# --- Lógica de Alarme Crítico (Buzzer) ---
	if n < CRIT_LOW or n > (t + CRIT_HIGH):
		if not alarming:
			b.duty_u16(32768) 		    # Ativa o Buzzer.
			alarming = True
	else:
		if alarming:
			b.duty_u16(0) 			    # Desativa o Buzzer.
			alarming = False
	
	# --- Atualização do Display LCD ---
	d.clear() 						    # Limpa o display.
	d.move_to(0,0)
	d.putstr(f"Pret: {t:>3}cm") 	    # Exibe o Nível Pretendido.
	d.move_to(0,1)
	d.putstr(f"Atual: {n:>3}cm") 	    # Exibe o Nível Atual.
	
	utime.sleep_ms(500) 			    # Pausa de 500 ms antes da próxima leitura do loop.