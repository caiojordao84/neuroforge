# CHECKLIST COMPLETO — Suporte a Arrays CParser \+ ASL

### 38 items

## **🔴 FASE 1 — Críticas (bloqueiam código Arduino real)** — 7 items

- [x] **1.1** `arr[i]++` / `arr[i]--` (postfix em subscript)  
- [x] **1.2** `++arr[i]` / `--arr[i]` (prefix em subscript)  
- [x] **1.3** `int arr[10] = {1, 2}` (inicialização parcial → preencher com zeros)  
- [x] **1.4** `char str[] = "hello"` (string literal → char array)  
- [x] **1.5** `#define SIZE 10` + `int arr[SIZE]` (pré-processador de defines)  
- [x] **1.6a** `const int arr[] PROGMEM = {...}` (1D em flash — AVR/Arduino)  
- [x] **1.6b** `const byte arr[][4] PROGMEM = {...}` (2D em flash — acesso `pgm_read_byte(&arr[i][j])`)

---

## **🟠 FASE 2 — Importantes (aparecem com frequência)** — 8 items

- [x] **2.1** `arr[i][j] += val` (compound assignment 2D)  
- [x] **2.2** `arr[i][j]++` / `arr[i][j]--` (postfix 2D)  
- [x] **2.3** `void f(int m[][4])` (array 2D como parâmetro)  
- [x] **2.4** `sizeof(arr)` / `sizeof(arr[0])` (builtin para tamanho)  
- [x] **2.5** `int arr[5] = {}` ou `= {0}` (zero-init 1D explícita)  
- [x] **2.6** `++arr[i][j]` / `--arr[i][j]` (prefix 2D)  
- [x] **2.7** `f(arr)` (passagem de array como argumento — decay implícito no call site)  
- [x] **2.8** `const char* labels[] = {"a","b"}` (array de ponteiros para string literals)

---

## **🟡 FASE 3 — Desejáveis (melhoram compatibilidade)** — 15 items

- [x] **3.1** `const int arr[]` (marcar `const` nos attributes)  
- [x] **3.2** `void f(int arr[5])` (parâmetro com tamanho explícito)  
- [x] **3.3** `int *ptr = arr` (decaimento para ponteiro)  
- [x] **3.4** `&arr[i]` (endereço de elemento)  
- [ ] **3.5** `int arr[n]` (VLA runtime — distinguir de constante)  
- [x] **3.6** `volatile int arr[5]` (qualificador volatile)  
- [x] **3.7** `const volatile int arr[]` (qualificadores combinados)  
- [x] **3.8** `static int arr[5]` (escopo local, armazenamento estático)  
- [x] **3.9** `const char msg[] = "error"` (literal de texto em const char\[\])  
- [x] **3.10** `void f(const int arr[])` (parâmetro const)  
- [x] **3.11** `void f(volatile int arr[])` (parâmetro volatile)  
- [x] **3.12** `void f(const int m[][4])` (parâmetro 2D const)  
- [x] **3.13** `arr[arr[i]]` (subscript com índice vindo de outro array — lookup tables)  
- [x] **3.14** `int m[3][3] = {0}` (zero-init 2D explícita)  
- [x] **3.15** `for (auto x : arr)` (range-based for — C++11 Arduino)

---

## **⚪ FASE 4 — Avançadas (edge cases)** — 8 items

- [ ] **4.1** `int m[x][y][z]` (arrays 3D+)  
- [ ] **4.2** `int *ptrs[5]` (array de ponteiros)  
- [ ] **4.3** `int (*ptr)[4]` (ponteiro para array)  
- [ ] **4.4** `MyStruct arr[5]` (array de struct customizada)  
- [ ] **4.5** `*(arr + i)` (aritmética de ponteiros)  
- [ ] **4.6** `extern int arr[]` (declaração externa)  
- [ ] **4.7** `std::array<int, N>` / `std::vector<int>` (C++ moderno)  
- [ ] **4.8** `int arr[5] = {[0]=1, [4]=5}` (designated initializers C99)

---

## **Totais**

| Fase | Items | Descrição |
| :---- | :---- | :---- |
| 🔴 FASE 1 | 7 | Críticos — bloqueiam código Arduino real |
| 🟠 FASE 2 | 8 | Importantes — aparecem com frequência |
| 🟡 FASE 3 | 15 | Desejáveis — melhoram compatibilidade |
| ⚪ FASE 4 | 8 | Avançados — edge cases |
| **Total** | **38** |  |

---

## **Nota arquitectural — PROGMEM (1.6a \+ 1.6b)**

Requer tratamento em **4 camadas**:

| Camada | Acção |
| :---- | :---- |
| **CParser** | Reconhecer `PROGMEM` como qualificador posicional (antes ou após o nome), guardar `progmem: true` \+ `isStatic` nos attributes |
| **ASLTypes** | Campo `progmem?: boolean` em `ASLGlobalVar` |
| **codeToASL** | Mapear `pgm_read_byte(arr + i)` → `index` normal; `pgm_read_byte(&arr[i][j])` → `index2D` |
| **ASLExecutor** | Em simulação PROGMEM é transparente (flash \= RAM); emitir `log` de aviso se `progmem` numa variável local |

---

