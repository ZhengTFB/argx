import { useEffect, useState } from 'react';
import { connection } from '../core/connection';
import { useStore } from '../core/store';
import { DEFAULT_CUE, describeParams, toWireParams, type CueParams } from '../core/cue';
import { capLabel, DEFAULT_CAP_IDS } from '../core/capabilities';
import type { DeviceFaults, DeviceState } from '../core/virtualDevice';
import CueParamsForm from '../ui/CueParamsForm';
import { Badge, Btn, Card, Select } from '../ui/primitives';
import VirtualDeviceView from '../simulator/VirtualDeviceView';
import PresetButtons from '../simulator/PresetButtons';
import FaultPanel from '../simulator/FaultPanel';

/*
 * 模拟器：本阶段的重点。
 *
 * 让没有 ESP32 的人点进来就知道这套东西怎么运作——
 * 「触发 → 协议 → 装置 → 视觉效果」整条链肉眼可见。
 *
 * 界面上的每一个数字都来自阶段一的虚拟设备 getState()，不是这里另算的。
 */

const EMPTY_FAULTS: DeviceFaults = {
  noReady: false,
  delayMs: 0,
  dropRate: 0,
  dropSeqs: [],
  garbage: false,
  autoDisconnectMs: 0,
  resetHoldMs: 0
};

/** 只在真正变化时才重渲染：ttl 按 50ms 粒度比较，否则 60fps 白刷 */
function signature(s: DeviceState | null): string {
  if (!s) return '';
  const parts = Object.keys(s.out).map((k) => {
    const c = s.out[k];
    return `${k}:${c.i.toFixed(3)}:${c.active ? 1 : 0}:${Math.round(c.ttl / 50)}:${c.hold ? 1 : 0}`;
  });
  return `${s.state}|${s.resetting ? 1 : 0}|${parts.join(',')}`;
}

export default function SimulatorPanel() {
  const conn = useStore((s) => s.conn);
  const [params, setParams] = useState<CueParams>({ ...DEFAULT_CUE, ramp: 800 });
  const [target, setTarget] = useState('light.main');
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [faults, setFaults] = useState<DeviceFaults>(EMPTY_FAULTS);

  const connected = conn.status !== 'disconnected' && conn.status !== 'lost';

  // 进来就自动连上虚拟装置：模拟器不该要求用户先去做一次"连接"动作
  useEffect(() => {
    if (!connection.session.isConnected()) void connection.connectMock();
  }, []);

  // 每帧读虚拟装置的状态来驱动动画
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const dev = connection.mock?.device;
      if (dev) {
        const st = dev.getState();
        setDeviceState((prev) => (signature(prev) === signature(st) ? prev : st));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 故障开关存在装置里，重连后依然有效
  useEffect(() => {
    const dev = connection.mock?.device;
    if (dev) setFaults({ ...dev.faults });
  }, [connected]);

  const applyFault = (key: keyof DeviceFaults, value: DeviceFaults[keyof DeviceFaults]) => {
    const dev = connection.mock?.device;
    if (!dev) return;
    dev.setFaults({ [key]: value } as Partial<DeviceFaults>);
    setFaults({ ...dev.faults }); // 开关存在装置里，这里只是把界面同步过去
  };

  const reconnect = async () => {
    await connection.disconnect();
    await connection.connectMock();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* 左：虚拟装置 + 手动触发 */}
      <div className="grid content-start gap-4">
        <Card
          title="虚拟装置"
          subtitle="屏幕上这些数字全部来自阶段一那份虚拟设备，不是这里另算的一套"
          right={
            <div className="flex items-center gap-2">
              <Badge tone={connected ? 'ok' : 'bad'}>{connected ? conn.status : '未连接'}</Badge>
              {deviceState?.resetting && <Badge tone="warn">复位中</Badge>}
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-600">
            <span>
              装置 <span className="text-ink-200">{deviceState?.dev ?? conn.dev ?? '—'}</span>
            </span>
            <span>
              会话 <span className="text-ink-200">{deviceState?.state ?? conn.status}</span>
            </span>
            <span>
              运行 <span className="text-ink-200">{((deviceState?.uptime ?? 0) / 1000).toFixed(1)}s</span>
            </span>
            {!connected && (
              <Btn size="sm" tone="primary" onClick={() => void connection.connectMock()}>
                连接虚拟装置
              </Btn>
            )}
          </div>

          <VirtualDeviceView state={deviceState} />

          <p className="mt-3 text-[11px] leading-relaxed text-ink-600">
            看一个例子：把灯设成「强度 1、渐变 800ms」。你会看到它从当前亮度平滑爬上去，
            到点自动熄灭——那个"自动"不是界面干的，是装置端的 TTL 到点了。
            真机上发生的是同一件事。
          </p>
        </Card>

        <Card title="手动触发" subtitle="选能力、调参数、发出去">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="w-56">
              <div className="mb-1 text-xs text-ink-400">目标能力</div>
              <Select
                value={target}
                onChange={setTarget}
                options={(conn.caps?.out ?? DEFAULT_CAP_IDS).map((id) => ({
                  value: id,
                  label: `${capLabel(id)} · ${id}`
                }))}
                className="w-full"
              />
            </div>
            <Btn
              tone="primary"
              disabled={!connected}
              onClick={() => connection.session.cue(target, toWireParams(params))}
            >
              发送 cue
            </Btn>
            <Btn disabled={!connected} onClick={() => connection.session.reset()}>
              全部熄灭
            </Btn>
          </div>

          <CueParamsForm value={params} onChange={setParams} />
          <p className="mt-2 text-[11px] text-ink-600">{describeParams(params)}</p>
        </Card>
      </div>

      {/* 右：预设 + 故障注入 */}
      <div className="grid content-start gap-4">
        <PresetButtons session={connection.session} disabled={!connected} />

        <FaultPanel
          faults={faults}
          onChange={applyFault}
          onClear={() => {
            const dev = connection.mock?.device;
            dev?.clearFaults();
            if (dev) setFaults({ ...dev.faults });
          }}
          onReconnect={() => void reconnect()}
        />

        <Card title="怎么用它验证控制台" subtitle="把故障打开，看这里会不会崩">
          <ol className="ml-4 list-decimal space-y-1.5 text-sm leading-relaxed text-ink-400">
            <li>打开「中途断连」，等 1 秒——顶部应当弹出掉线通知，状态回到未连接</li>
            <li>打开「延迟 3 秒应答」，发一条 cue，观察回执迟到但会话不断</li>
            <li>打开「随机丢包」，反复发码，看时间线里丢了多少条</li>
            <li>打开「垃圾 JSON」，确认时间线把噪音记成"丢弃非协议行"而不是当成帧</li>
            <li>打开「不发 ready」，断开重连——控制台应当在 1.5 秒后自己重发 hello 把能力要回来</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
