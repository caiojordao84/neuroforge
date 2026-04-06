/**
 * Utility functions
 */

/**
 * Class name helper - combines classnames conditionally
 * Usage: cn('base-class', condition && 'conditional-class', ...)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}