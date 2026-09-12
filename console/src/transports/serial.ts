import type { Transport } from './types';

/*
 * Web Serial 传输：连真实的 ESP32。
 *
 * 本阶段只做连通性验证（能连上、能看到 ready、能发一帧出去），
 * 不承担设备端的完整验证——那是虚拟装置的活。
 *
 * 三条硬约束（协议与浏览器共同决定的，不是选择）：
 *   1. 必须在 HTTPS 或 localhost 下，否则 navigator.serial 直接不存在
 *   2. 首次连接必须由用户真实点击触发，不能自动连
 *   3. 只有桌面 Chrome/Edge 支持，手机浏览器不行
 */

const BAUD_RATE = 115200;

/*
 * 只声明用到的这几个成员，避免为 Web Serial 多装一个类型包。
 * 类型名统一加 Argx 前缀：TS 的 DOM 库自己也有一份 SerialPort，
 * 同名会让结构比较拿错参照系（真实报错是 WritableStream 的泛型对不上）。
 */
interface ArgxSerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

interface ArgxSerialApi {
  requestPort(options?: unknown): Promise<ArgxSerialPort>;
  getPorts(): Promise<ArgxSerialPort[]>;
  addEventListener(type: 'disconnect', cb: (e: Event) => void): void;
  removeEventListener(type: 'disconnect', cb: (e: Event) => void): void;
}

function getSerial(): ArgxSerialApi | undefined {
  return (navigator as unknown as { serial?: ArgxSerialApi }).serial;
}

export class SerialTransport implements Transport {
  readonly kind = 'serial' as const;
  readonly label = 'Serial（真实 ESP32）';
  readonly available: boolean;
  readonly unavailableReason?: string;

  private port: ArgxSerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private buffer = '';
  private msgCbs: ((line: string) => void)[] = [];
  private closeCbs: ((reason: string) => void)[] = [];
  private onDeviceGone = () => this.fireClose('串口设备已断开（线被拔了？）');

  constructor() {
    const serial = getSerial();
    if (!serial) {
      this.available = false;
      this.unavailableReason =
        '当前环境没有 Web Serial。三种常见原因：' +
        '页面不是 https:// 或 localhost（比如用局域网 IP 打开的）；' +
        '浏览器不是桌面版 Chrome/Edge；用的是手机。';
    } else {
      this.available = true;
    }
  }

  async connect(): Promise<void> {
    const serial = getSerial();
    if (!serial) throw new Error(this.unavailableReason);

    // 这一步必须由用户点击触发，浏览器会弹端口选择框
    this.port = await serial.requestPort();
    await this.port.open({ baudRate: BAUD_RATE });

    // 直接读写字节流，自己用 TextEncoder/TextDecoder 转字符串。
    // 不用 TextDecoderStream 那一套：它和管道的泛型类型在 TS 里对不上，
    // 而且多一层流就多一处出错的地方。
    this.writer = this.port.writable!.getWriter();
    this.reader = this.port.readable!.getReader();

    serial.addEventListener('disconnect', this.onDeviceGone);
    void this.readLoop();
  }

  private async readLoop(): Promise<void> {
    try {
      for (;;) {
        const { value, done } = await this.reader!.read();
        if (done) break;
        // stream: true —— 一个多字节字符可能被切成两个 chunk，
        // 不带上这个参数，中文日志会随机变成乱码
        if (value) this.feed(this.decoder.decode(value, { stream: true }));
      }
      this.fireClose('串口读取结束，设备可能已拔出');
    } catch (e) {
      this.fireClose(`串口读取出错：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private feed(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      for (const cb of this.msgCbs) cb(line);
    }
  }

  async send(text: string): Promise<void> {
    if (!this.writer) throw new Error('串口还没连上');
    await this.writer.write(this.encoder.encode(text.endsWith('\n') ? text : text + '\n'));
  }

  onMessage(cb: (line: string) => void): void {
    this.msgCbs.push(cb);
  }

  onClose(cb: (reason: string) => void): void {
    this.closeCbs.push(cb);
  }

  async close(): Promise<void> {
    const serial = getSerial();
    serial?.removeEventListener('disconnect', this.onDeviceGone);
    try {
      await this.reader?.cancel();
      this.reader?.releaseLock();
    } catch {
      /* 已经断了就算了 */
    }
    try {
      this.writer?.releaseLock();
    } catch {
      /* 同上 */
    }
    try {
      await this.port?.close();
    } catch {
      /* 同上 */
    }
    this.reader = null;
    this.writer = null;
    this.port = null;
    this.buffer = '';
  }

  private fireClose(reason: string): void {
    for (const cb of this.closeCbs) cb(reason);
  }
}
