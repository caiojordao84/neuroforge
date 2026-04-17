from machine import Pin, I2C, PWM, ADC
import ssd1306
import framebuf
import time
from image_buf import BUF

C = 200

H = "main"
M = "STATUS"
L = "PORTA"
A = "VENT."
R = "SOM"

i = {
    H: [M, L, A, R],
    M: ["LIVRE", "OCUPADO", "AUSENTE", "EMERGENCIA", "SAIR", "VOLTAR"],
    L: ["ABERTO", "FECHADO", "VOLTAR"],
    A: ["LIGAR", "DESLIGAR", "VOLTAR"],
    R: ["TOCAR", "CHAMAR", "EMERGENCIA", "VOLTAR"],
}

d = ["CAIO", "VISITANTE"]


class HardwareManager:
    def __init__(self):
        self.i2c = I2C(0, sda=Pin(8), scl=Pin(9), freq=400_000)
        self.oled = ssd1306.SSD1306_I2C(128, 64, self.i2c, addr=0x3C)
        self.joy_y = ADC(Pin(1)); self.joy_y.atten(ADC.ATTN_11DB)
        self.joy_x = ADC(Pin(2)); self.joy_x.atten(ADC.ATTN_11DB)
        self.btn = Pin(4, Pin.IN, Pin.PULL_UP)
        self.servo = PWM(Pin(13), freq=50)
        self.relay = Pin(14, Pin.OUT)
        self.buzzer = PWM(Pin(15), freq=1000, duty=0)
        self.rgb_r = PWM(Pin(10), freq=1000, duty=0)
        self.rgb_g = PWM(Pin(11), freq=1000, duty=0)
        self.rgb_b = PWM(Pin(12), freq=1000, duty=0)
        self.last_input_time = 0

    def read_input(self):
        u = time.ticks_ms()
        if time.ticks_diff(u, self.last_input_time) < C:
            return None
        if self.btn.value() == 0:
            self.last_input_time = u
            return "CLICK"
        n = self.joy_y.read()
        if n > 3000:
            self.last_input_time = u
            return "UP"
        elif n < 1000:
            self.last_input_time = u
            return "DOWN"
        t = self.joy_x.read()
        if t > 3000:
            self.last_input_time = u
            return "LEFT"
        elif t < 1000:
            self.last_input_time = u
            return "RIGHT"
        return None

    def set_rgb(self, H, M, L):
        self.rgb_r.duty(H * 1023)
        self.rgb_g.duty(M * 1023)
        self.rgb_b.duty(L * 1023)

    def set_servo(self, p):
        s = int(26 + (p / 180) * 102)
        self.servo.duty(s)

    def set_relay(self, l):
        self.relay.value(1 if l else 0)

    def tone(self, b, o=0):
        if b <= 0:
            self.buzzer.duty(0)
        else:
            self.buzzer.freq(b)
            self.buzzer.duty(512)
        if o > 0:
            time.sleep_ms(o)
            self.buzzer.duty(0)


class SystemState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.rgb_mode = "OFF"
        self.gate_mode = "FECHADO"
        self.fan_mode = "DESLIGAR"
        self.emergency_active = False
        self.operator = "N/A"
        self.menu_stack = [H]
        self.cursor_pos = 0

    def update_hardware(self, v):
        if self.emergency_active:
            return
        if self.rgb_mode == "OFF":
            v.set_rgb(0, 0, 0)
        elif self.rgb_mode == "LIVRE":
            v.set_rgb(0, 1, 0)
        elif self.rgb_mode == "OCUPADO":
            v.set_rgb(1, 0, 0)
        elif self.rgb_mode == "AUSENTE":
            v.set_rgb(1, 1, 0)
        v.set_servo(0 if self.gate_mode == "ABERTO" else 90)
        v.set_relay(self.fan_mode == "LIGAR")


class UIManager:
    def __init__(self, u):
        self.hw = u
        self.oled = u.oled

    def show_intro(self):
        p = bytearray(s ^ 0xFF for s in BUF)
        v = framebuf.FrameBuffer(p, 128, 64, framebuf.MONO_HLSB)
        self.oled.fill(0)
        self.oled.blit(v, 0, 0)
        self.oled.show()
        time.sleep(3)
        self.oled.invert(1)
        time.sleep(0.1)
        self.oled.invert(0)

    def draw_menu_quadrant(self, u, n, t):
        self.oled.fill(0)
        self.oled.fill_rect(0, 0, 128, 10, 1)
        self.oled.text(t, 2, 1, 0)
        self.oled.vline(64, 10, 54, 1)
        self.oled.hline(0, 37, 128, 1)
        v = [(0, 10), (64, 10), (0, 37), (64, 37)]
        for l, b in enumerate(u):
            if l >= 4:
                break
            o = v[l]
            A = 0 if l == n else 1
            if l == n:
                self.oled.fill_rect(o[0], o[1], 64, 27, 1)
            R = o[0] + int((64 - (len(b) * 8)) / 2)
            self.oled.text(b, R, o[1] + 10, A)
        self.oled.show()

    def draw_menu_list(self, u, n, t):
        self.oled.fill(0)
        self.oled.fill_rect(0, 0, 128, 12, 1)
        self.oled.text(u, 2, 2, 0)
        for l, b in enumerate(n):
            o = ">" if l == t else " "
            self.oled.text(f"{o} {b}", 2, 16 + (l * 10))
        self.oled.show()

    def draw_popup_exit(self, u):
        self.oled.fill(0)
        self.oled.rect(10, 10, 108, 44, 1)
        self.oled.text("SAIR?", 45, 20, 1)
        self.oled.rect(20, 35, 30, 12, 1)
        if u:
            self.oled.fill_rect(20, 35, 30, 12, 1)
        self.oled.text("SIM", 23, 37, 0 if u else 1)
        self.oled.rect(70, 35, 30, 12, 1)
        if not u:
            self.oled.fill_rect(70, 35, 30, 12, 1)
        self.oled.text("NAO", 73, 37, 0 if not u else 1)
        self.oled.show()


