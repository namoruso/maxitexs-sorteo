import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import type { TotemEstadoResponse, RealtimeEvent } from '@maxitexs/shared';
import { api } from '../../api/client';
import { useEventStream } from '../../hooks/useEventStream';
import { useScaleToFit } from '../../hooks/useScaleToFit';

const ROW = 180;

export default function TotemPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  useScaleToFit(stageRef);

  const [data, setData] = useState<TotemEstadoResponse | null>(null);
  const [online, setOnline] = useState(true);
  const lastSorteoId = useRef<number | null>(null);
  const reelRef = useRef<HTMLDivElement>(null);
  const qrDrawn = useRef<string | null>(null);

  const apply = useCallback((d: TotemEstadoResponse) => {
    setData(d);
    setOnline(true);
  }, []);

  const load = useCallback(async () => {
    const r = await api<TotemEstadoResponse>('/api/totem/estado');
    if (r.ok) apply(r.data);
    else if (r.offline || r.status >= 500) setOnline(false);
  }, [apply]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEventStream('/api/totem/stream', (ev: RealtimeEvent) => {
    if (ev.type === 'totem.contador') {
      setData((prev) => (prev ? { ...prev, total: ev.total } : prev));
    } else if (ev.type === 'totem.estado' || ev.type === 'sorteo.lanzado' || ev.type === 'sorteo.revelado' || ev.type === 'jornada.reiniciada') {
      void load();
    } else if (ev.type === 'participante.creado') {
      setData((prev) => (prev ? { ...prev, total: ev.total } : prev));
    }
  });

  // QR — prefer same-origin registro URL so a bad PUBLIC_URL never points to localhost
  useEffect(() => {
    const fromApi = data?.url_registro;
    const origin = window.location.origin;
    let url = `${origin}/registro`;
    if (fromApi && !/localhost|127\.0\.0\.1/.test(fromApi)) {
      try {
        const u = new URL(fromApi);
        // Same host as the totem page, or any non-local absolute URL from the API
        if (u.origin === origin || u.protocol === 'https:') url = fromApi;
      } catch {
        /* keep origin fallback */
      }
    }
    if (url === qrDrawn.current) return;
    const el = document.getElementById('qr');
    if (!el) return;
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#15264e', light: '#00000000' } })
      .then((svg) => {
        el.innerHTML = svg;
        const s = el.querySelector('svg');
        if (s) {
          s.setAttribute('width', '560');
          s.setAttribute('height', '560');
          s.setAttribute('viewBox', s.getAttribute('viewBox') || '0 0 1 1');
          s.style.width = '100%';
          s.style.height = '100%';
        }
        qrDrawn.current = url;
      })
      .catch(() => undefined);
  }, [data?.url_registro]);

  // Slot animation when entering sorteo
  useEffect(() => {
    if (!data || data.estado !== 'sorteo') return;
    if (lastSorteoId.current === data.sorteo_id) return;
    lastSorteoId.current = data.sorteo_id;
    runSlot(reelRef.current, data.nombres, data.ganador?.nombre_mask ?? '');
  }, [data]);

  const estado = data?.estado ?? 'captacion';
  const premio = data?.premio ?? 'Premio';
  const total = data?.total ?? 0;
  const g = data?.ganador;

  return (
    <div className="ch totem-page">
      <div className="totem-stage" id="stage" ref={stageRef}>
        {/* Captación */}
        <div className={`ch ch-screen ch-totem totem-state ${estado !== 'captacion' ? 'ch-totem--hidden' : ''}`}>
          <div className="ch-totem-top">
            <span className="ch-logo">
              <img src="/assets/logo.png" alt="Corporación Maxitex’s" style={{ height: 200, width: 'auto' }} />
            </span>
            <Status online={online} />
          </div>
          <div className="ch-totem-main" style={{ paddingTop: 48 }}>
            <h1>
              Escanea, regístrate y participa por <em>{premio}</em>
            </h1>
            <div className="ch-totem-qr">
              <div id="qr" style={{ width: 560, height: 560 }} role="img" aria-label="Código QR para registrarte" />
            </div>
            <div className="ch-totem-count">
              <div>
                <span className="bang">¡</span>
                <span className="big">
                  <span className="ch-counter-num" aria-live="polite">{total}</span>
                </span>
              </div>
              <p>profesionales ya están participando!</p>
            </div>
          </div>
          <p className="ch-totem-foot">Toma menos de 1 minuto · Un registro por cédula</p>
        </div>

        {/* Sorteo */}
        <div className={`ch ch-screen ch-totem ch-totem--draw totem-state ${estado !== 'sorteo' ? 'ch-totem--hidden' : ''}`}>
          <div className="ch-totem-top">
            <span className="ch-logo-plate">
              <img src="/assets/isotipo.png" alt="Corporación Maxitex’s" style={{ height: 96, width: 'auto' }} />
            </span>
            <Status online={online} />
          </div>
          <div className="ch-totem-main" style={{ justifyContent: 'center' }}>
            <h1>¡Es hora del sorteo!</h1>
            <p className="ch-totem-sub">
              Entre {total} profesionales registrados, uno se lleva {premio}.
            </p>
            <div style={{ marginTop: 96 }}>
              <div className="ch-slot" style={{ width: 920, height: 540 }} aria-live="polite" aria-label="Sorteo en curso">
                <div className="ch-slot-reel" ref={reelRef} />
                <div className="ch-slot-dim" style={{ top: 0, height: 180 }} />
                <div className="ch-slot-dim" style={{ bottom: 0, height: 180 }} />
                <div className="ch-slot-frame" style={{ top: 176, height: 188 }} />
              </div>
            </div>
          </div>
          <p className="ch-totem-foot">Sorteo al azar · Un ticket por cédula</p>
        </div>

        {/* Ganador */}
        <div className={`ch ch-screen ch-totem ch-totem--win totem-state ${estado !== 'ganador' ? 'ch-totem--hidden' : ''}`}>
          <Confetti />
          <div className="ch-totem-top">
            <span className="ch-logo-plate">
              <img src="/assets/isotipo.png" alt="Corporación Maxitex’s" style={{ height: 96, width: 'auto' }} />
            </span>
            <Status online={online} />
          </div>
          <div className="ch-totem-main" style={{ justifyContent: 'center', position: 'relative' }}>
            <h1>¡Tenemos ganador!</h1>
            <div className="ch-totem-winner">
              <span className="lbl">Ticket #{g?.ticket ?? '0000'}</span>
              <p className="nm">{g?.nombre_mask ?? '—'}</p>
              <p className="lab">{g?.laboratorio ?? '—'}</p>
              <p className="ct">{g?.cedula_mask ?? '—'}</p>
            </div>
            <p className="ch-totem-claim">¡Acércate al stand de Maxitex’s con tu cédula para reclamar tu premio!</p>
          </div>
          <p className="ch-totem-foot" style={{ color: 'var(--on-primary)', position: 'relative' }}>
            {premio}
          </p>
        </div>
      </div>
    </div>
  );
}

