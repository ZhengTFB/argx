import { useEffect, useState } from 'react';
import { basicDevice } from '../../core/basicDevice';
import type { BasicSection } from './routes';
import Onboarding from './Onboarding';
import DeviceSelect from './DeviceSelect';
import SelfCheck from './SelfCheck';
import CapabilityStatus from './CapabilityStatus';
import BasicWorks from './BasicWorks';
import DemoPlayer from './DemoPlayer';
import { useSelfCheck } from './useSelfCheck';

/*
 * 小白控制台。
 *
 * 四块内容：引导、设备选择（含自检）、ARG 库，右侧固定一栏显示装置现在什么样。
 * 深浅两套配色的分界就在这里——这一页是白底、大按钮、不出现任何术语，
 * 专业版那一套原封不动。
 *
 * 进来自动连上模拟器：点进来应该直接看到东西在动，
 * 而不是先要求用户去做一次"连接"动作（专业版的模拟器也是这个做法）。
 */

const GUIDE_KEY = 'argx.basic.guide.done';

function guideDone(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false; // 隐私模式下读不到 localStorage，那就每次都显示，不影响用
  }
}

export default function BasicApp({
  section,
  play
}: {
  section: BasicSection;
  play?: string;
}) {
  const [showGuide, setShowGuide] = useState(() => !guideDone());
  const check = useSelfCheck();

  useEffect(() => {
    basicDevice.ensure();
  }, []);

  const go = (hash: string) => {
    window.location.hash = hash;
  };

  const dismissGuide = () => {
    setShowGuide(false);
    try {
      localStorage.setItem(GUIDE_KEY, '1');
    } catch {
      /* 存不下就存不下，下次再显示一遍而已 */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper-50 text-fg-900">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line-300 bg-paper-0 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-semibold text-fg-900">ARGX</span>
          <span className="text-[12px] text-fg-400">让故事操控现实里的物件</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go('help')}
            className="rounded-lg border border-line-400 px-3 py-1.5 text-[12px] text-fg-600 hover:bg-paper-100"
          >
            帮助
          </button>
          <button
            type="button"
            onClick={() => go('overview')}
            className="rounded-lg border border-line-400 px-3 py-1.5 text-[12px] text-fg-600 hover:bg-paper-100"
          >
            专业控制台
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          {play ? (
            // 播放页要占满：作品是整屏的终端，缩在一格里就没法看了
            <DemoPlayer workId={play} onBack={() => go('home')} />
          ) : (
          <div className="mx-auto grid w-full max-w-3xl gap-5">
            {section === 'help' ? (
              <div className="grid gap-4">
                <Onboarding />
                <button
                  type="button"
                  onClick={() => go('home')}
                  className="justify-self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  回到刚才那页
                </button>
              </div>
            ) : section === 'device' ? (
              <>
                <DeviceSelect />
                <SelfCheck check={check} />
              </>
            ) : section === 'library' ? (
              <BasicWorks onPlay={(id) => go(`play:${id}`)} />
            ) : (
              <>
                {showGuide && <Onboarding onDismiss={dismissGuide} />}
                <DeviceSelect />
                <SelfCheck check={check} />
                <BasicWorks onPlay={(id) => go(`play:${id}`)} />
              </>
            )}
          </div>
          )}
        </main>

        <aside className="shrink-0 border-t border-line-300 bg-paper-0 p-5 lg:w-72 lg:border-t-0 lg:border-l">
          <CapabilityStatus check={check.state} />
        </aside>
      </div>
    </div>
  );
}
