import type { Session } from '../core/session';
import { Btn, Card } from '../ui/primitives';

/*
 * 剧情预设：把"创作者会怎么用"直接做成一排按钮。
 *
 * 这些不是玩具——每一颗都在演示一条协议能力是怎么组合出叙事效果的：
 * 解谜成功要同时亮灯+响一声（batch），最终解谜要让灯一直亮着（hold），
 * 惊吓点要用 critical 把之前所有效果清掉再说。
 */

export interface Preset {
  id: string;
  label: string;
  desc: string;
  run: (s: Session) => void;
}

export const PRESETS: Preset[] = [
  {
    id: 'puzzle-solved',
    label: '解谜成功',
    desc: '灯亮 + 响一声，必须是同一瞬间发生 → 用 batch 一帧发出',
    run: (s) =>
      s.batch([
        { id: 'light.main', p: { i: 1, ramp: 300, dur: 4000, pri: 1 } },
        { id: 'sound.beeper', p: { i: 1, dur: 400, pri: 1 } }
      ])
  },
  {
    id: 'new-scene',
    label: '进入新场景',
    desc: '氛围灯慢慢升起并一直留着 → ambient + hold，可被任何东西打断',
    run: (s) => s.cue('light.main', { i: 0.25, ramp: 2000, pri: 3, hold: true })
  },
  {
    id: 'jump-scare',
    label: '惊吓点',
    desc: 'critical 先把所有旧效果清掉，再闪一下灯 + 震一下 → 永远是当前唯一在演的东西',
    run: (s) =>
      s.batch([
        { id: 'light.main', p: { i: 1, dur: 150, pri: 0 } },
        { id: 'motion.vibrate', p: { i: 1, dur: 300, pri: 0 } }
      ])
  },
  {
    id: 'final',
    label: '最终解谜',
    desc: '灯常亮，不再自动熄灭 → hold 绕开 30 秒 TTL（但仍受看门狗保护）',
    run: (s) => s.cue('light.main', { i: 1, ramp: 1500, pri: 1, hold: true })
  },
  {
    id: 'whisper',
    label: '一声低语',
    desc: '只响很短的 80ms，不亮灯 → 最短的一个反馈',
    run: (s) => s.cue('sound.beeper', { i: 1, dur: 80, pri: 2 })
  },
  {
    id: 'door-unlock',
    label: '门开了',
    desc: '继电器吸合并保持 → env.relay 是开关量，i ≥ 0.5 就吸合',
    run: (s) => s.cue('env.relay', { i: 1, pri: 1, hold: true })
  },
  {
    id: 'reset-scene',
    label: '重置场景',
    desc: '强制回 idle，清空所有输出 → 换一局时用',
    run: (s) => s.reset()
  }
];

export default function PresetButtons(props: { session: Session; disabled: boolean }) {
  return (
    <Card title="模拟剧情触发" subtitle="点一下就是从「故事」到「装置」的完整一跳">
      <div className="grid gap-2">
        {PRESETS.map((p) => (
          <div key={p.id} className="flex items-start gap-2">
            <Btn
              size="sm"
              tone={p.id === 'reset-scene' ? 'danger' : 'ghost'}
              disabled={props.disabled}
              onClick={() => p.run(props.session)}
            >
              {p.label}
            </Btn>
            <span className="pt-0.5 text-[11px] leading-relaxed text-ink-600">{p.desc}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
