import type { ReactNode, SVGProps } from 'react';

/*
 * 图标集。
 *
 * 全部是 24 格线性图标，尺寸由 CSS 的 width/height 控制（组件的 svg 规则里已经定了），
 * 这里只负责 path。stroke-width 用 1.8 —— 与原型一致，比 2 更细，看起来不笨。
 */

function Ico({ children, ...rest }: { children: ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------- 导航 ---------- */
export const IcoGuide = () => (
  <Ico><path d="M12 3l2.5 5.5L20 11l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-2.5z" /></Ico>
);
export const IcoLibrary = () => (
  <Ico><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></Ico>
);
export const IcoDevice = () => (
  <Ico>
    <rect x="4" y="4" width="16" height="16" rx="2.5" /><rect x="8" y="8" width="8" height="8" rx="1" />
    <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
  </Ico>
);
export const IcoSimulator = () => (
  <Ico><path d="M3 17V9M7.5 20V5M12 17V7M16.5 20V5M21 17V9" /></Ico>
);
export const IcoDocs = () => (
  <Ico><path d="M5 3h9l5 5v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M14 3v5h5M8 13h8M8 17h5" /></Ico>
);
export const IcoDebug = () => (
  <Ico><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14" /></Ico>
);
export const IcoHelp = () => (
  <Ico><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" /><path d="M12 17h.01" /></Ico>
);

/* ---------- 四路通道 ---------- */
export const IcoLight = () => (
  <Ico><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.4.3.5.7.5 1.1h6c0-.4.1-.8.5-1.1A6 6 0 0012 3z" /></Ico>
);
export const IcoSound = () => (
  <Ico><path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7M18.5 6a9 9 0 010 12" /></Ico>
);
export const IcoMotion = () => (
  <Ico><rect x="8" y="4" width="8" height="16" rx="2" /><path d="M5 9v6M19 9v6M2.5 11v2M21.5 11v2" /></Ico>
);
export const IcoRelay = () => (
  <Ico><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z" /></Ico>
);
export const IcoPulse = () => (
  <Ico><path d="M3 12h4l2-5 3 10 2.5-7 1.5 2h5" /></Ico>
);

/* ---------- 通用 ---------- */
export const IcoCheck = () => <Ico><path d="M20 6L9 17l-5-5" /></Ico>;
export const IcoCheckCircle = () => (
  <Ico><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Ico>
);
export const IcoAlert = () => (
  <Ico><path d="M12 3l9 16H3l9-16z" /><path d="M12 9v5M12 17h.01" /></Ico>
);
export const IcoInfo = () => (
  <Ico><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></Ico>
);
export const IcoX = () => <Ico><path d="M6 6l12 12M18 6L6 18" /></Ico>;
export const IcoSearch = () => <Ico><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Ico>;
export const IcoArrowRight = () => <Ico><path d="M5 12h14M13 6l6 6-6 6" /></Ico>;
export const IcoArrowLeft = () => <Ico><path d="M19 12H5M11 6l-6 6 6 6" /></Ico>;
export const IcoChevronRight = () => <Ico><path d="M9 6l6 6-6 6" /></Ico>;
export const IcoExternal = () => (
  <Ico><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></Ico>
);
export const IcoPlay = () => <Ico><path d="M8 5.5v13l11-6.5-11-6.5z" /></Ico>;
export const IcoPlus = () => <Ico><path d="M12 5v14M5 12h14" /></Ico>;
export const IcoRefresh = () => (
  <Ico><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 5v6h-6" /></Ico>
);
export const IcoLink = () => (
  <Ico><path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1" /><path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" /></Ico>
);
export const IcoPlug = () => (
  <Ico><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-6 6 6 6 0 01-6-6V8zM12 17v5" /></Ico>
);
export const IcoChip = () => (
  <Ico><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></Ico>
);
export const IcoStop = () => <Ico><rect x="6" y="6" width="12" height="12" rx="2" /></Ico>;
export const IcoDownload = () => (
  <Ico><path d="M12 3v12M7 10l5 5 5-5M5 19h14" /></Ico>
);
export const IcoClock = () => (
  <Ico><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Ico>
);
export const IcoImage = () => (
  <Ico><rect x="3" y="4" width="18" height="14" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 15l-5-4-7 7" /></Ico>
);
export const IcoImageOff = () => (
  <Ico><path d="M3 3l18 18" /><path d="M21 15l-5-4-3 3" /><path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-.5 1.3" /><path d="M3 19V5l11 11-7 7" /></Ico>
);
export const IcoWrench = () => (
  <Ico><path d="M14.7 6.3a4 4 0 105.4 5.4l-2.8-2.8 1.4-4.2-4.2 1.4-2.8-2.8z" /><path d="M13 11l-8 8 3 3 8-8" /></Ico>
);
export const IcoGrid = () => (
  <Ico><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Ico>
);
export const IcoBook = () => (
  <Ico><path d="M4 4h7a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H4V4z" /><path d="M20 4h-4a3 3 0 00-3 3v13a2.5 2.5 0 012.5-2.5H20V4z" /></Ico>
);
