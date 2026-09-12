import { CAPABILITIES } from '../core/capabilities';
import { Card } from '../ui/primitives';

/*
 * 文档区：**电脑侧**的连接方法与排查。
 *
 * 分工：装置侧怎么接线（哪个脚接什么元件）在 firmware/WIRING.md 里，
 * 这里只讲"怎么把装置连到这台电脑上、连不上怎么办"，两边不重复。
 */

const TROUBLES: { symptom: string; cause: string; fix: string }[] = [
  {
    symptom: '点"连接真实串口"没反应，或者浏览器压根不弹端口选择框',
    cause: '页面不是安全上下文',
    fix: '必须用 https:// 或 localhost 打开。用局域网 IP（192.168.x.x）时 navigator.serial 直接不存在，这不是 bug。'
  },
  {
    symptom: '端口选择框里一个端口都没有',
    cause: '线是只能充电的 USB 线，或者板子没上电',
    fix: '换一根确定能传数据的线（很多充电线只有电源两根线）。换线之后拔插一次再点连接。'
  },
  {
    symptom: '连上了，但一条 ready 都收不到',
    cause: '用的是原生 USB 口，但固件没开 USB CDC',
    fix: '在 Arduino IDE 里把 USB CDC On Boot 设为 Enabled 再重新烧录一次。硬件接线见 WIRING.md。'
  },
  {
    symptom: 'Windows 上端口列表里出现两个 COM 口，不知道选哪个',
    cause: 'S3-DevKitC-1 有两个 USB 口，两个都会枚举',
    fix: '拔掉一个口再看列表里少的是哪个。建议统一用丝印为 USB 的那个（原生 USB）。'
  },
  {
    symptom: '之前能连，现在连不上了',
    cause: '端口被别的程序占着（Arduino IDE 的串口监视器、另一个标签页）',
    fix: '关掉串口监视器和其它开了这个端口的页面，刷新本页重连。'
  },
  {
    symptom: '连上几秒就掉线，提示"10 秒没收到 pong"',
    cause: '对端不响应心跳，或线接触不良',
    fix: '先看时间线里有没有 ping 发出去、有没有 pong 回来。发得出去收不回来多半是线或驱动的问题。'
  },
  {
    symptom: '手机上打不开串口功能',
    cause: '手机浏览器不支持 Web Serial',
    fix: '这是已接受的场景约束，不是待修的 bug。给别人演示时让他看模拟器，不需要真实硬件。'
  },
  {
    symptom: '装置连上了但灯不亮',
    cause: '接线问题（这一条属于装置侧）',
    fix: '看 firmware/WIRING.md 的接线图与错误对照表，重点查 LED 有没有串电阻、极性有没有接反。'
  }
];

export default function DocsPanel() {
  return (
    <div className="grid gap-4">
      <Card title="三步连上真实装置" subtitle="照做就行，不用懂硬件">
        <ol className="ml-4 list-decimal space-y-2 text-sm leading-relaxed text-ink-400">
          <li>
            <span className="text-ink-200">用桌面版 Chrome 或 Edge 打开本页</span>
            ，地址必须是 <span className="font-mono text-ink-200">localhost</span> 或{' '}
            <span className="font-mono text-ink-200">https://</span>。手机不行。
          </li>
          <li>
            <span className="text-ink-200">用数据线把 ESP32 插到电脑上</span>
            。优先插板子上丝印为 <span className="font-mono">USB</span> 的那个口
            （S3-DevKitC-1 有两个 USB-C 口，另一个是串口芯片，两个都能用但容易搞混）。
            插上后板子上的电源灯应该亮。
          </li>
          <li>
            <span className="text-ink-200">
              到「设备」页面点「连接真实串口」
            </span>
            ，浏览器会弹出一个端口列表，选那个新增的端口（Windows 是 COM 加数字，
            Mac 是 usbmodem 或 usbserial 开头）。选中后装置会立刻上报自己的能力，
            「设备」页面里就能看到四路能力了。
          </li>
        </ol>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-600">
          首次连接必须由你本人点一下——浏览器不允许网页自己连串口，这是安全设计，不是我们的限制。
        </p>
      </Card>

      <Card title="引脚与端口对照表" subtitle="接哪个脚、需要什么元件；与 firmware/WIRING.md 一致">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs text-ink-400">
                <th className="py-2 pr-3 font-medium">能力 id</th>
                <th className="py-2 pr-3 font-medium">是什么</th>
                <th className="py-2 pr-3 font-medium">引脚</th>
                <th className="py-2 pr-3 font-medium">外围元件</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(CAPABILITIES).map((c) => (
                <tr key={c.id} className="border-b border-ink-800 align-top last:border-0">
                  <td className="py-2 pr-3">
                    <div className="text-ink-200">{c.label}</div>
                    <div className="font-mono text-[11px] text-ink-600">{c.id}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-ink-400">{c.what}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-argx-400">{c.pin}</td>
                  <td className="py-2 pr-3 text-xs text-ink-400">{c.parts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-600">
          独立供电提醒：灯带、振动马达、继电器模块都不能从 ESP32 取电，
          必须单独供电并且和 ESP32 共地。详细的接线图、元件清单、常见接错对照表都在{' '}
          <span className="font-mono">firmware/WIRING.md</span>。
        </p>
      </Card>

      <Card title="连不上时对着查" subtitle="按现象找原因">
        <div className="grid gap-2">
          {TROUBLES.map((t) => (
            <div key={t.symptom} className="rounded border border-ink-800 bg-ink-950 p-2.5">
              <div className="text-sm text-ink-200">{t.symptom}</div>
              <div className="mt-1 text-[11px] text-warn-400">多半是：{t.cause}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-ink-400">怎么办：{t.fix}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="本机开发命令" subtitle="给自己看的备忘">
        <pre className="overflow-x-auto rounded border border-ink-800 bg-ink-950 p-3 font-mono text-[12px] leading-relaxed text-ink-400">
{`# 启动控制台（本机 localhost）
npm install
npm run dev          # 打开 http://localhost:5173

# 构建纯静态产物，dist/ 直接丢到任意静态服务器
npm run build
npm run preview

# 跑协议一致性测试（阶段一产物，与界面对同一份协议）
node tests/run.js    # 在仓库根目录执行`}
        </pre>
      </Card>
    </div>
  );
}
