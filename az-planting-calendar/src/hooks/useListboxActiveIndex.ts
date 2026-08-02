import {
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from 'react';

/**
 * Shared listbox active-index state and pure helpers for ArrowUp/ArrowDown.
 * Used by LiveSearch and ZoneSelector so the keyboard step logic is not copied.
 */

/**
 * Next active index after ArrowDown (wraps at ends).
 *
 * @param current - Current highlight index (-1 when none).
 * @param length - Number of options.
 * @returns New index.
 */
export function nextDownIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return 0;
  return Math.min(current + 1, length - 1);
}

/**
 * Next active index after ArrowUp (wraps from 0/none to last).
 *
 * @param current - Current highlight index.
 * @param length - Number of options.
 * @returns New index.
 */
export function nextUpIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  if (current <= 0) return length - 1;
  return current - 1;
}

/**
 * React state hook for combobox active option index.
 *
 * @returns Tuple of activeIndex and setActiveIndex.
 */
export function useListboxActiveIndex(): [number, Dispatch<SetStateAction<number>>] {
  return useState(-1);
}

/**
 * Close a combobox listbox: collapse, clear highlight, refocus the input.
 *
 * @param setOpen - Setter for expanded/open state.
 * @param setActiveIndex - Setter for highlight index.
 * @param inputRef - Input element ref.
 */
export function closeListbox(
  setOpen: Dispatch<SetStateAction<boolean>>,
  setActiveIndex: Dispatch<SetStateAction<number>>,
  inputRef: RefObject<HTMLInputElement | null>
): void {
  setOpen(false);
  setActiveIndex(-1);
  inputRef.current?.focus();
}

/**
 * Expand the list and clear the highlight (e.g. after the user types).
 *
 * @param setOpen - Setter for expanded/open state.
 * @param setActiveIndex - Setter for highlight index.
 */
export function openListAndClearHighlight(
  setOpen: Dispatch<SetStateAction<boolean>>,
  setActiveIndex: Dispatch<SetStateAction<number>>
): void {
  setOpen(true);
  setActiveIndex(-1);
}
