import os
import re
import xml.etree.ElementTree as ET
from kivy.app import App
from kivy.uix.widget import Widget
from kivy.uix.floatlayout import FloatLayout
from kivy.graphics import Color, Ellipse, Rectangle, PushMatrix, PopMatrix, Translate, Scale
from kivy.uix.behaviors import DragBehavior
from kivy.core.window import Window

try:
    from kivy.graphics.svg import Svg
    HAS_SVG = True
except ImportError:
    HAS_SVG = False

SVG_NS = 'http://www.w3.org/2000/svg'


def extract_pins_from_svg(svg_path):
    """
    Extrai coordenadas reais dos pinos directamente do SVG.

    Convenção dos assets DendriForge:
      - Pinos são <circle class="pin [pin-digital|pin-analog|pin-power|pin-ground]">
      - Atributos: id="pin-{label}", data-pin="{number|name}", cx, cy (no viewBox)
      - Atributos opcionais: data-pwm, data-adc, data-i2c, data-uart

    Retorna:
      pins    -- lista de dicts com coordenadas normalizadas (rel_x, rel_y)
      vb_w    -- largura do viewBox (para scaling no canvas)
      vb_h    -- altura do viewBox
    """
    tree = ET.parse(svg_path)
    root = tree.getroot()

    viewbox = root.get('viewBox', '0 0 171 129').split()
    vb_w = float(viewbox[2])
    vb_h = float(viewbox[3])

    pins = []
    for elem in root.iter(f'{{{SVG_NS}}}circle'):
        cls = elem.get('class', '')
        if 'pin' not in cls:
            continue

        cx = float(elem.get('cx', 0))
        cy = float(elem.get('cy', 0))

        # Determinar cor do pino por tipo
        if 'pin-analog' in cls:
            color = (1.0, 0.5, 0.0, 1.0)   # laranja
        elif 'pin-power' in cls:
            color = (1.0, 0.2, 0.2, 1.0)   # vermelho
        elif 'pin-ground' in cls:
            color = (0.3, 0.3, 1.0, 1.0)   # azul
        elif 'pin-icsp' in cls:
            color = (0.8, 0.8, 0.0, 1.0)   # amarelo
        else:
            color = (0.2, 1.0, 0.2, 1.0)   # verde (digital)

        pins.append({
            'id':    elem.get('id', ''),
            'pin':   elem.get('data-pin', ''),
            'type':  elem.get('data-type', 'digital'),
            'cx':    cx,
            'cy':    cy,
            'rel_x': cx / vb_w,
            'rel_y': cy / vb_h,
            'pwm':   elem.get('data-pwm') == 'true',
            'adc':   elem.get('data-adc') == 'true',
            'i2c':   elem.get('data-i2c'),
            'uart':  elem.get('data-uart'),
            'color': color,
        })

    return pins, vb_w, vb_h


def extract_animatables_from_svg(svg_path):
    """
    Extrai elementos animáveis do SVG: LEDs, botões.

    Convenção dos assets DendriForge:
      - LEDs: <circle class="led led-{colour}" data-state="off|on"
               data-linked-pin="{pin_number}">
      - Botões: <g class="button" id="...">

    Usado na Fase 3 para feedback visual reactivo ao estado da simulação.
    """
    tree = ET.parse(svg_path)
    root = tree.getroot()
    animatables = []

    for elem in root.iter(f'{{{SVG_NS}}}circle'):
        cls = elem.get('class', '')
        if 'led' not in cls:
            continue
        animatables.append({
            'id':         elem.get('id'),
            'type':       'led',
            'linked_pin': elem.get('data-linked-pin'),
            'state':      elem.get('data-state', 'off'),
            'cx':         float(elem.get('cx', 0)),
            'cy':         float(elem.get('cy', 0)),
        })

    for elem in root.iter(f'{{{SVG_NS}}}g'):
        cls = elem.get('class', '')
        if 'button' in cls:
            animatables.append({
                'id':   elem.get('id'),
                'type': 'button',
            })

    return animatables


