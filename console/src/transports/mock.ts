import { VirtualDevice, type ArgxVirtualDevice } from '../core/virtualDevice';
import type { Transport } from './types';

/**
 * Mock 传输：连的是阶段一的虚拟装置。本阶段默认与主力。
 *
 * 关键点：虚拟装置的时间是它自己的（`advance(ms)`），不跟系统时钟走——
 * 这是阶段一刻意设计的，好处是那份测试脚本测 15 秒看门狗不用真等 15 秒。
 * 到了界面里反过来用：这里用 setInterval 每帧把真实流逝的毫秒喂给它，
 * 于是渐变、TTL、看门狗都按真实时间推进，屏幕上看起来和真装置一样。
 */
export class MockTransport implements Transport {
  readonly kind = 'mock' as const;
  readonly label = 'Mock（虚拟装置）';
  readonly available = true;

  /** 模拟器要直接读它的状态来画虚拟灯 */
  readonly device: ArgxVirtualDevice;

  private tick: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private msgCbs: ((line: string) => void)[] = [];
  private closeCbs: ((reason: string) => void)[] = [];
  private wasConnected = false;

  constructor(devId = 'ARGX-0001') {
    this.device = new VirtualDevice({ dev: devId });
  }

  connect(): void {
    if (this.tick !== null) return;

    this.device.onLine((line) => {
      for (const cb of this.msgCbs) cb(line);
    });

    this.device.connect();
    this.wasConnected = true;

    this.lastTick = performance.now();
    this.tick = setInterval(() => {
      const now = performance.now();
      const delta = now - this.lastTick;
      this.lastTick = now;
      this.device.advance(delta);

      // 故障注入「中途断连」是装置自己断的，这里替它把事件转出来，
      // 否则界面会停在"以为还连着"的状态——那正是这个故障要暴露的问题。
      if (this.wasConnected && !this.device.isConnected()) {
        this.wasConnected = false;
        this.stopTimer();
        this.fireClose('对端主动断开了连接（故障注入或装置自己 close）');
      }
    }, 16);
  }

  send(text: string): void {
    // 传输层的契约是"发一整帧，换行由传输层补"。
    // 虚拟设备那边字符串是当成原始字节收的（留给垃圾串扰、半行分片用），
    // 不补这个换行，它会一直等一个永远不来的 \n——整个链路静默失效。
    this.device.send(text.endsWith('\n') ? text : text + '\n');
  }

  onMessage(cb: (line: string) => void): void {
    this.msgCbs.push(cb);
  }

  onClose(cb: (reason: string) => void): void {
    this.closeCbs.push(cb);
  }

  close(): void {
    this.stopTimer();
    if (this.device.isConnected()) this.device.close();
    this.wasConnected = false;
  }

  private stopTimer(): void {
    if (this.tick !== null) {
      clearInterval(this.tick);
      this.tick = null;
    }
  }

  private fireClose(reason: string): void {
    for (const cb of this.closeCbs) cb(reason);
  }
}
