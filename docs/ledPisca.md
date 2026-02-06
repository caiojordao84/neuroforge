# Relatório Técnico: Correção do Pisca LED (Arduino & ESP32)

Este documento detalha as correções implementadas para resolver os problemas de sincronização de código e execução da simulação no NeuroForge, especificamente focado no funcionamento correto do blink (pisca LED) nos pinos configurados pelo usuário.

## 1. Arduino (AVR)

### Problemas Identificados
1.  **Dessincronização de Código**: O código editado na aba não estava sendo enviado para o MCU. O simulador rodava uma versão antiga (cacheada) ou o template padrão (pino 13), ignorando as alterações para pino 2.
2.  **Parser de GPIO Falho**: A expressão regular (Regex) utilizada para detectar mudanças de pino (`G:pin=...`) era "gananciosa" demais, capturando lixo da serial e falhando em detectar comandos válidos.
3.  **Logs Poluídos**: O Monitor Serial exibia as mensagens de controle interno (`G:...`, `M:...`), dificultando a visualização dos prints do usuário.

### Soluções Implementadas
*   **Sincronização Proativa (`TopToolbar.tsx`)**: Implementamos uma verificação direta no `FileStore` antes da compilação. Se o usuário clicar em "Compile & Run", o sistema busca o código da aba ativa "na força bruta", garantindo que a versão mais recente seja compilada, independentemente do estado do `useEffect` de sincronização em background.
*   **Auto-Atribuição Inteligente (`CodeEditorWithTabs.tsx`)**: Se existir apenas um MCU no canvas e nenhum arquivo estiver explicitamente atribuído a ele, o editor agora vincula automaticamente o código ativo a esse MCU.
*   **Correção do Parser (`SerialGPIOParser.ts`)**: Ajustamos a Regex para ser não-gananciosa (`.*?`), permitindo a detecção robusta de múltiplos frames de GPIO misturados com texto normal.
*   **Filtro de Logs (`QEMUSimulationEngine.ts`)**: O motor de simulação agora intercepta as linhas que casam com o padrão de GPIO e as remove do buffer serial antes de enviá-las para o frontend. O sinal elétrico é processado (pisca o LED no canvas), mas o texto de controle fica "invisível" para o usuário.

---

## 2. ESP32

### Problemas Identificados
1.  **Binário Estático**: O backend do ESP32 estava configurado para usar um arquivo `qemu_flash.bin` fixo e pré-compilado. Nenhuma modificação feita no editor tinha efeito real, pois o sistema sempre carregava esse mesmo arquivo antigo (que piscava o pino 13).
2.  **Falta de Instrumentação**: O core padrão do ESP32 não possui as chamadas `nf_report_gpio` que injetamos no core AVR. Sem isso, o QEMU rodava o código, mas o frontend não sabia que os pinos mudaram de estado.
3.  **Necessidade de eFuse**: O ESP32 exige, além do firmware, uma imagem de eFuse válida para bootar corretamente no QEMU.

### Soluções Implementadas
*   **Compilação Real (`CompilerService.ts`)**: Removemos a lógica de binário estático. Agora, o sistema invoca o `arduino-cli` de verdade para o ESP32, utilizando a flag `--export-binaries`. Isso gera um arquivo `.merged.bin` que contém bootloader, partições e aplicação em um único blob, pronto para o QEMU.
*   **Shim de GPIO (`esp32-shim.cpp`)**: Criamos uma estratégia de injeção de código (shim). Como as funções `digitalWrite` e `pinMode` no core do ESP32 são declaradas como "weak symbols" (símbolos fracos), pudemos sobrescrevê-las sem alterar os arquivos do sistema.
    *   Nosso shim intercepta a chamada original.
    *   Executa a função real (`__digitalWrite`).
    *   Envia o relatório via UART0 (`ets_printf("G:pin=%d,v=%d\n", ...)`).
*   **Injeção Automática**: Durante a compilação, o `CompilerService` copia silenciosamente o arquivo `esp32-shim.cpp` para dentro da pasta do sketch temporário, garantindo que ele seja compilado junto com o código do usuário.
*   **Suporte a eFuse (`QEMUApiClient.ts` / `useQEMUSimulation.ts`)**: Atualizamos toda a cadeia de comunicação (Frontend -> API -> Backend) para garantir que o caminho do arquivo `qemu_efuse.bin` seja passado corretamente para o comando de inicialização do QEMU.
*   **Filtro de Logs**: Aplicada a mesma lógica do Arduino para esconder os frames `G:` e `M:` gerados pelo shim do ESP32.

## Conclusão
O sistema agora suporta edição, compilação e simulação visual em tempo real para ambas as arquiteturas. O usuário pode alterar pinos, lógicas e tempos no editor, e o resultado será fielmente refletido nos componentes visuais (LEDs) do canvas, sem poluição no Monitor Serial.