def set_servo_angle(u, n):
    t = 0
    while True:
        u.oled.fill(0)
        u.oled.rect(0, 0, 128, 64, 1)
        u.oled.fill_rect(0, 0, 128, 12, 1)
        u.oled.text("LOGIN OPERADOR", 10, 2, 0)
        l = d[t]
        u.oled.text(f"< {l} >", 64 - (len(l) * 4), 30, 1)
        u.oled.text("Select p/ Entrar", 2, 52, 1)
        u.oled.show()
        b = u.read_input()
        if b == "UP" or b == "LEFT":
            t = (t - 1) % len(d)
        elif b == "DOWN" or b == "RIGHT":
            t = (t + 1) % len(d)
        elif b == "CLICK":
            u.tone(2000, 100)
            u.tone(3000, 100)
            return d[t]
        time.sleep_ms(10)


def set_valvula(u, n):
    n.emergency_active = True
    t = False
    print("!!! EMERGENCIA !!!")
    while True:
        u.set_rgb(1, 0, 0)
        u.tone(1200)
        u.oled.fill(0)
        u.oled.text("! EMERGENCIA !", 15, 25)
        if t:
            u.oled.text("PARAR?", 40, 45)
        u.oled.show()
        for l in range(10):
            if u.read_input() == "CLICK":
                if t:
                    return
                t = True
            time.sleep_ms(40)
        u.set_rgb(0, 0, 1)
        u.tone(800)
        u.oled.invert(1)
        time.sleep_ms(100)
        u.oled.invert(0)
        for l in range(10):
            if u.read_input() == "CLICK":
                if t:
                    return
                t = True
            time.sleep_ms(40)


def toggle_valvula(u, n):
    t = False
    while True:
        n.draw_popup_exit(t)
        l = u.read_input()
        if l == "LEFT":
            t = True
        elif l == "RIGHT":
            t = False
        elif l == "CLICK":
            return t
        time.sleep_ms(10)


def button_interrupt_handler():
    u = HardwareManager()
    n = UIManager(u)
    t = SystemState()
    u.set_servo(90)
    u.set_relay(False)
    n.show_intro()
    while True:
        l = set_servo_angle(u, n)
        t.reset()
        t.operator = l
        s = H
        p = 0
        o = False
        while not o:
            t.update_hardware(u)
            v = i[s]
            if s == H:
                n.draw_menu_quadrant(v, p, t.operator)
            else:
                n.draw_menu_list(s, v, p)
            b = u.read_input()
            if b:
                if s == H:
                    M_, L_ = p // 2, p % 2
                    if b == "UP":
                        M_ = max(0, M_ - 1)
                    elif b == "DOWN":
                        M_ = min(1, M_ + 1)
                    elif b == "LEFT":
                        L_ = max(0, L_ - 1)
                    elif b == "RIGHT":
                        L_ = min(1, L_ + 1)
                    p = M_ * 2 + L_
                else:
                    if b == "UP" or b == "LEFT":
                        p = max(0, p - 1)
                    elif b == "DOWN" or b == "RIGHT":
                        p = min(len(v) - 1, p + 1)
                if b == "CLICK":
                    A_ = v[p]
                    if A_ == "VOLTAR":
                        s = H
                        p = 0
                    elif s == H:
                        s = A_
                        p = 0
                    elif s == M and A_ == "SAIR":
                        if toggle_valvula(u, n):
                            o = True
                    else:
                        if s == M:
                            t.rgb_mode = A_
                        elif s == L:
                            t.gate_mode = A_
                        elif s == A:
                            t.fan_mode = A_
                        elif s == R:
                            if A_ == "TOCAR":
                                u.tone(1200, 2000)
                            elif A_ == "CHAMAR":
                                for R_ in range(3):
                                    u.tone(800, 500)
                                    time.sleep_ms(100)
                            elif A_ == "EMERGENCIA":
                                set_valvula(u, t)
                                t.emergency_active = False
                                t.rgb_mode = "OFF"
                                u.set_rgb(0, 0, 0)
                                u.tone(0)
                        if A_ == "EMERGENCIA" and s != R:
                            set_valvula(u, t)
                            t.emergency_active = False
                            t.rgb_mode = "OFF"
                            u.set_rgb(0, 0, 0)
                            u.tone(0)
                        if not o and A_ != "SAIR":
                            s = H
                            p = 0
            time.sleep_ms(10)
        u.set_rgb(0, 0, 0)
        u.set_relay(False)
        u.set_servo(90)
        u.tone(1000, 100)
        u.tone(600, 100)


button_interrupt_handler()