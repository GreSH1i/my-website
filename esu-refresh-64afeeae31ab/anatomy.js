(() => {
  'use strict';
  const BASE = new URL('./', document.currentScript.src);
  const names = {
    heart: { uk: 'Серце', en: 'Heart' }, brain: { uk: 'Мозок', en: 'Brain' },
    lungs: { uk: 'Легені', en: 'Lungs' }, vessels: { uk: 'Судини', en: 'Vessels' }
  };
  const ids = Object.keys(names);
  let selected = names[document.documentElement.dataset.initialOrgan] ? document.documentElement.dataset.initialOrgan : 'heart';
  let displayed = null, loading = null, mounted = false;
  let renderer, scene, camera, controls, current, loader;
  let visible = false, scheduled = false, requestVersion = 0;
  const cache = new Map();
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'uk';
  const stage = () => document.getElementById('ctModelStage');
  const is3D = () => stage()?.dataset.mode === '3d';
  const status = text => { document.getElementById('an-load-status').textContent = text; };
  function refreshLabels() {
    const english = lang() === 'en';
    const dragHint = document.querySelector('.ct-drag-hint');
    if (dragHint) dragHint.hidden = selected === 'heart';
    const viewStatus = document.getElementById('ctViewStatus');
    if (viewStatus) viewStatus.textContent = (is3D() ? '3D · ' : '2D · ') + names[selected][lang()];
    document.querySelectorAll('[data-organ]').forEach(button => {
      const active = button.dataset.organ === selected;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    stage()?.setAttribute('aria-labelledby', 'an-tab-' + selected);
    const canvas = document.getElementById('ct-3d-canvas');
    canvas?.setAttribute('aria-label', (english ? 'Interactive 3D anatomical model: ' : 'Інтерактивна анатомічна 3D-модель: ') + names[selected][lang()]);
    const help = document.querySelector('#an-viewer-help span');
    if(help) {
      const uk = is3D() ? 'Перетягніть модель або скористайтеся кнопками. Стрілки — обертання, + / − — масштаб.' : 'Рухайте повзунок або натискайте ‹ / ›, щоб переглядати приклади зрізів.';
      const en = is3D() ? 'Drag the model or use the controls. Arrow keys rotate; + / − zoom.' : 'Move the slider or use ‹ / › to browse example slices.';
      help.dataset.langUa = uk; help.dataset.langEn = en; help.textContent = english ? en : uk;
    }
    if (loading && is3D()) status(english ? 'Loading model…' : 'Завантаження моделі…');
  }
  function requestRender() {
    if (!mounted || !renderer || scheduled || !visible || !is3D() || document.hidden) return;
    scheduled = true;
    requestAnimationFrame(() => {
      const moving = controls.update();
      renderer.render(scene, camera);
      scheduled = false;
      if (moving) requestRender();
    });
  }
  function resize() {
    if (!renderer) return;
    const rect = stage().getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    requestRender();
  }
  function resetView() {
    if (!camera || !controls) return;
    camera.position.set(0, 0, 6.3);
    controls.target.set(0, 0, 0);
    if (current) current.rotation.set(0, selected === 'heart' ? -1.06 : selected === 'brain' ? 0.7 : -0.12, 0);
    controls.update();
    requestRender();
  }
  function styleModel(object, id) {
    const materials = new Map();
    object.traverse(node => {
      if (!node.isMesh) return;
      node.frustumCulled = true;
      function adapt(source) {
        if (materials.has(source)) return materials.get(source);
        const material = source.clone();
        const name = (source.name || '').toLowerCase();
        if (source.map) {
          material.roughness = Math.max(0.38, Math.min(0.68, source.roughness));
          material.metalness = 0;
          material.side = THREE.DoubleSide;
          if(id==='brain')material.color.setRGB(1,.75,.72);
          materials.set(source, material);
          return material;
        }
        material.roughness = 0.55;
        material.metalness = 0.03;
        material.side = THREE.DoubleSide;
        if (id === 'heart') { material.color.setHex(0xce8d86); material.roughness = .6; }
        if (id === 'brain' && !name.includes('retina')) material.color.setHex(0xbc8f9d);
        if (id === 'lungs' && name.includes('lung_mat')) {
          material.color.setHex(0x5899c6);
          material.transparent = true;
          material.opacity = 0.13;
          material.depthWrite = false;
        }
        if (name.includes('artery')) material.color.setHex(0xc84359);
        if (name.includes('vein')) material.color.setHex(0x397db7);
        if (id === 'lungs' && !name.includes('lung_mat')) material.color.setHex(0xd46663);
        if (id === 'vessels') {material.color.setHex(0xb83d48); material.roughness=0.42;}
        material.color.convertSRGBToLinear();
        materials.set(source, material);
        return material;
      }
      node.material = Array.isArray(node.material) ? node.material.map(adapt) : adapt(node.material);
    });
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(longest) || longest <= 0) throw new Error('EMPTY_MODEL');
    object.position.sub(center);
    const group = new THREE.Group();
    group.add(object);
    group.scale.setScalar((id === 'heart' ? 3.4 : 3.55) / longest);
    if (id === 'heart') group.position.y = .3;
    group.rotation.y = -0.12;
    if(id==='lungs'&&window.EsuAnatomyDetails)return window.EsuAnatomyDetails.lungs(group);
    if(id==='vessels'&&window.EsuAnatomyDetails)return window.EsuAnatomyDetails.vessels(group);
    return group;
  }
  function loadOnce(id) {
    if (!cache.has(id)) {
      const promise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MODEL_TIMEOUT')), 18000);
        loader.load(new URL(id + '.glb', BASE).href, gltf => {
          clearTimeout(timeout);
          try { resolve(styleModel(gltf.scene, id)); } catch (error) { reject(error); }
        }, undefined, () => { clearTimeout(timeout); reject(new Error('MODEL_LOAD_FAILED')); });
      }).catch(error => { cache.delete(id); throw error; });
      cache.set(id, promise);
    }
    return cache.get(id);
  }
  async function loadSelected() {
    const id = selected;

    if (!mounted || !loader || !visible || !is3D() || loading === id) return;
    if (displayed === id && current) {
      current.visible = true;
      const canvas = document.getElementById('ct-3d-canvas');
      canvas.dataset.organ = id;
      canvas.dataset.loadState = 'ready';
      canvas.setAttribute('aria-busy', 'false');
      document.getElementById('an-retry').hidden = true;
      document.querySelectorAll('[data-an-action]').forEach(button => { button.disabled = false; });
      status('');
      requestRender();
      return;
    }
    const version = ++requestVersion;
    loading = id;
    const canvas = document.getElementById('ct-3d-canvas');
    canvas.dataset.loadState = 'loading';
    canvas.setAttribute('aria-busy', 'true');
    document.getElementById('an-retry').hidden = true;
    document.querySelectorAll('[data-an-action]').forEach(button => { button.disabled = true; });
    if (current) current.visible = false;
    refreshLabels();
    requestRender();
    try {
      const model = await loadOnce(id);
      if (version !== requestVersion || selected !== id) return;
      if (current) scene.remove(current);
      current = model;
      current.visible = true;
      scene.add(current);
      displayed = id;
      loading = null;
      canvas.dataset.organ = id;
      canvas.dataset.loadState = 'ready';
      canvas.setAttribute('aria-busy', 'false');
      status('');
      document.querySelectorAll('[data-an-action]').forEach(button => { button.disabled = false; });
      resetView();
      resize();
    } catch {
      if (version !== requestVersion || selected !== id) return;
      loading = null;
      canvas.dataset.loadState = 'error';
      canvas.setAttribute('aria-busy', 'false');
      status(lang() === 'en' ? 'The model could not be loaded.' : 'Не вдалося завантажити модель.');
      document.getElementById('an-retry').hidden = false;
    }
  }
  function select(id) {
    if (!names[id]) return;
    if (selected !== id) {
      selected = id;
      ++requestVersion;
      loading = null;
    }
    refresh();
  }
  function action(kind) {
    if (!current || !renderer || loading) return;
    if (kind === 'left') current.rotation.y -= Math.PI / 10;
    if (kind === 'right') current.rotation.y += Math.PI / 10;
    if (kind === 'zoom-in' || kind === 'zoom-out') {
      const distance = camera.position.distanceTo(controls.target);
      const next = Math.min(10, Math.max(2.8, distance * (kind === 'zoom-in' ? 0.84 : 1.19)));
      camera.position.sub(controls.target).multiplyScalar(next / distance).add(controls.target);
    }
    if (kind === 'reset') resetView();
    controls.update();
    requestRender();
  }
  function mount() {
    if (mounted) return;
    mounted = true;
    const canvas = document.getElementById('ct-3d-canvas');
    bindControls(canvas);
    try {
      if (!window.THREE || !THREE.GLTFLoader || !THREE.DRACOLoader || !THREE.OrbitControls) throw new Error('VIEWER_UNAVAILABLE');
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.setClearColor(0, 0);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.set(0, 0, 6.3);
      controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.minDistance = 2.8;
      controls.maxDistance = 10;
      controls.rotateSpeed = 0.7;
      controls.minPolarAngle = 0.12;
      controls.maxPolarAngle = Math.PI - 0.12;
      controls.addEventListener('change', requestRender);
      const key = new THREE.DirectionalLight(0xffe9e1, 1.2);
      key.position.set(3, 4, 5); scene.add(key);
      const rim = new THREE.DirectionalLight(0x85d7ff, 1.0);
      rim.position.set(-4, 1, -2); scene.add(rim);
      const fill = new THREE.DirectionalLight(0x94b9de, 0.45);
      fill.position.set(-3, -1, 4); scene.add(fill);
      scene.add(new THREE.AmbientLight(0xc2d6ea, 0.25));
      const draco = new THREE.DRACOLoader();
      draco.setDecoderPath(new URL('vendor/', BASE).href);
      draco.setWorkerLimit(2);
      loader = new THREE.GLTFLoader();
      loader.setDRACOLoader(draco);
      window.ct3dResize = resize;
      new ResizeObserver(resize).observe(stage());
      new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) { loadSelected(); requestRender(); } }, { rootMargin: '100px' }).observe(stage());
      document.addEventListener('visibilitychange', requestRender);
      resize();
    } catch {
      status(lang() === 'en' ? '3D view is unavailable in this browser. Try the 2D view.' : '3D-перегляд недоступний у цьому браузері. Спробуйте режим 2D.');
      canvas.dataset.loadState = 'error';
    }
    refresh();
  }
  function bindControls(canvas) {
    document.querySelectorAll('[data-organ]').forEach(button => {
        button.addEventListener('click', () => select(button.dataset.organ));
        button.addEventListener('keydown', event => {
          let index = ids.indexOf(button.dataset.organ);
          if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
          event.preventDefault();
          if (event.key === 'Home') index = 0;
          else if (event.key === 'End') index = ids.length - 1;
          else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
          select(ids[index]);
          document.getElementById('an-tab-' + ids[index]).focus();
        });
      });
      document.querySelectorAll('[data-an-action]').forEach(button => button.addEventListener('click', () => action(button.dataset.anAction)));
      canvas.addEventListener('keydown', event => {
        const mapped = {ArrowLeft:'left',ArrowRight:'right','+':'zoom-in','=':'zoom-in','-':'zoom-out','0':'reset'}[event.key];
        if (mapped) { event.preventDefault(); action(mapped); }
      });
      document.getElementById('an-retry').addEventListener('click', () => {
        loading = null; loadSelected();
      });
      new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  function refresh() {
    refreshLabels();
    if(mounted && window.EsuCT)window.EsuCT.show(selected, !is3D());
    if (mounted && is3D()) { loadSelected(); requestRender(); }
  }
  window.EsuAnatomy = { mount, select, refresh };
})();
