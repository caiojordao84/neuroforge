# IEC 61131-3 Structured Text

> Code generation skill for IEC 61131-3 Structured Text (PLC programming)

## Purpose

Generate IEC 61131-3 compliant Structured Text code for industrial PLC controllers.

## Target Platforms

- **Platform**: `iec-st`
- **Controllers**: Beckhoff TwinCAT, Siemens S7, CODESYS, Allen-Bradley, Mitsubishi

## Code Generation Rules

### Basic Structure

```st
PROGRAM MainProgram
VAR
    led : BOOL;
    counter : INT;
END_VAR

// Main logic
led := TRUE;
counter := counter + 1;
END_PROGRAM
```

### Functions and Function Blocks

```st
FUNCTION_BLOCK MotorControl
VAR INPUT
    Start : BOOL;
    Stop : BOOL;
END_VAR
VAR OUTPUT
    Running : BOOL;
END_VAR
VAR
    internal : BOOL;
END_VAR

IF Start AND NOT Stop THEN
    Running := TRUE;
ELSIF Stop THEN
    Running := FALSE;
END_IF
END_FUNCTION_BLOCK
```

### Timers (TON, TOF, TP)

```st
VAR
    timer : TON;
END_VAR

timer(IN := startSignal, PT := T#5S);
IF timer.Q THEN
    // Action after 5 seconds
END_IF;
```

### State Machines

```st
CASE state OF
    0: // Idle
        IF startSignal THEN
            state := 1;
        END_IF
    1: // Running
        IF doneSignal THEN
            state := 2;
        END_IF
    2: // Complete
        state := 0;
END_CASE;
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard IEC 61131-3 syntax | +0.0 |
| Platform-specific extensions | -0.05 |
| Proper VAR declarations | +0.1 |
| Using standard libraries | +0.05 |

## Example Output

```st
PROGRAM LEDBlink
VAR
    led : BOOL;
    counter : INT;
    timer : TON;
END_VAR

timer(IN := TRUE, PT := T#1S);

IF timer.Q THEN
    led := NOT led;
    timer(IN := FALSE);
    timer(IN := TRUE);
END_IF;
END_PROGRAM
```

## Constraints

- Platform-specific extensions vary
- Cyclic vs event-driven execution
- Limited floating point on some PLCs
- Scan time considerations