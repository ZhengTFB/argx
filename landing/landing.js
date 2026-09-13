/* ============================================================
   ARGX 官网首页 —— 交互
   ------------------------------------------------------------
   只有四件事：开场动画、进入视口揭示、导航吸附、代码卡复制。
   这份页面没有数据、没有路由、没有状态，所以**不引入框架、不引入构建**。

   prefers-reduced-motion 判断做了两遍：CSS 里一遍（全局兜底），
   这里再一遍（否则 JS 那侧仍会把开场动画跑一遍）。
   ============================================================ */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     一、首屏揭示
     ============================================================ */
  var revealed = false;
  function startReveal() {
    if (revealed) return;
    revealed = true;

    // 首屏元素依次揭示（带错峰）
    var heroItems = $$('.hero .reveal');
    heroItems.forEach(function (el, i) {
      if (reduce) { el.classList.add('on'); return; }
      setTimeout(function () { el.classList.add('on'); }, i * 90);
    });

    // 后面各区块进入视口才揭示，只播一次
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    $$('.section .reveal, .footer .reveal').forEach(function (el) { io.observe(el); });
  }

  /* ============================================================
     二、开场动画层
     ------------------------------------------------------------
     ★ 关键：判定与揭屏在**首帧内同步执行**，不依赖任何异步回调。
       - 不播放 → 立刻 el.remove() + startReveal() + body.ready
       - 播放   → 立刻 body.intro-open + 显形 + 排定时器
     只要有一个分支漏掉揭屏，非首访时页面元素就会永久停在不可见状态。
     ============================================================ */
  var SEEN_KEY = 'argx.intro.seen';

  /* 时间轴（02-页面线框 §1.3）：首词 420ms / 词间 1050ms / 词内逐字 105ms / 末词后停留 1100ms */
  var WORD_LEAD = 420;
  var WORD_GAP = 1050;
  var CHAR_GAP = 105;
  var WORD_IN = 780;
  var HOLD_AFTER_LAST = 1100;

  (function intro() {
    var el = $('#intro');
    var skip = $('#introSkip');

    function markSeen() {
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 隐私模式下写不了，无所谓 */ }
    }

    var seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) { seen = true; }

    /* —— 不播放：同步移出场，立即揭屏 —— */
    if (reduce || seen || !el) {
      if (el) el.remove();
      startReveal();
      document.body.classList.add('ready');
      return;
    }

    /* —— 播放：标记开场态、锁滚动（同样在首帧内完成，无闪烁）—— */
    document.body.classList.add('intro-open');
    el.hidden = false;

    var words = $$('.intro-word', el);
    var timers = [];
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      markSeen();
      document.body.classList.remove('intro-open');
      el.classList.add('done');
      // 层淡出之后才揭屏；给一个保底，别让定时器出问题时页面回不来
      setTimeout(function () {
        if (el.parentNode) el.remove();
        startReveal();
        document.body.classList.add('ready');
      }, 680);
    }

    words.forEach(function (w, i) {
      timers.push(setTimeout(function () {
        // 上一个词原地淡出（不是变灰留在视野里），中心始终只有一个词
        if (i > 0) words[i - 1].classList.add('past');
        w.classList.add('on');
      }, WORD_LEAD + i * WORD_GAP));

      $$('.ch', w).forEach(function (c, ci) {
        c.style.transitionDelay = (ci * CHAR_GAP) + 'ms';
      });
    });

    var TOTAL = WORD_LEAD + (words.length - 1) * WORD_GAP + WORD_IN + HOLD_AFTER_LAST;
    timers.push(setTimeout(finish, TOTAL));

    // 保底：万一上面哪一环出问题，也不能让页面永远停在不可见。
    // ★ 必须排在整段动画**之后**，不能在首帧就动手 ——
    //   首帧就揭屏会顺带解掉 body.intro-open，把滚动锁和首屏错峰揭示一起废掉，
    //   开场层就成了纯摆设（design/prototype/index.html 里就是这个写法，是个真 bug）。
    timers.push(setTimeout(function () {
      if (document.body.classList.contains('ready')) return; // 正常走完了，什么都不用做
      forceVisible();
    }, TOTAL + 2000));

    // 跳过：按钮 / ESC / 点击层任意处
    if (skip) skip.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
    el.addEventListener('click', finish);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { finish(); document.removeEventListener('keydown', onEsc); }
    });
  })();

  /* ============================================================
     三、顶部导航吸附
     ============================================================ */
  var nav = $('#nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* 导航里的锚点：平滑滚动（reduced-motion 下直接跳） */
  $$('[data-scroll]').forEach(function (el) {
    el.addEventListener('click', function () {
      var target = $(el.getAttribute('data-scroll'));
      if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ============================================================
     四、代码卡：两个 tab + 复制
     两份内容都是真的 —— 一份是 npm 装包，一份是把 sdk/argx.js 拖进项目，
     因为这个 SDK 本来就是零依赖单文件（sdk/README.md 讲的正是这两种接法）。
     ============================================================ */
  var SOURCES = {
    quickstart: {
      name: 'argx-quickstart',
      lines: [
        { p: '$', c: 'npm install @argx/sdk' },
        { p: '$', c: 'npx argx link' },
        { p: '›', c: '// 网页发一行 JSON，设备就执行', gap: true },
        { p: '›', c: 'argx.cue({ light: { to: 0, fade: 2000 } })' }
      ],
      copy: 'npm install @argx/sdk\nnpx argx link\nargx.cue({ light: { to: 0, fade: 2000 } })'
    },
    source: {
      name: 'argx-zero-dep',
      lines: [
        { p: '$', c: 'cp sdk/argx.js your-project/' },
        { p: '›', c: '// 零依赖，单文件，直接 script 引进来就行', gap: true },
        { p: '›', c: '<script src="argx.js"></script>' },
        { p: '›', c: 'ARGX.fire(\'reveal\')' }
      ],
      copy: '<script src="argx.js"></script>\nARGX.fire(\'reveal\')'
    }
  };

  var current = 'quickstart';
  var tail = $('#termLines');
  var termName = $('#termName');

  function renderSource(key) {
    var src = SOURCES[key];
    if (!src || !tail) return;
    current = key;
    if (termName) termName.textContent = src.name;
    tail.innerHTML = src.lines.map(function (l) {
      return '<div class="term-line' + (l.gap ? ' gap' : '') + '">' +
        '<span class="prompt">' + l.p + '</span>' +
        '<span class="' + (l.p === '$' ? 'cmd' : 'cmt') + '">' + l.c + '</span>' +
        '</div>';
    }).join('');
  }

  $$('.code-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('.code-tab').forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('act', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      renderSource(tab.getAttribute('data-tab'));
    });
  });

  var copyBtn = $('#copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = (SOURCES[current] || {}).copy || '';
      var done = function () {
        copyBtn.textContent = '已复制';
        setTimeout(function () { copyBtn.textContent = '复制'; }, 1400);
      };
      // 剪贴板在 file:// 与无权限环境下会失败 —— 失败就静默恢复，绝不弹窗
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { /* 忽略 */ });
          return;
        }
      } catch (e) { /* 落到下面的降级 */ }
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) { /* 复制不了不是错误，什么都不做 */ }
    });
  }

  /* ============================================================
     五、保底：任何异常都不该让页面留在「不可见」状态
     ------------------------------------------------------------
     只在开场动画超时未收尾时才被调用（见 intro 里那个 TOTAL + 2000 的定时器）。
     这里不主动 requestAnimationFrame 调它 —— 那样等于在首帧就揭屏，
     把开场动画、滚动锁、首屏错峰揭示一起废掉。
     ============================================================ */
  function forceVisible() {
    var el = $('#intro');
    if (el) el.remove();
    document.body.classList.remove('intro-open');
    document.body.classList.add('ready');
    startReveal();
    $$('.reveal').forEach(function (n) { n.classList.add('on'); });
  }
})();
