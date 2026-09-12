/*
 * ARG 作品库数据。
 *
 * 这是本阶段的**扩展位**：加新作品 = 在 WORKS 里加一条数据，
 * 不需要改任何组件代码。字段含义见 Work 接口。
 *
 * needs 是**人工标注**的，不自动识别作品代码——一个作品要用到哪些装置，
 * 创作者自己最清楚，猜错了反而误导玩家。
 */

export interface Work {
  id: string;
  title: string;
  author: string;
  /** 一句话说清这是个什么体验 */
  summary: string;
  /** 需要哪些能力 id，空数组表示纯网页作品 */
  needs: string[];
  /** 大概多久能玩完 */
  duration: string;
  status: '可用' | '内测' | '规划中';
  /** 作品入口，阶段三之前留空 */
  link?: string;
}

export const WORKS: Work[] = [
  {
    id: 'work-study',
    title: '深夜自习室',
    author: 'ARGX 示例',
    summary:
      '你在自习室捡到一本不属于任何人的笔记。翻到第三页时，桌上的灯会自己暗下去。',
    needs: ['light.main'],
    duration: '约 15 分钟',
    status: '可用',
    link: '#'
  },
  {
    id: 'work-beacon',
    title: '灯塔守夜人',
    author: 'ARGX 示例',
    summary:
      '荒岛灯塔的最后一位守夜人。每一次答复都会换来一声回响，直到海面彻底安静。',
    needs: ['light.main', 'sound.beeper'],
    duration: '约 25 分钟',
    status: '可用',
    link: '#'
  },
  {
    id: 'work-knock',
    title: '谁在敲墙',
    author: 'ARGX 示例',
    summary:
      '隔壁房间传来有节奏的敲击。你必须用同样的节奏回应它——回错了，它就不敲了。',
    needs: ['motion.vibrate', 'sound.beeper'],
    duration: '约 20 分钟',
    status: '内测',
    link: '#'
  },
  {
    id: 'work-blackout',
    title: '停电之后',
    author: 'ARGX 示例',
    summary:
      '整栋楼只剩你这一户还有电。你可以选择把电分给谁——冰箱、台灯，或者那扇不该打开的门。',
    needs: ['env.relay', 'light.main'],
    duration: '约 35 分钟',
    status: '规划中'
  }
];
