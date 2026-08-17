import { useEffect } from "react";

export function useScannerWebSocket(shopId: number | undefined, onScan: (barcode: string) => void) {
  useEffect(() => {
    if (!shopId) return;

    // Use wss:// if https://, else ws://
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    // Connect to Django Channels route
    const ws = new WebSocket(`${protocol}//${host}/ws/scanner/${shopId}/`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.barcode) {
          onScan(data.barcode);
        }
      } catch (e) {
        console.error("Error parsing scanner WebSocket message", e);
      }
    };

    ws.onerror = (error) => {
      console.error("Scanner WebSocket error", error);
    };

    return () => {
      ws.close();
    };
  }, [shopId, onScan]);
}
