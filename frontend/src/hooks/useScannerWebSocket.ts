import { useEffect, useState, useRef } from "react";

export function useScannerWebSocket(shopId: number | null | undefined, onScan: (barcode: string) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!shopId) return;

    // Use wss:// if https://, else ws://
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    // Connect to Django Channels route
    const ws = new WebSocket(`${protocol}//${host}/ws/scanner/${shopId}/`);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.barcode) {
          onScanRef.current(data.barcode);
        }
      } catch (e) {
        console.error("Error parsing scanner WebSocket message", e);
      }
    };

    ws.onerror = (error) => {
      console.error("Scanner WebSocket error", error);
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [shopId]); // Only re-run if shopId changes

  return { isConnected };
}
