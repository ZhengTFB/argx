import type { Transport } from '../transports/types';
import type { ArgxTransport } from './sdk';

/*
 * 两种传输层的接口对不上，这里做一次翻译。
 *
 *   控制台的传输层（阶段二产物）：send(text) / onMessage(line)   —— 文本
 *   SDK 的传输层（阶段三产物）：  send(frame) / onMessage(frame) —— 对象
 *
 * 为什么不让两边一样：阶段二那个接口的契约是"补换行由传输层负责"，
 * 而补换行这件事**差点被漏掉**（阶段二冒烟测试抓到的第一个真 bug，
 * 整个链路静默失效）。阶段三把对象进对象出定成契约，正是为了让它不可能被漏：
 * 会话层根本拿不到"要不要补换行"这个选择。
 *
 * 但线上跑的帧格式两边必须完全一致——所以这里只是把 JSON.stringify
 * 与解析搬到边界上，协议一个字都没变。
 */

/** 一个 { 开头且能解析成对象的行才算帧；其余（ROM 日志、坏 JSON）当噪音丢掉 */
function parseLine(line: string): Record<string, unknown> | null {
  const clean = line.replace(/\r$/, '');
  if (!clean || clean[0] !== '{') return null;
  try {
    const v: unknown = JSON.parse(clean);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function asArgxTransport(t: Transport, label?: string): ArgxTransport {
  // 同一条通道会被**两个**会话用：控制台自己的那个，和嵌在 iframe 里的 Demo。
  // 所以 connect() 必须幂等——串口的 connect 是 requestPort()，
  // 第二次调用既会二次弹窗，又不在用户的点击调用栈里（浏览器直接拒）。
  let opened = false;

  return {
    label: label ?? t.label,
    connect: async () => {
      if (opened) return;
      await t.connect();
      opened = true;
    },
    send: (frame) => {
      // 换行由这一层补。控制台的传输层契约就是这么定的（见上面那段注释）
      void t.send(JSON.stringify(frame) + '\n');
    },
    onMessage: (cb) => {
      t.onMessage((line) => {
        const frame = parseLine(line);
        if (frame) cb(frame);
      });
    },
    onClose: (cb) => t.onClose(cb),
    close: () => {
      opened = false;
      return t.close();
    }
  };
}
