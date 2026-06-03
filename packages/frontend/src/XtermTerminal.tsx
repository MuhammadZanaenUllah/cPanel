import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface Props {
  token: string;
}

export default function XtermTerminal({ token }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef      = useRef<Terminal | null>(null);
  const wsRef        = useRef<WebSocket | null>(null);
  const fitRef       = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      theme: {
        background:   '#0d1117',
        foreground:   '#e6edf3',
        cursor:       '#58a6ff',
        cursorAccent: '#0d1117',
        black:        '#484f58',
        red:          '#ff7b72',
        green:        '#3fb950',
        yellow:       '#d29922',
        blue:         '#58a6ff',
        magenta:      '#bc8cff',
        cyan:         '#39d353',
        white:        '#b1bac4',
        brightBlack:  '#6e7681',
        brightRed:    '#ffa198',
        brightGreen:  '#56d364',
        brightYellow: '#e3b341',
        brightBlue:   '#79c0ff',
        brightMagenta:'#d2a8ff',
        brightCyan:   '#56d364',
        brightWhite:  '#f0f6fc',
      },
      fontFamily: '"Cascadia Code","Fira Code","JetBrains Mono",Menlo,Monaco,monospace',
      fontSize:    14,
      lineHeight:  1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback:  5000,
    });

    const fitAddon   = new FitAddon();
    const linksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(linksAddon);
    term.open(containerRef.current!);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current  = fitAddon;

    // Build WS URL using the current page's origin so the request goes through
    // whatever proxy is in front (Vite on :5173 or nginx on :2083).
    // This way Vite's `ws: true` proxy and nginx's upgrade map both handle it correctly.
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/cpanel/terminal/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      fitAddon.fit();
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };
    ws.onmessage = (e) => term.write(typeof e.data === 'string' ? e.data : new Uint8Array(e.data as ArrayBuffer));
    ws.onerror   = () => setError('WebSocket error — check API is running');
    ws.onclose   = () => setConnected(false);

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
    });

    const ro = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      } catch { /* ignore */ }
    });
    ro.observe(containerRef.current!);
    term.focus();

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
      termRef.current = null;
      wsRef.current   = null;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117' }}>
      {/* Toolbar */}
      <div style={{ background: '#161b22', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #30363d', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
          <span style={{ color: '#8b949e', fontSize: 12, marginLeft: 8, fontFamily: 'monospace' }}>Terminal — cPanel</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: connected ? '#3fb950' : '#f85149' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#3fb950' : '#f85149', display: 'inline-block' }} />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            onClick={() => { wsRef.current?.close(); termRef.current?.dispose(); termRef.current = null; wsRef.current = null; window.location.reload(); }}
            style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: 11, cursor: 'pointer' }}
          >Reconnect</button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#3d1f1f', color: '#ff7b72', padding: '8px 16px', fontSize: 12, borderBottom: '1px solid #6f2020' }}>
          ⚠ {error}
        </div>
      )}

      <div
        ref={containerRef}
        style={{ flex: 1, padding: '8px 4px 4px 8px', overflow: 'hidden', cursor: 'text' }}
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
}
