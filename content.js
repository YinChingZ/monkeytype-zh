(() => {
  if (document.getElementById('mt-zh-extension')) return;
  let settings = MTZH.clean();
  let frame = 0, current = '', revision = 0;
  const originals = new WeakMap();
  const cache = new Map();
  const host = document.createElement('div');
  host.id = 'mt-zh-extension';
  host.style.cssText = 'all:initial;position:fixed;z-index:10000;pointer-events:none;display:none';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host { color-scheme:light dark }
    .card { box-sizing:border-box; width:100%; padding:12px 18px; border-radius:12px;
      position:relative; isolation:isolate; color:var(--zh-text); border:1px solid transparent;
      font:16px/1.55 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }
    .card::before { content:""; position:absolute; inset:0; border-radius:inherit;
      background:var(--zh-bg); opacity:var(--zh-opacity); z-index:-1 }
    .head { display:flex; align-items:baseline; gap:12px; overflow:hidden; white-space:nowrap }
    .word { color:var(--zh-accent); font-weight:650; overflow:hidden; text-overflow:ellipsis }
    .sound { color:var(--zh-muted); font-size:13px; overflow:hidden; text-overflow:ellipsis }
    .label { margin-left:auto; font-size:10px; opacity:.55; flex-shrink:0; letter-spacing:1px }
    .meaning { white-space:pre-line; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3;
      -webkit-box-orient:vertical; margin-top:4px; overflow-wrap:anywhere }
    .base { font-size:11px; opacity:.6 }
  </style><div class="card"><div class="head"><span class="word"></span><span class="sound"></span><span class="label">中文释义 · 离线</span></div><div class="meaning"></div><div class="base"></div></div>`;
  const el = selector => shadow.querySelector(selector);
  document.body.append(host);
  function normalize(raw) {
    return raw.toLowerCase().replace(/[’‘]/g,"'").replace(/^[^a-z]+|[^a-z]+$/g,'');
  }
  function readWord(word) {
    if (originals.has(word)) return originals.get(word);
    const letters = [...word.querySelectorAll('letter:not(.extra):not(.dead)')];
    const raw = letters.length ? letters.map(letter => letter.textContent).join('') : word.textContent;
    const text = normalize(raw || '');
    if (text) originals.set(word, text);
    return text;
  }
  function showEntry(result) {
    const entry = result.entry;
    el('.meaning').textContent = result.error || (entry ? entry[0] : '本地词典暂无此词释义');
    el('.sound').textContent = settings.phonetic && entry?.[1] ? `/${entry[1]}/` : '';
    el('.base').textContent = entry?.[2] ? `词形来源：${entry[2]}` : '';
  }
  function visible(element) {
    return element && element.getClientRects().length > 0 &&
      (element.checkVisibility ? element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) : getComputedStyle(element).visibility !== 'hidden');
  }
  function hide() {
    host.style.display = 'none';
    if (current) { current = ''; revision++; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const colorContext = canvas.getContext('2d', {willReadFrequently:true});
  function luminance(color) {
    colorContext.clearRect(0,0,1,1);
    colorContext.fillStyle = color;
    colorContext.fillRect(0,0,1,1);
    const rgb = [...colorContext.getImageData(0,0,1,1).data].slice(0,3).map(v => {
      v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    });
    return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
  }
  function contrast(a,b) {
    const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  }
  let appearanceKey = '';
  function applyAppearance(words) {
    const source = getComputedStyle(words);
    const cssColor = (key,fallback) => {
      const v=source.getPropertyValue(key).trim();
      return v && CSS.supports('color',v) ? v : fallback;
    };
    const dark = {bg:'#2c2e31',text:'#eeeeea',accent:'#f2d34f',muted:'#b5b7bc',page:'#323437'};
    const light = {bg:'#f5f4ef',text:'#282a30',accent:'#785e00',muted:'#595d66',page:'#ffffff'};
    const palette = settings.theme==='light' ? {...light} : {...dark};
    if (settings.theme==='follow') Object.assign(palette,{
      bg:cssColor('--sub-alt-color',dark.bg),text:cssColor('--text-color',dark.text),
      accent:cssColor('--main-color',dark.accent),muted:cssColor('--sub-color',dark.muted),page:cssColor('--bg-color',dark.page)
    });
    const fonts = {follow:source.fontFamily,system:'system-ui, -apple-system',serif:'Georgia, "Songti SC", serif',mono:'ui-monospace, "SFMono-Regular", monospace'};
    const size = settings.sizeMode==='follow' ? Math.max(12,Math.min(48,parseFloat(source.fontSize)||18)) : settings.fontSize;
    const key=JSON.stringify([palette,fonts[settings.fontFamily],size,settings]);
    if (key===appearanceKey) return;
    appearanceKey=key;
    const effectiveBg=settings.background && settings.backgroundOpacity>=50 ? palette.bg : palette.page;
    const fallback=contrast('#ffffff',effectiveBg)>contrast('#17191c',effectiveBg)?'#ffffff':'#17191c';
    for (const name of ['text','accent','muted']) if (contrast(palette[name],effectiveBg)<4.5) palette[name]=fallback;
    for (const name of ['bg','text','accent','muted']) host.style.setProperty('--zh-'+name,palette[name]);
    host.style.setProperty('--zh-opacity', settings.background ? settings.backgroundOpacity/100 : 0);
    const card=el('.card');
    card.style.fontFamily=fonts[settings.fontFamily]+', "PingFang SC", "Microsoft YaHei", sans-serif';
    card.style.borderColor=settings.border?palette.muted:'transparent';
    card.style.boxShadow=settings.shadow?'0 6px 20px #0002':'none';
    el('.meaning').style.fontSize=size+'px';
    el('.meaning').style.webkitLineClamp=settings.maxLines;
  }
  function update() {
    frame = 0;
    const words = document.querySelector('#words');
    const active = words?.querySelector('.word.active');
    const area = document.querySelector('#wordsWrapper') || words;
    if (!settings.enabled || !visible(active) || !visible(area)) { hide(); return; }
    // Cache the original prompt before optional typing effects replace its letters.
    const word = readWord(active);
    if (word !== current) words.querySelectorAll('.word:not(.typed)').forEach(readWord);
    if (!/^[a-z]+(?:['-][a-z]+)*$/.test(word)) { hide(); return; }
    if (observedArea !== area) {
      resizeObserver.disconnect();
      resizeObserver.observe(area);
      observedArea = area;
    }
    const rect = area.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) { hide(); return; }
    host.style.display = 'block';
    const width=Math.max(0,Math.min(settings.width,innerWidth-24));
    host.style.width=width+'px';
    applyAppearance(words);
    if (word !== current) {
      current = word;
      const ticket = ++revision;
      el('.word').textContent = word;
      el('.sound').textContent = '';
      el('.base').textContent = '';
      el('.meaning').textContent = '正在加载释义…';
      if (cache.has(word)) showEntry(cache.get(word));
      else chrome.runtime.sendMessage({ type:'lookup', word }).then(result => {
        if (!result) throw new Error('empty response');
        if (!result.error) cache.set(word, result);
        if (ticket === revision) { showEntry(result); schedule(); }
      }).catch(() => {
        if (ticket === revision) { showEntry({error:'扩展已更新或连接中断，请刷新页面'}); schedule(); }
      });
    } else if (cache.has(word)) showEntry(cache.get(word));
    const height = host.getBoundingClientRect().height;
    const fixed = settings.position==='top' || settings.position==='bottom';
    const anchor=fixed?{left:12,right:innerWidth-12,width:innerWidth-24}:rect;
    let left=settings.align==='center'?anchor.left+(anchor.width-width)/2:settings.align==='right'?anchor.right-width:anchor.left;
    let top;
    if (settings.position==='top') top=12+settings.gap;
    else if (settings.position==='bottom') top=innerHeight-height-12-settings.gap;
    else if (settings.position==='above') {
      top=rect.top-height-settings.gap;
      if (top<8) top=rect.bottom+settings.gap;
    } else {
      top=rect.bottom+settings.gap;
      if (top+height>innerHeight-8) top=rect.top-height-settings.gap;
    }
    host.style.left=Math.max(12,Math.min(innerWidth-width-12,left+settings.offsetX))+'px';
    host.style.top=Math.max(8,Math.min(innerHeight-height-8,top+settings.offsetY))+'px';
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  let observedArea = null;
  const resizeObserver = new ResizeObserver(schedule);
  const observer = new MutationObserver(records => {
    if (records.some(record => record.target !== host)) schedule();
  });
  observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class','style','hidden'] });
  // CSS/WAAPI animations can finish without a DOM mutation. Recheck at low
  // frequency so a temporary opacity:0 can never leave the panel hidden.
  setInterval(() => { if (settings.enabled && !document.hidden) schedule(); }, 500);
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('transitionend', schedule, true);
  document.addEventListener('animationend', schedule, true);
  document.fonts?.addEventListener('loadingdone', schedule);
  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('scroll', schedule, {passive:true, capture:true});
  chrome.storage.local.get(settings).then(value => { settings = MTZH.clean(value); schedule(); }).catch(schedule);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const key of Object.keys(settings)) if (changes[key]) settings[key] = changes[key].newValue;
    settings=MTZH.clean(settings);
    schedule();
  });
  schedule();
})();
