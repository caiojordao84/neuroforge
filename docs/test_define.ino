// Test #define (FASE 1.5)
#define SIZE 5

void setup() {
  Serial.begin(9600);
  int arr[SIZE] = {1, 2, 3, 4, 5};
  Serial.print("arr[0]: ");
  Serial.println(arr[0]);
  Serial.print("SIZE: ");
  Serial.println(SIZE);
  Serial.println("#define OK!");
}

void loop() {}
