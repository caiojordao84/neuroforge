#pragma once
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Report GPIO change to QEMU via Serial Protocol
 */
void nf_report_gpio(uint8_t pin, uint8_t value);

/**
 * Report Pin Mode change to QEMU
 */
void nf_report_mode(uint8_t pin, uint8_t mode);

#ifdef __cplusplus
}
#endif
