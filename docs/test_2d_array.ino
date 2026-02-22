// Test 2D array (FASE 2)
void setup() {
  Serial.begin(9600);
  int matrix[2][3] = {{1, 2, 3}, {4, 5, 6}};
  Serial.print("matrix[0][1]: ");
  Serial.println(matrix[0][1]);
  Serial.println("2D OK!");
}

void loop() {}
