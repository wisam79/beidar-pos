import { useEffect, useRef } from "react";

const SCAN_TIMEOUT_MS = 50; // Max time difference between keystrokes to distinguish scanner HID from manual typing

export function usePassiveScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    function handleKeydown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Do not intercept if user is typing in a free-text input/textarea or marked input
      const isFreeTextField =
        target.tagName === "TEXTAREA" ||
        (target.tagName === "INPUT" && target.dataset.scannerIgnore === "true");
      if (isFreeTextField) return;

      const now = Date.now();
      if (now - lastKeyTime.current > SCAN_TIMEOUT_MS) {
        buffer.current = ""; // Reset buffer on long pause (manual typing)
      }
      lastKeyTime.current = now;

      if (e.key === "Enter") {
        if (buffer.current.length >= 4) {
          onScan(buffer.current);
        }
        buffer.current = "";
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [enabled, onScan]);
}
