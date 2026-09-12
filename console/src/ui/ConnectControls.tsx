import { useState } from 'react';
import { connection } from '../core/connection';
import { useStore } from '../core/store';
import { SerialTransport } from '../transports/serial';
import { Btn, Badge } from './primitives';

/*
 * 连接控制。总览、设备、顶栏三处共用同一份实现——
 * 复制三份迟早会出现"某处能连某处不能连"的怪事。
 */

const serialProbe = new SerialTransport(); // 只用来问一句"这个环境支不支持 Web Serial"

export function ConnectControls(props: { size?: 'sm' | 'md' }) {
  const conn = useStore((s) => s.conn);
  const [busy, setBusy] = useState(false);

  const connected = conn.status !== 'disconnected' && conn.status !== 'lost';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!connected ? (
        <>
          <Btn
            tone="primary"
            size={props.size}
            disabled={busy}
            onClick={() => void run(() => connection.connectMock())}
          >
            连接虚拟装置
          </Btn>
          <Btn
            tone="ghost"
            size={props.size}
            disabled={busy || !serialProbe.available}
            title={serialProbe.unavailableReason}
            onClick={() => void run(() => connection.connectSerial())}
          >
            连接真实串口
          </Btn>
          {!serialProbe.available && <Badge tone="mute">串口不可用</Badge>}
        </>
      ) : (
        <>
          <Badge tone={conn.status === 'active' || conn.status === 'ready' ? 'ok' : 'warn'}>
            {conn.kind === 'mock' ? 'Mock' : 'Serial'} · {conn.status}
          </Badge>
          <Btn tone="ghost" size={props.size} disabled={busy} onClick={() => void run(() => connection.disconnect())}>
            断开
          </Btn>
        </>
      )}
    </div>
  );
}
