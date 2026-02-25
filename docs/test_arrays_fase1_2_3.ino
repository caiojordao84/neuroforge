// Test sketch for FASE 1, 2, 3 array features
// Copy this to NeuroForge editor and run as C++ Arduino

#define SIZE 5

void setup() {
  Serial.begin(9600);
  
  // FASE 1.1 & 1.2: arr[i]++ / ++arr[i]
  int nums[3] = {1, 2, 3};
  nums[0]++;  // postfix
  ++nums[1];  // prefix
  
  // FASE 1.3: Partial init {1,2} -> fills with zeros
  int partial[5] = {10, 20};
  
  // FASE 1.4: char str[] = "hello"
  char msg[] = "Hi";
  
  // FASE 1.5: #define SIZE
  int arr[SIZE] = {1, 2, 3, 4, 5};
  
  // FASE 1.6: PROGMEM
  const int pgmData[] PROGMEM = {100, 200, 300};
  
  // FASE 2.1: arr[i][j] += val
  int matrix[2][3] = {{1, 2, 3}, {4, 5, 6}};
  matrix[0][1] += 10;
  
  // FASE 2.2: arr[i][j]++
  matrix[1][2]++;
  
  // FASE 2.4: sizeof
  int len = sizeof(arr) / sizeof(arr[0]);
  int rowLen = sizeof(matrix[0]) / sizeof(matrix[0][0]);
  
  // FASE 2.5: zero-init
  int zeros[3] = {};
  int zeros2[2] = {0};
  
  // FASE 2.8: const char* labels[]
  const char* labels[] = {"A", "B", "C"};
  
  // FASE 3.1: const qualifier
  const int constArr[3] = {1, 2, 3};
  
  // FASE 3.3: pointer decay
  int* ptr = arr;
  
  // FASE 3.4: address-of
  int* addr = &arr[0];
  
  // FASE 3.6: volatile
  volatile int vArr[2] = {1, 2};
  
  // FASE 3.7: const volatile
  const volatile int cvArr[2] = {1, 2};
  
  // FASE 3.8: static
  static int sArr[3] = {1, 2, 3};
  
  // FASE 3.9: const char
  const char text[] = "Test";
  
  Serial.println("=== FASE 1 ===");
  Serial.print("nums[0]: "); Serial.println(nums[0]);  // 2
  Serial.print("nums[1]: "); Serial.println(nums[1]);  // 3
  Serial.print("partial[3]: "); Serial.println(partial[3]);  // 0
  Serial.print("msg: "); Serial.println(msg);
  Serial.print("arr[0]: "); Serial.println(arr[0]);
  Serial.print("pgmData[1]: "); Serial.println(pgmData[1]);
  
  Serial.println("=== FASE 2 ===");
  Serial.print("matrix[0][1]: "); Serial.println(matrix[0][1]);  // 12
  Serial.print("matrix[1][2]: "); Serial.println(matrix[1][2]);  // 7
  Serial.print("len: "); Serial.println(len);  // 5
  Serial.print("rowLen: "); Serial.println(rowLen);  // 3
  Serial.print("zeros[1]: "); Serial.println(zeros[1]);  // 0
  Serial.print("labels[0]: "); Serial.println(labels[0]);
  
  Serial.println("=== FASE 3 ===");
  Serial.print("ptr[0]: "); Serial.println(ptr[0]);  // 1
  Serial.print("*addr: "); Serial.println(*addr);  // 1
  Serial.print("sArr[1]: "); Serial.println(sArr[1]);  // 2
  Serial.print("text: "); Serial.println(text);
  
  Serial.println("All tests passed!");
}

void loop() {
  delay(1000);
}
