import os
import re
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

def load_toon_board(filepath):
    """
    Simula a leitura de um arquivo TOON extraindo as definições de pinos.
    De acordo com o novo plano, os arquivos TOON terão coordenadas (x, y).
    Como as coordenadas ainda não foram adicionadas aos TOONs existentes,
    o protótipo gera posições relativas baseadas na ordem dos pinos.
    """
    toon_data = {"pins": []}
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Extrair nome da imagem
    match_img = re.search(r'image:\s*"([^"]+)"', content)
    if match_img:
        toon_data["image"] = os.path.basename(match_img.group(1))
    
    # Extrair pinos (mock de coordenadas relativas)
    gpio_section = re.search(r'gpio:.*?\n((?:  .*\n)*)', content)
    if gpio_section:
        lines = gpio_section.group(1).strip().split('\n')
        for i, line in enumerate(lines):
            parts = line.strip().split(',')
            if len(parts) >= 2:
                pin_id = parts[0]
                label = parts[1]
                
                # Mock de coordenadas (rel_x, rel_y) para visualização
                rel_x = 0.1 if i % 2 == 0 else 0.9
                rel_y = 0.1 + (i / len(lines)) * 0.8
                
                toon_data["pins"].append({
                    "id": pin_id,
                    "label": label,
                    "rel_x": rel_x,
                    "rel_y": rel_y
                })
                
    return toon_data

class DraggableBoard(DragBehavior, Widget):
    def __init__(self, toon_data, image_dir, **kwargs):
        super().__init__(**kwargs)
        self.toon_data = toon_data
        
        # Tenta carregar o SVG definido no arquivo TOON
        self.image_path = os.path.join(image_dir, toon_data.get("image", "arduino-uno-r3.svg"))
        
        self.svg = None
        if HAS_SVG and os.path.exists(self.image_path):
            try:
                self.svg = Svg(self.image_path)
            except Exception as e:
                print(f"Erro ao carregar SVG: {e}")
                
        # Atualiza o canvas quando a posição/tamanho altera
        self.bind(pos=self.update_graphics, size=self.update_graphics)

    def update_graphics(self, *args):
        self.canvas.clear()
        with self.canvas:
            # Fallback: se o SVG não renderizar, exibe um retângulo base
            Color(0.2, 0.25, 0.3, 1)
            Rectangle(pos=self.pos, size=self.size)
            
            # Desenhar o SVG
            if self.svg:
                PushMatrix()
                Translate(*self.pos)
                scale_x = self.size[0] / self.svg.width if hasattr(self.svg, 'width') and self.svg.width else 1.0
                scale_y = self.size[1] / self.svg.height if hasattr(self.svg, 'height') and self.svg.height else 1.0
                Scale(scale_x, scale_y, 1)
                self.canvas.add(self.svg)
                PopMatrix()
                
            # Desenhar os pinos extraídos do TOON
            Color(1, 0, 0, 1) # Ponto Vermelho para cada pino
            for pin in self.toon_data.get("pins", []):
                # Calcular posição absoluta baseada na coordenada relativa
                px = self.pos[0] + pin.get("rel_x", 0) * self.size[0]
                py = self.pos[1] + pin.get("rel_y", 0) * self.size[1]
                
                # Desenhar pino como círculo
                Ellipse(pos=(px - 6, py - 6), size=(12, 12))

class DendriForgePrototypeApp(App):
    def build(self):
        Window.clearcolor = (0.1, 0.1, 0.1, 1)
        root = FloatLayout()
        
        # Caminho absoluto para a board de teste
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        boards_dir = os.path.join(base_dir, "dendriforge", "core", "boards")
        toon_path = os.path.join(boards_dir, "arduino-uno-r3.toon")
        
        # Se não encontrar no diretório parente (rodando isolado), ajusta pro CWD
        if not os.path.exists(toon_path):
            boards_dir = os.path.join(os.getcwd(), "dendriforge", "core", "boards")
            toon_path = os.path.join(boards_dir, "arduino-uno-r3.toon")
        
        # Lê o TOON e extrai coordenadas
        if os.path.exists(toon_path):
            print(f"Carregando: {toon_path}")
            toon_data = load_toon_board(toon_path)
        else:
            print("Aviso: arduino-uno-r3.toon não encontrado. Usando mock.")
            toon_data = {
                "image": "arduino-uno-r3.svg",
                "pins": [{"id": "0", "label": "D0", "rel_x": 0.5, "rel_y": 0.5}]
            }
        
        # Cria a board e a torna dragável
        board = DraggableBoard(toon_data=toon_data, image_dir=boards_dir, size_hint=(None, None), size=(300, 400), pos=(200, 200))
        root.add_widget(board)
        
        return root

if __name__ == '__main__':
    DendriForgePrototypeApp().run()
