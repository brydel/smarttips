/**
 * Reference-counted scroll lock — prevents the classic "second dialog unmounts
 * and re-enables scroll while a first dialog is still open" race condition (ROB-H2).
 *
 * Usage:
 *   lockScroll()   — increment lock count; hides body scrollbar when count goes 1→+
 *   unlockScroll() — decrement lock count; restores body scrollbar when count goes 1→0
 */

let lockCount = 0;

export function lockScroll(): void {
  if (++lockCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

export function unlockScroll(): void {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.body.style.overflow = '';
  }
}
