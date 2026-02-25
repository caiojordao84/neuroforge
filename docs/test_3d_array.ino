// Test 3D array (FASE 4.1) - simplified
void setup() {
  Serial.begin(9600);
  int cube[2][2][2] = {{{1,2},{3,4}},{{5,6},{7,8}}};
  Serial.print("cube[0][0][0]: ");
  Serial.println(cube[0][0][0]);
  Serial.print("cube[1][1][1]: ");
  Serial.println(cube[1][1][1]);
  Serial.println("3D OK!");
}

void loop() {}