def load_toon_board(filepath):
    """
    Lê metadados lógicos do ficheiro .toon.

    Responsabilidade do TOON: família MCU, periféricos (UART/SPI/I2C),
    flags de simulação (pwm, adc, interrupt). NÃO contém coordenadas visuais
    -- essas são propriedade exclusiva do SVG.
    """
    toon_data = {'gpio': []}

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    match_img = re.search(r'image:\s*"([^"]+)"', content)
    if match_img:
        toon_data['image'] = os.path.basename(match_img.group(1))

    match_id = re.search(r'^id:\s*(\S+)', content, re.MULTILINE)
    if match_id:
        toon_data['id'] = match_id.group(1)

    match_mcu = re.search(r'^mcu:\s*"([^"]+)"', content, re.MULTILINE)
    if match_mcu:
        toon_data['mcu'] = match_mcu.group(1)

    # Header format: gpio: [N]{pin,label,type,pwm,adc,interrupt}:
    gpio_section = re.search(
        r'gpio:\s*\[.*?\].*?:\n((?:[ \t]+\S.*\n?)*)', content
    )
    if gpio_section:
        lines = [l.strip() for l in gpio_section.group(1).strip().split('\n') if l.strip()]
        for line in lines:
            parts = [p.strip() for p in line.split(',')]
            if len(parts) >= 2:
                toon_data['gpio'].append({
                    'pin':       parts[0],
                    'label':     parts[1],
                    'type':      parts[2] if len(parts) > 2 else 'digital',
                    'pwm':       parts[3] == 'true' if len(parts) > 3 else False,
                    'adc':       parts[4] == 'true' if len(parts) > 4 else False,
                    'interrupt': parts[5] == 'true' if len(parts) > 5 else False,
                })

    return toon_data


class DraggableBoard(DragBehavior, Widget):
    """
    Widget arrastável que representa uma board no canvas DendriForge.

    - svg_path : caminho para o .svg (fonte de verdade das coordenadas)
    - toon_data: dict carregado por load_toon_board() (lógica/metadados)
    """

    def __init__(self, svg_path, toon_data, **kwargs):
        super().__init__(**kwargs)
        self.toon_data = toon_data
        self.svg_path = svg_path

        # Extrair pinos e animáveis do SVG
        if os.path.exists(svg_path):
            self.pins, self.svg_vb_w, self.svg_vb_h = extract_pins_from_svg(svg_path)
            self.animatables = extract_animatables_from_svg(svg_path)
        else:
            print(f"[WARN] SVG não encontrado: {svg_path}. Usando mock.")
            self.pins = [{'id': 'mock', 'pin': '0', 'rel_x': 0.5, 'rel_y': 0.5,
                          'color': (1, 0, 0, 1)}]
            self.svg_vb_w, self.svg_vb_h = 171.0, 129.0
            self.animatables = []

        # Tentar carregar SVG para renderização Kivy
        self.kivy_svg = None
        if HAS_SVG and os.path.exists(svg_path):
            try:
                self.kivy_svg = Svg(svg_path)
            except Exception as e:
                print(f"[WARN] Kivy SVG renderer falhou: {e}")

        self.bind(pos=self.update_graphics, size=self.update_graphics)

    def update_graphics(self, *args):
        self.canvas.clear()
        with self.canvas:
            # Fundo de fallback (visível se o SVG não renderizar)
            Color(0.2, 0.25, 0.3, 1)
            Rectangle(pos=self.pos, size=self.size)

            # Renderizar SVG escalado ao tamanho do widget
            if self.kivy_svg:
                PushMatrix()
                Translate(self.pos[0], self.pos[1])
                scale_x = self.size[0] / self.kivy_svg.width  if self.kivy_svg.width  else 1.0
                scale_y = self.size[1] / self.kivy_svg.height if self.kivy_svg.height else 1.0
                Scale(scale_x, scale_y, 1)
                self.kivy_svg.draw()
                PopMatrix()

            # Desenhar pinos com cor por tipo (extraídos do SVG)
            for pin in self.pins:
                r, g, b, a = pin['color']
                Color(r, g, b, a)
                px = self.pos[0] + pin['rel_x'] * self.size[0]
                # SVG usa Y de cima para baixo; Kivy usa Y de baixo para cima
                py = self.pos[1] + (1.0 - pin['rel_y']) * self.size[1]
                Ellipse(pos=(px - 5, py - 5), size=(10, 10))


class DendriForgePrototypeApp(App):
    def build(self):
        Window.clearcolor = (0.1, 0.1, 0.1, 1)
        root = FloatLayout()

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        boards_dir = os.path.join(base_dir, 'dendriforge', 'core', 'boards')

        # Fallback para execução isolada fora da raiz do projecto
        if not os.path.isdir(boards_dir):
            boards_dir = os.path.join(os.getcwd(), 'dendriforge', 'core', 'boards')

        svg_path  = os.path.join(boards_dir, 'arduino-uno-r3.svg')
        toon_path = os.path.join(boards_dir, 'arduino-uno-r3.toon')

        toon_data = load_toon_board(toon_path) if os.path.exists(toon_path) else {}

        board = DraggableBoard(
            svg_path=svg_path,
            toon_data=toon_data,
            size_hint=(None, None),
            size=(300, 220),  # aspect ratio ~171:129 do viewBox
            pos=(200, 200),
        )
        root.add_widget(board)

        print(f"[INFO] Board: {toon_data.get('id', 'unknown')} "
              f"| MCU: {toon_data.get('mcu', '?')} "
              f"| Pinos SVG: {len(board.pins)} "
              f"| Animáveis: {len(board.animatables)}")

        return root


if __name__ == '__main__':
    DendriForgePrototypeApp().run()
