// Test pointer to array (FASE 4.3)
void setup() {
  Serial.begin(9600);
  
  int arr[4] = {1, 2, 3, 4};
  int (*ptr)[4] = &arr;
  
  Serial.print("(*ptr)[0]: ");
  Serial.println((*ptr)[0]);
  Serial.print("(*ptr)[1]: ");
  Serial.println((*ptr)[1]);
  Serial.print("(*ptr)[3]: ");
  Serial.println((*ptr)[3]);
  
  Serial.println("Ptr to array OK!");
}

void loop() {}
