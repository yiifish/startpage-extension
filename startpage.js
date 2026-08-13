
(function(){
  /* ================= 搜索引擎 =================
     baidu / google 为常规搜索；doubao / deepseek 为网页版 AI，
     输入内容后回车直接跳转到对应网页版（空内容则打开首页）。 */
  var ENGINES = {
    baidu:    { name:'百度',    color:'#de1d20', build:function(q){ return 'https://www.baidu.com/s?wd=' + encodeURIComponent(q); } },
    google:   { name:'Google',  color:'#4285f4', build:function(q){ return 'https://www.google.com/search?q=' + encodeURIComponent(q); } },
    doubao:   { name:'豆包',    color:'#6c5ce7', build:function(q){ return q ? 'https://www.doubao.com/chat/?q=' + encodeURIComponent(q) : 'https://www.doubao.com/chat/'; } },
    deepseek: { name:'DeepSeek',color:'#4d6bfe', build:function(q){ return q ? 'https://chat.deepseek.com/?q=' + encodeURIComponent(q) : 'https://chat.deepseek.com/'; } }
  };

  /* ================= 默认收藏（可自行修改） ================= */
  var DEFAULT_BOOKMARKS = [
    { name:'DeepSeek Harness', url:'dsh://start' },
    { name:'GitHub',      url:'https://github.com' },
    { name:'哔哩哔哩',     url:'https://www.bilibili.com' },
    { name:'知乎',        url:'https://www.zhihu.com' },
    { name:'掘金',        url:'https://juejin.cn' },
    { name:'V2EX',       url:'https://www.v2ex.com' },
    { name:'网易云音乐',   url:'https://music.163.com' },
    { name:'少数派',      url:'https://sspai.com' },
    { name:'百度翻译',     url:'https://fanyi.baidu.com' }
  ];

  var KEY_ENGINE = 'sp.engine';
  var KEY_BOOKMARKS = 'sp.bookmarks';

  /* ================= 状态 ================= */
  var engine = localStorage.getItem(KEY_ENGINE) || 'baidu';
  if (!ENGINES[engine]) engine = 'baidu';
  var bookmarks;
  try { bookmarks = JSON.parse(localStorage.getItem(KEY_BOOKMARKS) || ''); } catch(e){ bookmarks = null; }
  if (!Array.isArray(bookmarks)) bookmarks = DEFAULT_BOOKMARKS.slice();

  /* 确保「启动 DeepSeek Harness」收藏存在，并指向 dsh:// 自动启动协议（固定在第一位） */
  var harnessRe = /127\.0\.0\.1:3080|^dsh:\/\//i;
  var hIdx = -1;
  bookmarks.forEach(function(b, i){ if (hIdx < 0 && harnessRe.test(b.url)) hIdx = i; });
  if (hIdx >= 0){
    if (bookmarks[hIdx].url !== 'dsh://start'){
      bookmarks[hIdx].url = 'dsh://start';
      localStorage.setItem(KEY_BOOKMARKS, JSON.stringify(bookmarks));
    }
  } else {
    bookmarks.unshift({ name:'DeepSeek Harness', url:'dsh://start', icon:'' });
    localStorage.setItem(KEY_BOOKMARKS, JSON.stringify(bookmarks));
  }

  var $ = function(id){ return document.getElementById(id); };
  var engineMenu = $('engineMenu'),
      searchArea = $('searchArea'),
      engineBtn  = $('engineBtn'),
      clockEl    = $('clock'),
      dateEl     = $('date'),
      form       = $('searchForm'),
      input      = $('searchInput'),
      box        = $('bookmarks'),
      mask       = $('modalMask'),
      mName      = $('mName'),
      mUrl       = $('mUrl'),
      mIcon      = $('mIcon'),
      mOk        = $('mOk'),
      mCancel    = $('mCancel');

  var editingIndex = null;

  /* ================= Harness 运行状态检测 ================= */
  var harnessDots = [];
  function setHarnessState(up){
    harnessDots.forEach(function(d){
      d.classList.remove('checking');
      d.classList.toggle('running', up);
      d.title = up
        ? 'DeepSeek Harness 运行中 · 点击优雅停止'
        : 'DeepSeek Harness 未运行 · 点击启动';
    });
  }
  function checkHarness(){
    harnessDots.forEach(function(d){
      d.classList.add('checking');
      d.classList.remove('running');
    });
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 2000);
    fetch('http://127.0.0.1:3080/', { mode:'no-cors', cache:'no-store', signal:ctrl.signal })
      .then(function(){ clearTimeout(timer); setHarnessState(true); })
      .catch(function(){ clearTimeout(timer); setHarnessState(false); });
  }

  function saveBookmarks(){ localStorage.setItem(KEY_BOOKMARKS, JSON.stringify(bookmarks)); }

  /* 名称 -> 稳定色相（用于柔和渐变图标） */
  function hueFor(s){
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  function initialFor(s){
    var t = (s || '').trim();
    return t ? Array.from(t)[0].toUpperCase() : '?';
  }

  /* ================= 渲染：引擎选择菜单 ================= */
  function renderEngines(){
    engineMenu.innerHTML = '';
    Object.keys(ENGINES).forEach(function(k, i){
      var o = document.createElement('button');
      o.type = 'button';
      o.className = 'engine-option' + (k === engine ? ' active' : '');
      o.setAttribute('role', 'menuitem');
      o.title = 'Alt+' + (i + 1) + ' 切换';

      var dot = document.createElement('span');
      dot.className = 'eo-dot';
      dot.style.background = ENGINES[k].color;

      var name = document.createElement('span');
      name.className = 'eo-name';
      name.textContent = ENGINES[k].name;

      var check = document.createElement('span');
      check.className = 'eo-check';
      check.textContent = '\u2713';

      o.appendChild(dot);
      o.appendChild(name);
      o.appendChild(check);

      o.addEventListener('click', function(){
        setEngine(k, true);
        searchArea.classList.remove('show');
      });
      engineMenu.appendChild(o);
    });

    var hint = document.createElement('div');
    hint.className = 'menu-hint';
    hint.textContent = 'Alt + 1~4 快捷切换';
    engineMenu.appendChild(hint);
  }

  /* 切换搜索引擎并同步界面 */
  function setEngine(k, refocus){
    engine = k;
    localStorage.setItem(KEY_ENGINE, k);
    renderEngines();
    engineBtn.textContent = initialFor(ENGINES[k].name);
    /* 圆钮弹跳动画 */
    engineBtn.classList.remove('pop');
    void engineBtn.offsetWidth;
    engineBtn.classList.add('pop');
    input.placeholder = (k === 'doubao' || k === 'deepseek')
      ? '输入问题，回车打开' + ENGINES[k].name
      : '输入关键词，回车搜索';
    if (refocus) input.focus();
  }

  /* ================= 渲染：收藏栏 ================= */
  function bookmarkEl(b, i){
    var a = document.createElement('a');
    a.className = 'bookmark';
    a.href = b.url;
    a.target = '_blank';
    a.rel = 'noopener';
    var isHarness = /127\.0\.0\.1:3080|^dsh:\/\//i.test(b.url);
    if (isHarness) a.classList.add('managed');
    a.title = isHarness ? 'DeepSeek Harness（点击启动服务）' : b.name;

    var ico = document.createElement('div');
    ico.className = 'b-icon';
    var icon = (b.icon || '').trim();
    if (/^https?:\/\//i.test(icon)){
      var img = document.createElement('img');
      img.src = icon;
      img.alt = '';
      img.onerror = function(){
        ico.textContent = initialFor(b.name);
        ico.style.background = 'linear-gradient(135deg,hsl(' + hueFor(b.name) + ',65%,96%),hsl(' + hueFor(b.name) + ',65%,88%))';
        ico.style.color = 'hsl(' + hueFor(b.name) + ',38%,30%)';
      };
      ico.appendChild(img);
    } else {
      ico.textContent = icon || initialFor(b.name);
      if (isHarness){
        ico.classList.add('harness');
      } else {
        ico.style.background = 'linear-gradient(135deg,hsl(' + hueFor(b.name) + ',65%,96%),hsl(' + hueFor(b.name) + ',65%,88%))';
        ico.style.color = 'hsl(' + hueFor(b.name) + ',38%,30%)';
      }
    }

    var name = document.createElement('span');
    name.className = 'b-name';
    name.textContent = b.name;

    if (isHarness){
      /* 运行状态指示灯：绿点点击 = 优雅关闭；灰点点击 = 启动 */
      var dot = document.createElement('span');
      dot.className = 'b-dot';
      dot.title = 'DeepSeek Harness 状态检测中…';
      dot.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        if (dot.classList.contains('running')){
          if (confirm('停止 DeepSeek Harness？（发送 Ctrl+C 优雅收尾，稍后可随时重新启动）')){
            window.location.href = 'dsh://stop';
          }
        } else {
          window.location.href = 'dsh://start';
        }
      });
      harnessDots.push(dot);
      a.appendChild(dot);
    } else {
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'b-del';
      del.textContent = '\u00d7';
      del.title = '删除';
      del.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        if (confirm('删除收藏「' + b.name + '」？')){
          bookmarks.splice(i, 1);
          saveBookmarks();
          renderBookmarks();
        }
      });
      a.appendChild(del);

      /* 右键编辑 */
      a.addEventListener('contextmenu', function(e){
        e.preventDefault();
        openModal(i);
      });
    }

    a.appendChild(ico);
    a.appendChild(name);
    return a;
  }

  function renderBookmarks(){
    box.innerHTML = '';
    bookmarks.forEach(function(b, i){ box.appendChild(bookmarkEl(b, i)); });

    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'bookmark b-add';
    add.title = '添加收藏';
    var addIco = document.createElement('div');
    addIco.className = 'b-icon';
    addIco.textContent = '+';
    add.appendChild(addIco);
    add.addEventListener('click', function(){ openModal(null); });
    box.appendChild(add);
  }

  /* ================= 弹窗 ================= */
  function openModal(index){
    editingIndex = index;
    var b = (index === null) ? null : bookmarks[index];
    $('modalTitle').textContent = b ? '编辑收藏' : '添加收藏';
    mName.value = b ? b.name : '';
    mUrl.value  = b ? b.url  : '';
    mIcon.value = b ? (b.icon || '') : '';
    mask.hidden = false;
    mName.focus();
  }
  function closeModal(){ mask.hidden = true; }

  function saveModal(){
    var name = mName.value.trim();
    var url  = mUrl.value.trim();
    var icon = mIcon.value.trim();
    if (!name){ mName.focus(); return; }
    if (!/^https?:\/\//i.test(url)){ mUrl.focus(); return; }
    var item = { name:name, url:url, icon:icon };
    if (editingIndex === null) bookmarks.push(item);
    else bookmarks[editingIndex] = item;
    saveBookmarks();
    renderBookmarks();
    closeModal();
  }

  /* ================= 事件 ================= */
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var q = input.value.trim();
    var url = ENGINES[engine].build(q);
    if (e.ctrlKey || e.metaKey) window.open(url, '_blank');
    else window.location.href = url;
  });

  /* 引擎圆钮：点击显示/隐藏引擎菜单 */
  engineBtn.addEventListener('click', function(e){
    e.stopPropagation();
    searchArea.classList.toggle('show');
  });

  /* 点击搜索区域外收起引擎菜单 */
  document.addEventListener('click', function(e){
    if (!searchArea.contains(e.target)) searchArea.classList.remove('show');
  });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){
      if (!mask.hidden) closeModal();
      if (searchArea.classList.contains('show')) searchArea.classList.remove('show');
      return;
    }
    /* Alt+1~4 快捷切换搜索引擎 */
    if (e.altKey && e.key >= '1' && e.key <= '4'){
      var keys = Object.keys(ENGINES);
      var idx = parseInt(e.key, 10) - 1;
      if (keys[idx]){
        e.preventDefault();
        setEngine(keys[idx], false);
        searchArea.classList.remove('show');
      }
    }
  });
  [mName, mUrl, mIcon].forEach(function(el){
    el.addEventListener('keydown', function(e){ if (e.key === 'Enter') saveModal(); });
  });
  mOk.addEventListener('click', saveModal);
  mCancel.addEventListener('click', closeModal);
  mask.addEventListener('click', function(e){ if (e.target === mask) closeModal(); });

  /* ================= 初始化 ================= */
  renderEngines();
  renderBookmarks();
  checkHarness();
  setInterval(checkHarness, 8000);

  /* 时钟 */
  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function updateClock(){
    var d = new Date();
    clockEl.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var week = ['日','一','二','三','四','五','六'];
    dateEl.textContent = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + week[d.getDay()];
  }
  updateClock();
  setInterval(updateClock, 1000);

  engineBtn.textContent = initialFor(ENGINES[engine].name);
  input.placeholder = (engine === 'doubao' || engine === 'deepseek')
    ? '输入问题，回车打开' + ENGINES[engine].name
    : '输入关键词，回车搜索';
  input.focus();
})();

