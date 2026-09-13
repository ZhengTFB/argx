import { useCallback, useRef, useState } from 'react';
import { CHANNELS } from './channels';
import { device } from './device';

/*
 * 连接测试：四路依次各跑一遍（亮→灭、响→停……），每路不到 1 秒，走完约 4 秒。
 *
 * 判断依据只有一条：**发完指令回查状态**。
 *   装置回了，说明这条链路通（绿勾）
 *   装置没回，说明没接上或那一路没接线（黄叹号）
 *
 * 为什么不能靠"我们自己记得发过什么"：那只是本地记账。
 * 装置拔了线、继电器没接负载，本地记账照样全绿 —— 自检就白做了。
 *
 * 回查走 device.queryNow()，不自己调 ARGX.state()：
 * SDK 的应答是按先来后到配对的，两处同时查会串到对方的应答上（见 core/device.ts）。
 */

export type CheckState = 'idle' | 'testing' | 'ok' | 'warn';

/*
 * 时间都卡在"看得见"和"不到 1 秒"之间：
 * 亮 900ms 再回查（太短人眼看不见，回查也容易撞上刚熄灭的那一刻），
 * 熄灭后再留 450ms 才进下一路 —— 四路走完约 3.7 秒，正好是"看一圈"的长度。
 */
const ON_MS = 900;
const WAIT_ON = 420;
const WAIT_OFF = 450;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function allIdle(): Record<string, CheckState> {
  const s: Record<string, CheckState> = {};
  for (const c of CHANNELS) s[c.id] = 'idle';
  return s;
}

export interface SelfCheck {
  state: Record<string, CheckState>;
  running: boolean;
  /** 跑完之后的一句话结论（跑之前是 null） */
  summary: string | null;
  run: () => Promise<void>;
  stop: () => void;
}

export function useSelfCheck(): SelfCheck {
  const [state, setState] = useState<Record<string, CheckState>>(allIdle);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const alive = useRef(0);

  const run = useCallback(async () => {
    if (running) return;
    const gen = ++alive.current;
    setRunning(true);
    setSummary(null);
    setState(allIdle());

    let okCount = 0;
    for (const cap of CHANNELS) {
      if (alive.current !== gen) return;
      setState((s) => ({ ...s, [cap.id]: 'testing' }));

      // 强度拉满、时长短一点：看得见，又不会拖到下一路
      device.cue(cap.id, { i: 1, dur: ON_MS, pri: 2 });
      await sleep(WAIT_ON);

      const out = await device.queryNow();
      const got = out?.[cap.id];
      // 门槛是能力自身的性质：继电器 i≥0.5 才算吸合，其余是连续量
      const passed = !!got && got.i >= cap.threshold;
      if (passed) okCount++;
      if (alive.current !== gen) return;

      setState((s) => ({ ...s, [cap.id]: passed ? 'ok' : 'warn' }));

      device.cue(cap.id, { i: 0, dur: 300 });
      await sleep(WAIT_OFF);
    }

    if (alive.current !== gen) return;
    setRunning(false);
    setSummary(
      okCount === CHANNELS.length
        ? '四路都对上了，装置没问题'
        : `${okCount} 路对上，${CHANNELS.length - okCount} 路没回应（多半是那一路没接线）`
    );
  }, [running]);

  const stop = useCallback(() => {
    alive.current++;
    setRunning(false);
    setSummary('已经停下了');
  }, []);

  return { state, running, summary, run, stop };
}
