// Test - Phase 1 only (simpler)
#define SIZE 3

void setup() {
  Serial.begin(9600);
  
  // FASE 1.1 & 1.2: arr[i]++ / ++arr[i]
  int nums[3] = {1, 2, 3};
  nums[0]++;  // postfix
  ++nums[1];  // prefix
  
  Serial.print("nums[0]: "); Serial.println(nums[0]);  // 2
  Serial.print("nums[1]: "); Serial.println(nums[1]);  // 3
  
  Serial.println("Phase 1 OK!");
}

void loop() {
  delay(1000);
}