function Status({ online }: { online: boolean }) {
  return (
    <span className={`ch-status ch-status--totem ${online ? 'ch-status--on' : 'ch-status--off'}`} role="status">
      <i aria-hidden="true" />
      <span>{online ? 'En línea' : 'Sin conexión'}</span>
    </span>
  );
}

function runSlot(reel: HTMLDivElement | null, names: string[], winner: string) {
  if (!reel) return;
  const pool =
    names.length >= 3
      ? names
      : ['Ana M.', 'Carlos R.', 'Lucía G.', 'Pedro S.', 'María F.', 'José L.', 'Sofía T.', 'Diego V.'];
  let list: string[] = [];
  for (let i = 0; i < 4; i++) list = list.concat(pool);
  list.push(pool[0]!, winner || pool[1]!, pool[1]!);
  reel.innerHTML = list
    .map((n) => `<div class="ch-slot-row" style="height:${ROW}px;font-size:88px">${esc(n)}</div>`)
    .join('');
  const final = -(list.length - 3) * ROW;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  reel.style.transition = 'none';
  reel.style.transform = 'translateY(0)';
  if (reduce) {
    reel.style.transform = `translateY(${final}px)`;
    return;
  }
  void reel.offsetWidth;
  requestAnimationFrame(() => {
    reel.style.transition = 'transform 5200ms cubic-bezier(.08,.6,.12,1)';
    reel.style.transform = `translateY(${final}px)`;
  });
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function Confetti() {
  const reduce = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return null;
  const tones = ['var(--accent)', 'var(--on-primary)', 'var(--secondary)', 'var(--accent)'];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const pieces = Array.from({ length: 36 }, (_, i) => {
    const w = 10 + rnd() * 14;
    const round = rnd() > 0.6;
    return (
      <span
        key={i}
        style={
          {
            left: `${(rnd() * 100).toFixed(1)}%`,
            width: w,
            height: round ? w : w * 0.45,
            background: tones[i % 4],
            borderRadius: round ? '50%' : 2,
            animationDuration: `${(6 + rnd() * 6).toFixed(1)}s`,
            animationDelay: `-${(rnd() * 10).toFixed(1)}s`,
            '--fall': '2000px',
            '--spin': `${Math.round(180 + rnd() * 540)}deg`,
          } as CSSProperties
        }
      />
    );
  });
  return (
    <div className="ch-confetti" aria-hidden="true">
      {pieces}
    </div>
  );
}
