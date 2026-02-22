// SKETCH: Ping-pong com millis(), aceleração até 150%, desaceleração até 50%,
// repetido 2 vezes, depois para.

const int NUM_LEDS = 4;
const int ledPins[NUM_LEDS] = {3, 5, 6, 9};

// Movimento
int indice = 0;
int direcao = 1;

// Tempo
unsigned long ultimoTempo = 0;
float intervaloInicial = 300.0;
float intervaloAtual = intervaloInicial;

// Controle de fases
enum Fase { ACELERANDO, DESACELERANDO, PARADO };
Fase fase = ACELERANDO;

int ciclosCompletos = 0; // conta quantas vezes fez (acelera→desacelera)

// Limites
float intervaloMin = intervaloInicial * 0.50; // 50%
float intervaloMax = intervaloInicial * 1.50; // 150%

void setup() {
  Serial.begin(9600);

  for (int i = 0; i < NUM_LEDS; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  Serial.println("Sistema iniciado.");
}

void loop() {
  if (fase == PARADO) {
    return; // terminou tudo
  }

  unsigned long agora = millis();

  if (agora - ultimoTempo >= intervaloAtual) {
    ultimoTempo = agora;

    // Apaga todos
    for (int i = 0; i < NUM_LEDS; i++) {
      digitalWrite(ledPins[i], LOW);
    }

    // Acende o LED atual
    digitalWrite(ledPins[indice], HIGH);

    // Avança
    indice += direcao;

    // Detecta bordas do ping-pong
    if (indice >= NUM_LEDS) {
      indice = NUM_LEDS - 2;
      direcao = -1;
    } else if (indice < 0) {
      indice = 1;
      direcao = +1;

      // Completou um ciclo (ida + volta)
      atualizarFase();
    }
  }
}

void atualizarFase() {
  if (fase == ACELERANDO) {
    intervaloAtual *= 0.90; // acelera 10%

    if (intervaloAtual <= intervaloInicial * 0.666) {
      // 0.666 ≈ 1/1.5 → atingiu 150% de velocidade
      intervaloAtual = intervaloInicial * 0.666;
      fase = DESACELERANDO;
      Serial.println("Mudou para fase: DESACELERANDO");
    }

  } else if (fase == DESACELERANDO) {
    intervaloAtual *= 1.10; // desacelera 10%

    if (intervaloAtual >= intervaloInicial * 1.50) {
      intervaloAtual = intervaloInicial * 1.50;
      ciclosCompletos++;

      Serial.print("Ciclo acelera→desacelera completo: ");
      Serial.println(ciclosCompletos);

      if (ciclosCompletos >= 2) {
        fase = PARADO;
        Serial.println("Processo concluído. Sistema parado.");
        return;
      }

      fase = ACELERANDO;
      Serial.println("Mudou para fase: ACELERANDO");
    }
  }

  Serial.print("Intervalo atual: ");
  Serial.println(intervaloAtual);
}
