// Test - Phase 1 ONLY (no #define, no 2D arrays yet)
void setup() {
  Serial.begin(9600);
  
  // FASE 1.1 & 1.2: arr[i]++ / ++arr[i]
  int nums[3] = {1, 2, 3};
  nums[0]++;  // postfix
  ++nums[1];  // prefix
  
  Serial.print("nums[0]: "); Serial.println(nums[0]);
  Serial.print("nums[1]: "); Serial.println(nums[1]);
  
  // FASE 1.3: Partial init
  int partial[5] = {10, 20};
  Serial.print("partial[3]: "); Serial.println(partial[3]);
  
  Serial.println("Phase 1 basic OK!");
}

void loop() {}
