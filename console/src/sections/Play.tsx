import { useEffect, useRef, useState } from 'react';
import { device, useDevice } from '../core/device';
import { findWork, workKind } from '../works';
import { isConnectedStatus } from '../ui/StatusBar';
import { Btn, Card, EmptyState, Pill } from '../ui/primitives';
import { IcoArrowLeft, IcoExternal, IcoImageOff, IcoPlay } from '../ui/icons';
import type { SectionKey } from '../routes';

/*
 * 站内播放页（#play:<workId>）。
 *
 * 嵌的是**真页面**（demo/index.html），不是在 React 里重写一份剧情界面 ——
 * Demo 是给别人抄的样板，有两份就一定会有对不上的那一天。
 *
 * ★ iframe 的顺序不能反（CLAUDE.md 已知坑 13）：
 *   必须先把通道挂到 window.ARGX_HOST_TRANSPORT，再给 iframe 设 src。
 *   反过来作品会先按"没有宿主通道"初始化，自己去找串口。
 *
 * ★ key 用 sessionNo（CLAUDE.md 已知坑 12 的延伸）：
 *   换一次装置就换一个 key，iframe 才会重新加载并跟上新通道。
 *   不加 key 的话，作品还在用那条已经关掉的旧通道发 cue，而且不会报错。
 */

export function Play({ workId, onGo }: { workId: string; onGo: (k: SectionKey) => void }) {
  const d = useDevice();
  const work = findWork(workId);
  const [src, setSrc] = useState<string | null>(null);
  const published = useRef<number>(-1);

  useEffect(() => {
    // 通道已经挂上去了（device.attach 里做的），而且这次会话跟上次不是同一条
    if (!device.hostTransport) { setSrc(null); return; }
    if (published.current === d.sessionNo) return;
    published.current = d.sessionNo;
    // './' 而不是 '../'：Demo 就在构建产物里（vite.config.ts 把 demo/ 拷进 dist），
    // 与控制台同级。写 '../' 只在「控制台正好挂在站点根」时才对，
    // 挂到子路径（GitHub Pages 的 /argx/console/）会解析到站点根上去 → 404。
    setSrc('./demo/index.html');
  }, [d.sessionNo, d.kind, d.status]);

  if (!work) {
    return (
      <Card>
        <EmptyState
          icon={<IcoImageOff />}
          title="找不到这个作品"
          desc={`作品 id「${workId}」不在库里。它也许被改名或下架了。`}
          actions={<Btn tone="primary" onClick={() => onGo('library')}>回到 ARG 库</Btn>}
        />
      </Card>
    );
  }

  const kind = workKind(work);
  const live = isConnectedStatus(d.status);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 4 }}>
            <Btn size="sm" tone="ghost" onClick={() => onGo('library')}>
              <IcoArrowLeft /> ARG 库
            </Btn>
            <span className="page-sub" style={{ marginTop: 0 }}>{work.author}</span>
          </div>
          <h1 className="page-title">{work.title}</h1>
          <div className="page-sub">{work.summary}</div>
        </div>
        <div className="head-actions">
          {live ? <Pill tone="success">装置已连接</Pill> : <Pill tone="idle">没连装置也能看</Pill>}
          {kind === 'external' ? (
            <Btn tone="secondary" onClick={() => window.open(work.link, '_blank', 'noopener,noreferrer')}>
              访问作品站 <IcoExternal />
            </Btn>
          ) : null}
        </div>
      </div>

      {kind !== 'play' ? (
        <Card>
          <EmptyState
            icon={<IcoPlay />}
            title="这个作品不在站内运行"
            desc={kind === 'external'
              ? '它跑在作者自己的站上，用新标签打开就能玩。'
              : '它还没上线，先在库里占个位。'}
            actions={
              <>
                {kind === 'external' ? (
                  <Btn tone="primary" onClick={() => window.open(work.link, '_blank', 'noopener,noreferrer')}>
                    访问作品站 <IcoExternal />
                  </Btn>
                ) : null}
                <Btn onClick={() => onGo('library')}>回到 ARG 库</Btn>
              </>
            }
          />
        </Card>
      ) : (
        <>
          <div className="player-frame">
            {src ? (
              <iframe
                key={d.sessionNo}
                src={src}
                title={work.title}
                allow="clipboard-write"
              />
            ) : (
              <div className="empty" style={{ height: 620 }}>
                <span aria-hidden="true"><IcoPlay /></span>
                <h4>作品需要一条连好的通道</h4>
                <p>
                  作品是通过宿主通道跟装置说话的。先去连一台装置（虚拟的也算），
                  这里就会自动把它挂上去。
                </p>
                <div className="acts">
                  <Btn
                    tone="primary"
                    onClick={() => { device.useSimulator(); }}
                  >
                    连虚拟装置
                  </Btn>
                  <Btn onClick={() => void device.useHardware()}>连真实装置</Btn>
                </div>
              </div>
            )}
          </div>
          <p className="page-sub" style={{ marginTop: 'var(--space-4)' }}>
            这是 <code>demo/</code> 里那个真页面，控制台只是把它嵌进来 —— 右边的状态栏跟着它动，
            说明两边说的是同一条通道。
          </p>
        </>
      )}
    </>
  );
}
