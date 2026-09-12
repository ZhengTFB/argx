/** 导航分区。界面里别的地方要跳转时用这个类型。 */
export type SectionId =
  | 'overview'
  | 'devices'
  | 'works'
  | 'simulator'
  | 'timeline'
  | 'docs'
  | 'creator';

export interface SectionDef {
  id: SectionId;
  label: string;
  hint: string;
}

export const SECTIONS: SectionDef[] = [
  { id: 'overview', label: '总览', hint: '一屏看完当前状态' },
  { id: 'devices', label: '设备', hint: '连接、测试、能力查看' },
  { id: 'works', label: 'ARG 库', hint: '支持本项目的作品' },
  { id: 'simulator', label: '模拟器', hint: '没有硬件也能看整套东西怎么运作' },
  { id: 'timeline', label: '时间线', hint: '收发事件实时滚动' },
  { id: 'docs', label: '文档', hint: '连接方法、引脚表、排查' },
  { id: 'creator', label: '创作者平台', hint: '阶段三填充' }
];
