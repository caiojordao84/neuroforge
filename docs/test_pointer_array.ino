// Test array of pointers (FASE 4.2) - full test
void setup() {
  Serial.begin(9600);
  
  int a = 10;
  int b = 20;
  
  int *ptrs[2] = {&a, &b};
  
  // Print addresses
  Serial.print("ptrs[0] addr: ");
  Serial.println((int)ptrs[0]);
  Serial.print("ptrs[1] addr: ");
  Serial.println((int)ptrs[1]);
  
  // Print values via dereference
  Serial.print("*ptrs[0]: ");
  Serial.println(*ptrs[0]);
  Serial.print("*ptrs[1]: ");
  Serial.println(*ptrs[1]);
  
  // Modify via pointer
  *ptrs[0] = 100;
  Serial.print("a after *ptrs[0]=100: ");
  Serial.println(a);
  
  Serial.println("Pointer array OK!");
}

void loop() {}
