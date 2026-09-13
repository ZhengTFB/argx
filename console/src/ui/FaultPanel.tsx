import { Switch } from './primitives';
import type { DeviceFaults } from '../core/virtualDevice';

/*
 * 故障注入面板。
 *
 * 这些开关**直接操作虚拟装置实例**（device.setFaults），绕过了会话层 ——
 * 这是故意的：要在传输层以下做手脚，才伪造得出丢包、垃圾串扰、半路断连。
 *
 * 六个开关就是 device/virtual_device.js 那七个故障里能变成 UI 的那些。
 * `dropSeqs` 不在里面：它要求你填具体的 seq 号，那是测试脚本用的精确丢包，
 * 不是给人点的。要重现丢包用「随机丢包 50%」。
 *
 * 每个开关的说明都用**可预期的一句话**写清楚会发生什么 ——
 * 打开一个故障却不知道会发生什么，那就不叫调试了。
 */

export type FaultKey = keyof DeviceFaults;

interface FaultOption {
  key: FaultKey;
  label: string;
  hint: string;
  /** 打开时写进去的值 */
  on: boolean | number;
  /** 关闭时写进去的值 */
  off: boolean | number;
  /**
   * 这个故障只在连接那一刻起作用（握手时、或 connect 时排的定时器），
   * 所以要拨动之后自动重连一次才看得见效果。
   */
  restartOnChange?: boolean;
}

export const FAULT_OPTIONS: FaultOption[] = [
  {
    key: 'noReady',
    label: '不发 ready',
    hint: '连接时压掉那一次能力声明，模拟「这一帧在路上丢了」。上层不该傻等它 —— 发一帧 hello 就能要回来。',
    on: true, off: false,
    restartOnChange: true
  },
  {
    key: 'delayMs',
    label: '延迟 3 秒应答',
    hint: '装置发出的每一帧都晚 3 秒才到。心跳会先超时，10 秒之后判掉线。',
    on: 3000, off: 0,
    restartOnChange: true
  },
  {
    key: 'dropRate',
    label: '随机丢包 50%',
    hint: '用固定种子的随机数丢帧，所以同样的操作每次结果都一样，排查可复现。',
    on: 0.5, off: 0
  },
  {
    key: 'garbage',
    label: '发送垃圾 JSON',
    hint: '每发一帧之前在它前面插一行 ROM 启动日志。不以 { 开头的行按协议应当被「静默丢弃」，不能回 err。',
    on: true, off: false
  },
  {
    key: 'autoDisconnectMs',
    label: '1 秒后中途断连',
    hint: '连上 1 秒后对端自己断开，模拟拔线。界面应当弹出掉线通知，四路回到待机。',
    on: 1000, off: 0,
    restartOnChange: true
  },
  {
    key: 'resetHoldMs',
    label: '复位窗口拉长到 2 秒',
    hint: '复位在真机上是同步的、插不进一帧，所以用一个窗口把它做得可观测：窗口里发来的 cue 应当被丢弃。',
    on: 2000, off: 0
  }
];

export function FaultPanel({
  faults, onChange, disabled = false
}: {
  faults: DeviceFaults;
  onChange: (key: FaultKey, value: boolean | number, restart?: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      {FAULT_OPTIONS.map((o) => {
        const cur = faults[o.key];
        const on = typeof o.on === 'boolean' ? cur === true : (cur as number) > 0;
        return (
          <div className="fault-row" key={String(o.key)} data-fault={String(o.key)}>
            <div className="f-body">
              <div className="f-label">
                {o.label}
                {o.restartOnChange ? <span className="page-sub" style={{ marginLeft: 6 }}>（打开会重连一次）</span> : null}
              </div>
              <div className="f-hint">{o.hint}</div>
            </div>
            <div className="f-ctl">
              <Switch
                checked={on}
                disabled={disabled}
                label={o.label}
                onChange={(v) => onChange(o.key, v ? o.on : o.off, o.restartOnChange)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
