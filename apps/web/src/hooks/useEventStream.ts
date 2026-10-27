import { useEffect, useRef } from 'react';
import type { RealtimeEvent } from '@maxitexs/shared';

export function useEventStream(
  url: string | null,
  onEvent: (event: RealtimeEvent) => void,
): void {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url, { withCredentials: true });

    const types: RealtimeEvent['type'][] = [
      'participante.creado',
      'sorteo.lanzado',
      'sorteo.revelado',
      'sorteo.entregado',
      'sorteo.ausente',
      'totem.estado',
      'totem.contador',
      'jornada.reiniciada',
    ];

    for (const t of types) {
      es.addEventListener(t, (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as RealtimeEvent;
          cb.current(data);
        } catch {
          /* ignore */
        }
      });
    }

    es.onerror = () => {
      // Browser auto-reconnects; no-op
    };

    return () => es.close();
  }, [url]);
}
