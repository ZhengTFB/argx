import { useCallback, useState } from 'react';
import { ARGX } from '../../core/sdk';
import { BASIC_CAPS } from './caps';

/*
 * 自检：四路依次各跑一遍（亮→灭、响→停……），每路不到 1 秒，走完约 4 秒。
 *
 * 判断依据只有一条：**发完指令回查状态**。
 *   设备回了，说明这条链路通（绿勾）
 *   设备没回，说明没接上或那一路没接线（黄叹号）
 *
 * 为什么不能靠"我们自己记得发过什么"：那只是本地记账，
 * 装置拔了线、继电器没接负载，本地记账照样全绿——自检就白做了。
 */

export type CheckState = 'idle' | 'testing' | 'ok' | 'warn';

/*
 * 时间都卡在"看得见"和"不到 1 秒"之间：
 * 灯亮 900ms 再回查（太短人眼看不见，回查也容易撞上刚熄灭的那一刻），
 * 熄灭后再留 450ms 才进下一路——四路走完约 3.7 秒，正好是"看一圈"的长度。
 */
const ON_MS = 900; // 这一路亮着多久
const WAIT_ON = 420; // 发出去之后等多久去回查
const QUERY_MS = 400; // 回查等多久算没回应
const WAIT_OFF = 450; // 熄灭之后再进下一路

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function allIdle(): Record<string, CheckState> {
  const s: Record<string, CheckState> = {};
  for (const c of BASIC_CAPS) s[c.id] = 'idle';
  return s;
}

export interface SelfCheck {
  state: Record<string, CheckState>;
  running: boolean;
  /** 跑完之后的一句话结论（跑之前是 null） */
  summary: string | null;
  run: () => Promise<void>;
}

export function useSelfCheck(): SelfCheck {
  const [state, setState] = useState<Record<string, CheckState>>(allIdle);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setSummary(null);
    setState(allIdle());

    let okCount = 0;
    for (const cap of BASIC_CAPS) {
      setState((s) => ({ ...s, [cap.id]: 'testing' }));

      ARGX.cue(cap.id, { i: 1, dur: ON_MS, pri: 2 }); // 亮 / 响 / 震 / 通电
      await sleep(WAIT_ON);

      const st = await ARGX.state({ timeout: QUERY_MS }); // 回查：设备到底有没有照做
      const got = st?.out?.[cap.id];
      const passed = !!got && got.i >= 0.5;
      if (passed) okCount++;

      setState((s) => ({ ...s, [cap.id]: passed ? 'ok' : 'warn' }));

      ARGX.cue(cap.id, { i: 0, dur: 300 }); // 灭 / 停 / 断电
      await sleep(WAIT_OFF);
    }

    setRunning(false);
    setSummary(
      okCount === BASIC_CAPS.length
        ? '四路都对上了，装置没问题'
        : `${okCount} 路对上，${BASIC_CAPS.length - okCount} 路没回应（多半是那一路没接线）`
    );
  }, [running]);

  return { state, running, summary, run };
}
