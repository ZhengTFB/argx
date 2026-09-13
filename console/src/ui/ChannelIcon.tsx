import type { ComponentType } from 'react';
import { IcoLight, IcoMotion, IcoRelay, IcoSound } from './icons';
import type { ChannelKey } from '../core/channels';

/*
 * 四路各自的图标。
 *
 * 单独一个文件是因为它有三个使用者：通道卡、右侧状态栏、设备页的能力列表。
 * 抄三遍的话，改一个图标就要记得改三处 —— 而"这三处必须是同一个图标"
 * 恰恰是"一眼认出这是哪一路"的前提。
 */
const ICONS: Record<ChannelKey, ComponentType> = {
  light: IcoLight,
  sound: IcoSound,
  motion: IcoMotion,
  relay: IcoRelay
};

export function ChannelIcon({ ch }: { ch: string }) {
  const Icon = ICONS[ch as ChannelKey] ?? IcoLight;
  return <Icon />;
}
