/*
 * 深夜自习室 —— ARGX 示例作品
 *
 * 这个文件是**第三方 ARG 的样板**：剧情怎么走、画面怎么画、
 * 什么时候让房间里的灯动一下。照抄这个结构就能接上自己的作品。
 *
 * 三条规矩，抄的时候一起抄走：
 *   1. **装置只负责"演"**。剧情判定一行都不许依赖它——
 *      没买装置、没插线、浏览器不支持的玩家，必须能完整通关。
 *   2. 埋点只放在**情绪转折点**上（翻开笔记、解开密码、结局），
 *      不是每个按钮都来一下。整页一共 5 个触发点。
 *   3. 触发用的是**事件名**（reveal / danger），不是"哪路灯配多大亮度"。
 *      该配多少由 SDK 的事件词表决定，创作者不需要关心。
 *
 * 剧本数据在 script.json 里，这个文件只负责把它演出来——
 * 改剧情不用碰代码。
 */

(function () {
  'use strict';

  var mount = document.getElementById('argx-demo');
  var hintEl = document.getElementById('argx-hint');
  var script = null;
  var node = null;

  // ---------------------------------------------------------------- 接上装置

  /*
   * 作品被别的页面嵌着跑时（例如 ARGX 控制台），宿主会把已经连好的通道放在
   * parent 上。这样作品不用自己再连一次，观众也不用点两次"连接"。
   * 独立打开时这里是 null，走 SDK 自己的默认逻辑。
   */
  function hostTransport() {
    try {
      if (window.parent && window.parent !== window) {
        return window.parent.ARGX_HOST_TRANSPORT || null;
      }
    } catch (e) {
      /* 跨域就读不到，按独立打开处理 */
    }
    return null;
  }

  // ---------------------------------------------------------------- 工具

  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text !== undefined) d.textContent = text;
    return d;
  }

  function nodeById(id) {
    for (var i = 0; i < script.nodes.length; i++) {
      if (script.nodes[i].id === id) return script.nodes[i];
    }
    return null;
  }

  // ---------------------------------------------------------------- 画面

  function buildShell() {
    mount.textContent = '';

    var term = el('div', 'term');
    var bar = el('div', 'term-bar');
    bar.appendChild(el('span', 'dot'));
    bar.appendChild(el('span', 'dot'));
    bar.appendChild(el('span', 'dot'));
    bar.appendChild(el('span', 'term-title', script.title));
    term.appendChild(bar);

    var body = el('div', 'term-body');
    body.appendChild(el('div', 'lines'));
    body.appendChild(el('div', 'actions'));
    term.appendChild(body);

    mount.appendChild(term);
  }

  /** 一行一行淡入。纯粹是气氛，跟装置没关系 */
  function renderLines(lines) {
    var box = mount.querySelector('.lines');
    box.textContent = '';
    lines.forEach(function (text, i) {
      var p = el('p', /^「/.test(text) ? 'quote' : '', text);
      p.style.animationDelay = i * 220 + 'ms';
      box.appendChild(p);
    });
  }

  function renderActions() {
    var box = mount.querySelector('.actions');
    box.textContent = '';
    var a = node.action || {};

    if (a.type === 'button') {
      box.appendChild(button(a.label || '继续', 'primary', function () {
        play(node.next);
      }));
    } else if (a.type === 'restart') {
      box.appendChild(button(a.label || '重新开始', 'primary', function () {
        ARGX.reset(); // 把装置也一起复位，不然上一局的灯还亮着
        play(script.start);
      }));
    } else if (a.type === 'choice') {
      (a.options || []).forEach(function (opt) {
        box.appendChild(button(opt.label, 'primary', function () {
          play(opt.next);
        }));
      });
    } else if (a.type === 'input') {
      var input = el('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', a.prompt || '输入');
      box.appendChild(input);

      function submit() {
        if (input.value.trim().toLowerCase() === String(a.answer).toLowerCase()) {
          play(node.next);
        } else {
          var box2 = mount.querySelector('.lines');
          var p = el('p', 'note', a.wrong || '没有反应。');
          p.style.animationDelay = '0ms';
          box2.appendChild(p);
          input.value = '';
          input.focus();
        }
      }

      box.appendChild(button('确认', 'primary', submit));

      // 输入型的幕也要能带出路。扉页那一幕就是：剧本说「再往后翻」，
      // 那就得真翻得动，不能只有"输对密码"一条路——否则照着提示走的玩家会卡死。
      (a.options || []).forEach(function (opt) {
        box.appendChild(button(opt.label, 'primary', function () {
          play(opt.next);
        }));
      });

      if (a.hint) {
        var hintBox = null;
        box.appendChild(button('看提示', '', function () {
          if (hintBox) {
            hintBox.remove();
            hintBox = null;
            return;
          }
          hintBox = el('p', 'note', a.hint);
          hintBox.style.width = '100%';
          box.appendChild(hintBox);
        }));
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submit();
      });
      setTimeout(function () {
        input.focus();
      }, 0);
    }
  }

  function button(label, cls, onClick) {
    var b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  // ---------------------------------------------------------------- 剧情推进

  /*
   * 走到一个节点：先让房间动一下，再把字打出来。
   *
   * 注意顺序——cue 是**先发**的。灯在字出来之前就开始暗，
   * 玩家会先感到不对，再读到那句"顶灯像是接触不良"，效果才成立。
   */
  function play(id) {
    node = nodeById(id);
    if (!node) return;

    (node.cues || []).forEach(function (c) {
      ARGX.fire(c.event); // 埋点就这一行
    });

    renderLines(node.lines || []);
    renderActions();
    updateFooter();
  }

  // ---------------------------------------------------------------- 装置状态

  function updateFooter() {
    var foot = mount.querySelector('.footer');
    if (!foot) return;
    var led = foot.querySelector('.led');
    var text = foot.querySelector('.device-text');
    var extra = foot.querySelector('.device-action');

    var status = ARGX.status();
    var live = status === 'ready' || status === 'active' || status === 'stale';
    led.className = 'led' + (live ? ' on' : '');

    if (live) {
      text.textContent = '装置已连上：' + (ARGX.device() || '未知') +
        (node ? ' · 本幕：' + node.title : '');
    } else if (status === 'connecting') {
      text.textContent = '正在连装置……';
    } else if (ARGX.mode() === 'mock') {
      // 这句很重要：让作者知道"没反应"是正常的，不是他埋点写错了
      text.textContent = '模拟模式：装置不会动，剧情照常';
    } else if (status === 'lost') {
      text.textContent = '装置断开了（剧情不受影响）';
    } else {
      text.textContent = '未连接装置（剧情不受影响）';
    }

    extra.textContent = '';
    if (ARGX.mode() === 'serial' && !live && !hostTransport()) {
      extra.appendChild(button('连接装置', '', function () {
        ARGX.connect(); // 必须是用户的真实点击，浏览器才让开串口
      }));
    }
  }

  function buildFooter() {
    var term = mount.querySelector('.term');
    var foot = el('div', 'footer');
    var dev = el('div', 'device');
    dev.appendChild(el('span', 'led'));
    dev.appendChild(el('span', 'device-text'));
    foot.appendChild(dev);
    foot.appendChild(el('div', 'device-action'));
    term.appendChild(foot);
  }

  // ---------------------------------------------------------------- 启动

  function boot() {
    // file:// 下串口被浏览器禁掉。给一句能照着做的话，而不是只说"不支持"
    var hint = ARGX.hint();
    if (hint) {
      hintEl.hidden = false;
      hintEl.textContent = hint;
    }

    fetch('script.json')
      .then(function (r) {
        if (!r.ok) throw new Error('读到 ' + r.status);
        return r.json();
      })
      .then(function (data) {
        script = data;

        // 剧本里自定义的事件注册进 SDK，之后就能照常 fire
        Object.keys(script.events || {}).forEach(function (name) {
          var ev = script.events[name];
          ARGX.defineEvent(name, ev.cues, { label: ev.label, desc: ev.desc });
        });

        buildShell();
        buildFooter();
        ARGX.on('status', updateFooter);
        ARGX.on('ready', updateFooter);
        ARGX.on('lost', updateFooter);
        play(script.start);
      })
      .catch(function (e) {
        mount.appendChild(
          el('p', 'note', '剧本没读出来（' + e.message + '）。用本地服务器打开这个页面，不要双击文件。')
        );
      });
  }

  // 宿主给的通道优先，其次交给 SDK 自己判断（能连真装置就真装置，否则模拟模式）
  var host = hostTransport();
  ARGX.init(host ? { transport: host } : {});

  boot();
})();
