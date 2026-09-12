import { useState } from 'react';
import type { DeviceFaults } from '../core/virtualDevice';
import { Badge, Btn, Card, Toggle } from '../ui/primitives';

/*
 * 故障注入面板。
 *
 * 这些开关是阶段一虚拟设备内置的——真实硬件上很难复现（要拔线、要让它卡住、
 * 要造出垃圾串扰），虚拟环境里是免费的。用途是验证控制台在各种异常下的表现：
 * 掉线通知、状态回退、界面不崩。
 */

export interface FaultOption {
  key: keyof DeviceFaults;
  label: string;
  hint: string;
  value: DeviceFaults[keyof DeviceFaults];
  /** 这类故障要重新连接才生效 */
  needsReconnect?: boolean;
}

export const FAULT_OPTIONS: FaultOption[] = [
  {
    key: 'noReady',
    label: '不发 ready',
    hint: '连接时那一帧能力声明丢掉。控制台应当在 1.5 秒后自动重发 hello 把它要回来',
    value: true,
    needsReconnect: true
  },
  {
    key: 'delayMs',
    label: '延迟 3 秒应答',
    hint: '所有回包晚 3 秒才出来。ack 会迟到，但会话不该因此崩掉',
    value: 3000
  },
  {
    key: 'dropRate',
    label: '随机丢包 50%',
    hint: '出站帧一半丢掉（固定随机种子，每次结果一样）。丢多了会触发掉线判定',
    value: 0.5
  },
  {
    key: 'garbage',
    label: '发送垃圾 JSON',
    hint: '每帧前后夹带非 { 开头的行，模拟 ESP32 上电的 ROM 日志。控制台应当静默丢弃',
    value: true
  },
  {
    key: 'autoDisconnectMs',
    label: '1 秒后中途断连',
    hint: '连上 1 秒后自己断开。应当看到明确通知、状态回到未连接、输出归零',
    value: 1000,
    needsReconnect: true
  },
  {
    key: 'resetHoldMs',
    label: '复位窗口拉长到 2 秒',
    hint: '阶段一测试用的钩子：把"看门狗复位不可被抢占"的窗口拉长，方便肉眼观察',
    value: 2000
  }
];

export default function FaultPanel(props: {
  faults: DeviceFaults;
  onChange: (key: keyof DeviceFaults, value: DeviceFaults[keyof DeviceFaults]) => void;
  onClear: () => void;
  onReconnect: () => void;
}) {
  const [showReconnectHint, setShowReconnectHint] = useState(false);

  const activeCount = FAULT_OPTIONS.filter((o) => {
    const v = props.faults[o.key];
    return typeof v === 'boolean' ? v : Number(v) > 0;
  }).length;

  return (
    <Card
      title="故障注入"
      subtitle="把装置弄坏，看控制台扛不扛得住"
      right={
        <div className="flex items-center gap-2">
          {activeCount > 0 && <Badge tone="warn">已开 {activeCount} 项</Badge>}
          <Btn size="sm" onClick={props.onClear}>
            全部关闭
          </Btn>
        </div>
      }
    >
      <div className="grid gap-2.5">
        {FAULT_OPTIONS.map((o) => {
          const raw = props.faults[o.key];
          const on = typeof raw === 'boolean' ? raw : Number(raw) > 0;
          return (
            <div key={String(o.key)} className="rounded border border-ink-800 bg-ink-950 p-2.5">
              <Toggle
                checked={on}
                label={o.label}
                hint={o.hint}
                onChange={(v) => {
                  props.onChange(o.key, (typeof raw === 'boolean' ? v : v ? o.value : 0) as DeviceFaults[keyof DeviceFaults]);
                  if (o.needsReconnect) setShowReconnectHint(true);
                }}
              />
              {o.needsReconnect && <span className="ml-6 text-[10px] text-warn-400">下次连接时生效</span>}
            </div>
          );
        })}
      </div>

      {showReconnectHint && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded border border-warn-400/40 bg-warn-400/5 p-2 text-[11px] text-warn-400">
          <span>有故障项需要重新连接才生效</span>
          <Btn size="sm" tone="warn" onClick={props.onReconnect}>
            断开并重连
          </Btn>
        </div>
      )}
    </Card>
  );
}
