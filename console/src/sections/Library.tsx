import { useMemo, useState } from 'react';
import { WORKS, workKind, type Work } from '../works';
import { CHANNELS, channelOf } from '../core/channels';
import { useDevice } from '../core/device';
import { isConnectedStatus } from '../ui/StatusBar';
import { Btn, Card, EmptyState, Pill } from '../ui/primitives';
import { PageHead } from '../ui/Chrome';
import {
  IcoArrowRight, IcoCheck, IcoClock, IcoExternal, IcoImageOff, IcoPlay, IcoSearch
} from '../ui/icons';
import { playHash } from '../routes';

/*
 * ARG 库：作品目录页。
 *
 * 条目分两类，去向不同，界面上要一眼分得清：
 *   ① 自家 demo      → 进站内播放页（#play:<id>），作品真的在跑，右侧状态栏跟着动
 *   ② 第三方项目     → 新标签打开作者自己部署的站点
 *   ③ 还没上线       → 只展示，按钮禁用
 *
 * **控制台不是作品托管平台**：第三方作品永远跑在作者自己的站上，
 * 这里只存一个网址。所以没有、也不该有"提交作品 / 注册作品"这类界面。
 *
 * 筛选维度全部来自 works.ts 里**真实存在的字段**。原型画的「15 分钟内 / 已安装 /
 * 加载更多（共 12 个）」在这里拿不到数据 —— 没有安装态，也没有 12 个作品。
 */

type Filter = 'all' | 'playable' | 'play' | 'external' | 'sound' | 'relay' | 'lightOnly';
type Sort = 'default' | 'short';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'playable', label: '现在就能玩' },
  { key: 'play', label: '站内试玩' },
  { key: 'external', label: '第三方作品' },
  { key: 'sound', label: '需要声音' },
  { key: 'relay', label: '需要继电器' },
  { key: 'lightOnly', label: '只用灯光' }
];

/** 时长是「约 5 分钟」这样的字符串，排序时把数字抠出来。抠不到就排最后 */
function minutes(duration: string): number {
  const m = duration.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

export function Library() {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('default');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = WORKS.filter((w) => {
      if (needle) {
        const hay = `${w.title} ${w.author} ${w.summary}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      switch (filter) {
        case 'playable': return w.status === '可用' && workKind(w) !== 'soon';
        case 'play': return workKind(w) === 'play';
        case 'external': return workKind(w) === 'external';
        case 'sound': return w.needs.includes('sound.beeper') || !!w.optional?.includes('sound.beeper');
        case 'relay': return w.needs.includes('env.relay') || !!w.optional?.includes('env.relay');
        case 'lightOnly': return w.needs.every((id) => id === 'light.main');
        default: return true;
      }
    });
    if (sort === 'short') out = [...out].sort((a, b) => minutes(a.duration) - minutes(b.duration));
    return out;
  }, [filter, sort, q]);

  const playable = WORKS.filter((w) => w.status === '可用' && workKind(w) !== 'soon').length;

  return (
    <>
      <PageHead
        title="ARG 库"
        sub={`${WORKS.length} 个作品 · ${playable} 个现在就能玩`}
        actions={
          <>
            <span className="search">
              <IcoSearch />
              <input
                className="input"
                placeholder="搜索作品"
                aria-label="搜索作品"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </span>
            <select
              className="select"
              aria-label="排序"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="default">默认顺序</option>
              <option value="short">时长从短到长</option>
            </select>
          </>
        }
      />

      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip${filter === f.key ? ' act' : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IcoImageOff />}
            title="没有匹配的作品"
            desc="换一个筛选条件，或者把搜索词清掉。"
            actions={<Btn tone="primary" onClick={() => { setFilter('all'); setQ(''); }}>清除筛选</Btn>}
          />
        </Card>
      ) : (
        <div className="works">
          {list.map((w) => <WorkCard key={w.id} work={w} />)}
        </div>
      )}
    </>
  );
}

/* ============================================================
   作品卡
   ============================================================ */
function WorkCard({ work }: { work: Work }) {
  const d = useDevice();
  const kind = workKind(work);
  const live = isConnectedStatus(d.status);
  const caps = d.caps;

  // 连上装置之后，标出这台装置能不能跑
  const missing = live && caps
    ? work.needs.filter((id) => !caps.out.includes(id))
    : [];

  const open = () => {
    if (kind === 'play') {
      // 改 hash，App 的 hashchange 会接手。地址栏本来就是这套路由的真相
      window.location.hash = playHash(work.id).slice(1);
    } else if (kind === 'external') {
      window.open(work.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="work"
      role={kind === 'soon' ? undefined : 'button'}
      tabIndex={kind === 'soon' ? undefined : 0}
      aria-disabled={kind === 'soon' ? true : undefined}
      onClick={kind === 'soon' ? undefined : open}
      onKeyDown={(e) => {
        if (kind === 'soon') return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      }}
      style={kind === 'soon' ? { cursor: 'default', opacity: .82 } : undefined}
    >
      <div className="cover">
        <span className={`cv-kind cv-kind--${kind}`}>
          {kind === 'play' ? <><IcoPlay />试玩</>
            : kind === 'external' ? <>访问作品站 <IcoExternal /></>
              : <>未上线</>}
        </span>
        <span className="cv-tag"><IcoClock />{work.duration.replace('约 ', '')}</span>
        <span className="ph"><IcoImageOff /></span>
      </div>

      <div className="body">
        <span className="w-go" aria-hidden="true">
          {kind === 'external' ? <IcoExternal /> : <IcoArrowRight />}
        </span>
        <div className="w-name">{work.title}</div>
        <div className="w-desc">{work.summary}</div>

        <div className="w-meta">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {work.author}
            {work.status !== '可用' ? <Pill tone="warning" small>{work.status}</Pill> : null}
            {live && missing.length === 0 ? <Pill tone="success" small>装置能跑</Pill> : null}
            {live && missing.length > 0 ? <Pill tone="danger" small>缺 {missing.length} 项</Pill> : null}
          </span>
          <span className="hw" title={hardwareTitle(work)}>
            {CHANNELS.map((c) => {
              const need = work.needs.includes(c.id);
              const opt = !!work.optional?.includes(c.id);
              // 不需要的那一路留一个空的灰点：点阵的位置感比"消失"更好读
              if (!need && !opt) return <i key={c.id} title={`不需要${c.label}`} />;
              return (
                <i
                  key={c.id}
                  data-ch={c.key}
                  className={need ? 'on' : 'opt'}
                  title={`${need ? '需要' : '有了更好'}：${c.label}`}
                >
                  <IcoCheck />
                </i>
              );
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/** hover 提示：把能力 id 翻成人话＋「必需 / 有了更好」 */
function hardwareTitle(w: Work): string {
  const need = w.needs.map((id) => `${channelOf(id)?.label ?? id}（必需）`);
  const opt = (w.optional ?? []).map((id) => `${channelOf(id)?.label ?? id}（有了更好）`);
  const all = [...need, ...opt];
  return all.length ? all.join('、') : '不需要任何装置，纯网页作品';
}
