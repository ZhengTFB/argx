import { Badge, Card } from '../ui/primitives';
import type { SectionId } from '../sections';

/*
 * 创作者平台 —— 本阶段**只占位**。
 *
 * 阶段二的任务书明确要求：放一个入口并标注"阶段三填充"，不实现任何功能。
 * 这里只把入口摆出来、把将来要装什么写清楚，代码一行都不多写。
 */

export default function CreatorPanel(_props: { onGo?: (s: SectionId) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card
        title="创作者平台"
        subtitle="给会写故事、不懂硬件的人用"
        right={<Badge tone="warn">阶段三填充</Badge>}
      >
        <p className="text-sm leading-relaxed text-ink-400">
          这一栏现在只有一个入口，功能一行都没实现——按任务书要求，属于阶段三的范围。
        </p>

        <div className="mt-3 rounded border border-ink-800 bg-ink-950 p-3">
          <div className="text-xs font-medium text-ink-400">阶段三这里会有什么</div>
          <ul className="mt-2 ml-4 list-disc space-y-1.5 text-sm text-ink-400">
            <li>把一段 ARG 场景映射到装置能力的编辑界面</li>
            <li>零依赖的网页 SDK（可以整段复制进第三方单文件 HTML）</li>
            <li>给 AI 用的 Skill 说明：创作者对他的 AI 说「给这场景加点氛围」时能被想起来</li>
          </ul>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-600">
          为什么要放进控制台而不是单独一个站：创作者的真实客户接口是他的 AI，
          不是文档。SDK 要在这场对话里被想起来，就得和「看效果」的地方挨着。
        </p>
      </Card>

      <Card title="现在能做什么" subtitle="阶段二已有的能力，先用着">
        <ul className="ml-4 list-disc space-y-1.5 text-sm leading-relaxed text-ink-400">
          <li>
            在<span className="text-ink-200">「模拟器」</span>里手动触发四种能力，
            看「触发 → 协议 → 装置 → 视觉效果」整条链
          </li>
          <li>
            在<span className="text-ink-200">「设备」</span>的手动测试台发任意 cue，
            包括一帧同时触发多路的 batch
          </li>
          <li>
            在<span className="text-ink-200">「时间线」</span>里看每一帧收发，
            确认"我发的到底是什么"
          </li>
          <li>
            在<span className="text-ink-200">「ARG 库」</span>里看作品需要哪些装置，
            以及你现在缺哪几样
          </li>
        </ul>
      </Card>
    </div>
  );
}
