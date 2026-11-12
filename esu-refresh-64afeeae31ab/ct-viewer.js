(() => {
  'use strict';
  const BASE = new URL('./', document.currentScript.src);
  const positions = {};
  let panel, image, range, previous, next, count, caption, status, retry;
  let selected = 'heart', active = false, version = 0, manifest, pending;
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'uk';
  const text = (uk, en) => lang() === 'en' ? en : uk;
  function mount() {
    if (panel) return;
    panel = document.getElementById('ct-view-2d');
    if (!panel) return;
    image = document.getElementById('an-ct-slice');
    range = document.getElementById('an-ct-range');
    previous = document.getElementById('an-ct-prev');
    next = document.getElementById('an-ct-next');
    count = document.getElementById('an-ct-count');
    caption = document.getElementById('an-ct-caption');
    status = document.getElementById('an-ct-status');
    retry = document.getElementById('an-ct-retry');
    range.addEventListener('input', () => { positions[selected] = Number(range.value); render(); });
    previous.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    retry.addEventListener('click', render);
  }
  function step(delta) {
    const files = manifest?.[selected]?.files;
    if (!files) return;
    positions[selected] = Math.max(0, Math.min(files.length - 1, positions[selected] + delta));
    render();
  }
  async function getManifest() {
    if (manifest) return manifest;
    if (!pending) {
      pending = fetch(new URL('ct-manifest.json', BASE)).then(response => {
        if (!response.ok) throw new Error('CT_MANIFEST_FAILED');
        return response.json();
      }).then(data => (manifest = data)).catch(error => { pending = null; throw error; });
    }
    return pending;
  }
  async function render() {
    if (!panel || !active) return;
    const ticket = ++version, organ = selected;
    image.hidden = true;
    panel.dataset.loadState = 'loading';
    panel.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    status.textContent = text('Завантаження КТ-зрізу…', 'Loading CT slice…');
    caption.textContent = '';
    range.disabled = previous.disabled = next.disabled = !manifest;
    try {
      const data = await getManifest();
      if (ticket !== version || !active) return;
      const study = data[organ];
      if (!study || !study.files?.length) throw new Error('CT_SERIES_MISSING');
      const index = positions[organ] ?? Math.floor(study.files.length / 2);
      positions[organ] = index;
      range.max = String(study.files.length - 1);
      range.value = String(index);
      range.disabled = false;
      previous.disabled = index === 0;
      next.disabled = index === study.files.length - 1;
      count.textContent = text('Зріз ', 'Slice ') + (index + 1) + ' / ' + study.files.length;
      range.setAttribute('aria-valuetext', count.textContent);
      const url = new URL(study.files[index].file, BASE).href;
      const loaded = new Image();
      await new Promise((resolve, reject) => { loaded.onload = resolve; loaded.onerror = reject; loaded.src = url; });
      if (ticket !== version || !active) return;
      image.src = url;
      image.alt = study[lang()] + ' · ' + count.textContent;
      image.dataset.organ = organ;
      image.hidden = false;
      caption.textContent = study[lang()];
      status.textContent = '';
      panel.dataset.loadState = 'ready';
      panel.setAttribute('aria-busy', 'false');
      // Cache only adjacent examples; a visitor need not download all four series.
      for (const near of [index - 1, index + 1]) {
        if (study.files[near]) new Image().src = new URL(study.files[near].file, BASE).href;
      }
    } catch {
      if (ticket !== version || !active) return;
      panel.dataset.loadState = 'error';
      panel.setAttribute('aria-busy', 'false');
      status.textContent = text('Не вдалося завантажити КТ-зріз.', 'The CT slice could not be loaded.');
      retry.hidden = false;
    }
  }
  function show(organ, value) {
    mount();
    if (!panel) return;
    const changed = selected !== organ || active !== value;
    selected = organ; active = value;
    if (!active) { ++version; return; }
    if (changed || panel.dataset.loadState !== 'ready' || image.lang !== lang()) {
      image.lang = lang(); render();
    }
  }
  window.EsuCT = { show };
})();
