/*
 * ARG 作品库数据。
 *
 * 加新作品 = 在 WORKS 里加一条数据，不需要改任何组件代码。字段含义见 Work 接口。
 *
 * needs 是**人工标注**的，不自动识别作品代码——一个作品要用到哪些装置，
 * 创作者自己最清楚，猜错了反而误导玩家。
 */

/** 条目的去向。由 link 的形状推出来，不加字段 —— 一种形态一种含义，没有歧义 */
export type WorkKind =
  /** 自家 demo：进控制台的站内播放页，作品真的在跑，右侧状态栏跟着动 */
  | 'play'
  /** 第三方项目：跑在作者自己部署的站上，新标签打开 */
  | 'external'
  /** 还没上线，只在本库里展示 */
  | 'soon';

export interface Work {
  id: string;
  title: string;
  author: string;
  /** 一句话说清这是个什么体验 */
  summary: string;
  /** 需要哪些能力 id，空数组表示纯网页作品 */
  needs: string[];
  /**
   * 有了更好、没有也能玩的能力。
   *
   * 为什么需要这一栏：SDK 会按装置的能力声明**自动跳过**它没有的那几路
   *（见 sdk/AGENTS.md），所以"缺一件就不能玩"和"缺一件就少一个效果"
   * 是两回事，混在一起会让玩家以为不买齐四样就玩不了。
   */
  optional?: string[];
  /** 大概多久能玩完 */
  duration: string;
  status: '可用' | '内测' | '规划中';
  /**
   * 作品入口，三种形态：
   *   '#play:<workId>'  自家的，进站内播放页（作品在控制台里跑起来）
   *   'https://…'       第三方项目，跑在作者自己的站上，新标签打开
   *   省略 / ''         还没上线，只展示，按钮禁用
   *
   * **控制台不是作品托管平台**：第三方作品永远跑在作者自己的站上，
   * 这里只存一个网址。所以没有、也不该有"提交作品"这类界面。
   */
  link?: string;
}

export const WORKS: Work[] = [
  {
    id: 'work-study',
    title: '深夜自习室',
    author: 'ARGX 示例',
    summary:
      '你在自习室捡到一本不属于任何人的笔记。翻到第三页时，桌上的灯会自己暗下去。',
    needs: ['light.main', 'sound.beeper'],
    optional: ['motion.vibrate', 'env.relay'],
    duration: '约 5 分钟',
    status: '可用',
    // 这是阶段三的 Demo 本身（demo/ 目录），点开就能在控制台里玩一遍
    link: '#play:work-study'
  },
  {
    id: 'work-beacon',
    title: '灯塔守夜人',
    author: 'ARGX 示例',
    summary:
      '荒岛灯塔的最后一位守夜人。每一次答复都会换来一声回响，直到海面彻底安静。',
    needs: ['light.main', 'sound.beeper'],
    duration: '约 25 分钟',
    status: '可用'
  },
  {
    id: 'work-knock',
    title: '谁在敲墙',
    author: 'ARGX 示例',
    summary:
      '隔壁房间传来有节奏的敲击。你必须用同样的节奏回应它——回错了，它就不敲了。',
    needs: ['motion.vibrate', 'sound.beeper'],
    duration: '约 20 分钟',
    status: '内测'
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
  },
  {
    id: 'work-hollow',
    title: '空屋来客',
    author: '拾光工作室',
    summary:
      '一间待售空屋的看房直播。观众在聊天室里点哪盏灯，屏幕这头的灯就真的亮哪一盏。',
    needs: ['light.main'],
    optional: ['sound.beeper', 'env.relay'],
    duration: '约 40 分钟',
    status: '可用',
    // 第三方项目：跑在作者自己的站上，控制台只存网址。
    // 这条数据是示例，按需改删。
    link: 'https://example.com/argx/hollow-house'
  }
];

/** 从 link 的形状判断条目去向 */
export function workKind(w: Work): WorkKind {
  const link = (w.link ?? '').trim();
  if (!link || link === '#') return 'soon';
  return link.startsWith('#play:') ? 'play' : 'external';
}

/** 站内播放页要的作品 id */
export function playWorkId(w: Work): string | null {
  const link = (w.link ?? '').trim();
  return link.startsWith('#play:') ? link.slice(6) : null;
}

export function findWork(id: string): Work | undefined {
  return WORKS.find((w) => w.id === id);
}
