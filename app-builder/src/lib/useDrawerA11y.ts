import { useEffect, useRef, type RefObject } from 'react';

/** CSS selector for elements that can receive keyboard focus inside the drawer. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Collect tabbable elements under a root (exported for unit tests).
 *
 * @param root - Container to search.
 * @returns Focusable HTMLElements in document order.
 */
export function queryFocusable(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/** Result of interpreting a key event while the drawer is open. */
export type DrawerKeyAction =
  { type: 'close' } | { type: 'trap'; target: HTMLElement } | { type: 'none' };

/**
 * Map a keyboard event shape to a drawer action (Escape close, Tab cycle).
 * Pure helper so Escape / focus-trap behavior can be unit-tested without a DOM env.
 *
 * @param key - `KeyboardEvent.key` value.
 * @param shiftKey - Whether Shift was held (Shift+Tab).
 * @param focusables - Tabbable elements inside the drawer, in order.
 * @param activeElement - Currently focused element (or null).
 * @returns Action the effect should take.
 */
export function resolveDrawerKeyAction(
  key: string,
  shiftKey: boolean,
  focusables: readonly HTMLElement[],
  activeElement: Element | null
): DrawerKeyAction {
  if (key === 'Escape') {
    return { type: 'close' };
  }
  if (key !== 'Tab' || focusables.length === 0) {
    return { type: 'none' };
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (first === undefined || last === undefined) {
    return { type: 'none' };
  }
  if (!shiftKey && activeElement === last) {
    return { type: 'trap', target: first };
  }
  if (shiftKey && activeElement === first) {
    return { type: 'trap', target: last };
  }
  return { type: 'none' };
}

/**
 * Which node should receive focus when the drawer opens.
 *
 * @param closeButton - Preferred initial focus (close control).
 * @param drawer - Fallback container (must be focusable, e.g. tabIndex={-1}).
 * @returns Element to focus, or null if neither is available.
 */
export function resolveDrawerOpenFocus(
  closeButton: HTMLElement | null,
  drawer: HTMLElement | null
): HTMLElement | null {
  return closeButton ?? drawer;
}

export interface UseDrawerA11yOptions {
  /** Whether the mobile drawer is open. */
  open: boolean;
  /** The drawer panel element. */
  drawerRef: RefObject<HTMLElement | null>;
  /** Control that opened the drawer (focus returns here on close). */
  triggerRef: RefObject<HTMLElement | null>;
  /** Preferred focus target on open (typically the close button). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Content behind the drawer to mark aria-hidden + inert while open. */
  backgroundRefs?: readonly RefObject<HTMLElement | null>[];
  /** Close the drawer (Escape). */
  onClose: () => void;
}

/**
 * Mobile drawer a11y: move focus in on open, restore on close, Escape to close,
 * Tab/Shift+Tab trap, and inert/aria-hidden background.
 */
export function useDrawerA11y({
  open,
  drawerRef,
  triggerRef,
  initialFocusRef,
  backgroundRefs = [],
  onClose
}: UseDrawerA11yOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const backgroundRefsRef = useRef(backgroundRefs);
  backgroundRefsRef.current = backgroundRefs;

  useEffect(() => {
    if (!open) {
      return;
    }

    const drawer = drawerRef.current;
    if (drawer === null) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    type BackgroundRestore = {
      el: HTMLElement;
      ariaHidden: string | null;
      hadInert: boolean;
    };
    const restored: BackgroundRestore[] = [];
    for (const ref of backgroundRefsRef.current) {
      const el = ref.current;
      if (el === null) {
        continue;
      }
      restored.push({
        el,
        ariaHidden: el.getAttribute('aria-hidden'),
        hadInert: el.hasAttribute('inert')
      });
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
    }

    const drawerEl: HTMLElement = drawer;
    const focusTarget = resolveDrawerOpenFocus(initialFocusRef?.current ?? null, drawerEl);
    focusTarget?.focus();

    /**
     * Document-level key handler for Escape and focus trap.
     */
    function onKeyDown(event: KeyboardEvent): void {
      const focusables = queryFocusable(drawerEl);
      const action = resolveDrawerKeyAction(
        event.key,
        event.shiftKey,
        focusables,
        document.activeElement
      );
      if (action.type === 'close') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (action.type === 'trap') {
        event.preventDefault();
        action.target.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      for (const item of restored) {
        if (item.ariaHidden === null) {
          item.el.removeAttribute('aria-hidden');
        } else {
          item.el.setAttribute('aria-hidden', item.ariaHidden);
        }
        if (!item.hadInert) {
          item.el.removeAttribute('inert');
        }
      }
      const trigger = triggerRef.current;
      if (trigger !== null) {
        trigger.focus();
      } else if (previousFocus !== null && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [open, drawerRef, triggerRef, initialFocusRef]);
}
