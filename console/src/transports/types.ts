/*
 * 传输层统一接口。
 *
 * 与阶段一保持一致：connect / send / onMessage / close。
 * 将来加 WebSocket、蓝牙之类的通道，只需要再写一个实现，上层一行都不用改。
 * 上层（Session）只认这个接口，不关心底下是虚拟装置还是真串口。
 */

export type TransportKind = 'mock' | 'serial';

export interface Transport {
  /** 界面上要能看出当前用的是哪种传输 */
  readonly kind: TransportKind;
  readonly label: string;
  /** 这个传输在当前环境里能不能用（例如 Web Serial 需要安全上下文） */
  readonly available: boolean;
  /** 不可用时的人话原因 */
  readonly unavailableReason?: string;

  /** Mock 是同步的，Serial 是异步的，所以允许两种返回 */
  connect(): void | Promise<void>;
  /** 发一整帧。补换行与编码由传输层负责，上层只发文本 */
  send(text: string): void | Promise<void>;
  onMessage(cb: (line: string) => void): void;
  onClose(cb: (reason: string) => void): void;
  close(): Promise<void> | void;
}
