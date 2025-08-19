import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcutOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  target?: HTMLElement | Document | Window;
}

interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/**
 * Custom hook for handling keyboard shortcuts
 * Supports common modifier combinations and cross-platform compatibility
 */
export const useKeyboardShortcut = (
  shortcut: string | ShortcutDefinition,
  callback: (event: KeyboardEvent) => void,
  options: KeyboardShortcutOptions = {}
) => {
  const {
    enabled = true,
    preventDefault = true,
    stopPropagation = true,
    target = document
  } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const parseShortcut = useCallback((shortcut: string | ShortcutDefinition): ShortcutDefinition => {
    if (typeof shortcut === 'object') {
      return shortcut;
    }

    // Parse string shortcuts like "cmd+k", "ctrl+shift+p", etc.
    const parts = shortcut.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    
    const parsed: ShortcutDefinition = { key };
    
    for (const part of parts.slice(0, -1)) {
      switch (part) {
        case 'cmd':
        case 'meta':
          parsed.meta = true;
          break;
        case 'ctrl':
        case 'control':
          parsed.ctrl = true;
          break;
        case 'alt':
        case 'option':
          parsed.alt = true;
          break;
        case 'shift':
          parsed.shift = true;
          break;
      }
    }

    return parsed;
  }, []);

  const matchesShortcut = useCallback((event: KeyboardEvent, definition: ShortcutDefinition): boolean => {
    // Normalize key comparison  
    const eventKey = event.key?.toLowerCase() || '';
    const definitionKey = definition.key?.toLowerCase() || '';
    
    // Handle special key mappings
    const keyMatches = eventKey === definitionKey ||
      (definitionKey === 'space' && eventKey === ' ') ||
      (definitionKey === 'esc' && eventKey === 'escape') ||
      (definitionKey === 'enter' && eventKey === 'enter') ||
      (definitionKey === 'tab' && eventKey === 'tab');

    if (!keyMatches) return false;

    // Check modifiers
    const ctrlMatch = !definition.ctrl || event.ctrlKey;
    const metaMatch = !definition.meta || event.metaKey;
    const altMatch = !definition.alt || event.altKey;
    const shiftMatch = !definition.shift || event.shiftKey;

    // Ensure only required modifiers are pressed
    const noExtraCtrl = definition.ctrl || !event.ctrlKey;
    const noExtraMeta = definition.meta || !event.metaKey;
    const noExtraAlt = definition.alt || !event.altKey;
    const noExtraShift = definition.shift || !event.shiftKey;

    return ctrlMatch && metaMatch && altMatch && shiftMatch &&
           noExtraCtrl && noExtraMeta && noExtraAlt && noExtraShift;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const definition = parseShortcut(shortcut);
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields (unless explicitly overridden)
      const target = event.target as HTMLElement;
      const isInputField = target?.tagName === 'INPUT' || 
                          target?.tagName === 'TEXTAREA' || 
                          target?.contentEditable === 'true';
      
      // Allow shortcut if it's a meta/ctrl key combination (command palette style)
      const isModifierShortcut = definition.meta || definition.ctrl;
      
      if (isInputField && !isModifierShortcut) {
        return;
      }

      if (matchesShortcut(event, definition)) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }
        
        callbackRef.current(event);
      }
    };

    const targetElement = target as EventTarget;
    targetElement.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      targetElement.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [shortcut, enabled, preventDefault, stopPropagation, target, parseShortcut, matchesShortcut]);
};

/**
 * Cross-platform command key helper
 * Returns 'cmd' on Mac, 'ctrl' on Windows/Linux
 */
export const getCommandKey = (): 'cmd' | 'ctrl' => {
  return navigator.platform.toLowerCase().includes('mac') ? 'cmd' : 'ctrl';
};

/**
 * Format shortcut for display
 * Converts internal format to user-friendly display
 */
export const formatShortcut = (shortcut: string | ShortcutDefinition): string => {
  const definition = typeof shortcut === 'string' ? 
    { key: shortcut } : shortcut;
  
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const parts: string[] = [];
  
  if (definition.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (definition.ctrl && !definition.meta) {
    parts.push(isMac ? '⌃' : 'Ctrl');
  }
  if (definition.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (definition.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  
  // Format key name
  let keyName = definition.key.toUpperCase();
  if (keyName === ' ') keyName = 'Space';
  if (keyName === 'ESCAPE') keyName = 'Esc';
  
  parts.push(keyName);
  
  return parts.join(isMac ? ' ' : '+');
};

// Note: useKeyboardShortcuts has been removed due to React Hook rules
// Use individual useKeyboardShortcut calls instead for multiple shortcuts

export default useKeyboardShortcut;