'use strict';
(() => {
  let activeAlbum = document.body.dataset.album;
  const root = document.body.dataset.root || '.';
  let photos = [];
  const viewer = document.querySelector('.lightbox');
  const image = viewer.querySelector('img');
  const counter = document.querySelector('#photo-counter');
  let current = 0;
  let opener;
  const filmRefreshers = [];
  const refreshFilm = () => filmRefreshers.forEach(refresh => refresh());
  const pathFor = photo => root + '/' + photo.path.split('/').map(encodeURIComponent).join('/');
  const labelFor = (album, index) => ({landscape:'风景',portrait:'人像',nature:'花鸟',recent:'精选作品',single:'单人毕业照',double:'双人毕业照',more:'团体毕业照'}[album] || '摄影作品') + ' ' + (index + 1);
  function renderGallery(album, grid, status, section) {
  const items = window.PHOTO_MANIFEST?.[album] || [];
  items.forEach((photo, index) => {
    const figure = document.createElement('figure'); figure.className = 'photo';
    const link = document.createElement('a'); link.href = pathFor(photo);
    link.setAttribute('aria-label', '完整查看：' + labelFor(album, index));
    const thumb = document.createElement('img'); thumb.src = pathFor(photo);
    thumb.alt = labelFor(album, index); thumb.loading = 'lazy'; thumb.decoding = 'async';
    link.append(thumb); figure.append(link); grid.append(figure);
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof viewer.showModal !== 'function') return;
      event.preventDefault(); photos = items; activeAlbum = album; current = index; opener = link; showPhoto();
      viewer.showModal(); document.body.classList.add('viewer-open'); refreshFilm();
    });
  });
  status.textContent = items.length ? '' : '暂无作品，或图片清单未载入。';
  if (section) setupFilm(section, grid, items);
  }

  function showPhoto() {
    image.src = pathFor(photos[current]); image.alt = labelFor(activeAlbum, current);
    counter.textContent = (current + 1) + ' / ' + photos.length;
  }
  function step(delta) { if (!photos.length) return; current = (current + delta + photos.length) % photos.length; showPhoto(); }
  viewer.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  viewer.querySelector('[data-next]').addEventListener('click', () => step(1));
  viewer.querySelector('[data-close]').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => { document.body.classList.remove('viewer-open'); opener?.focus(); refreshFilm(); });
  let touchStart;
  const stage = viewer.querySelector('.lightbox-stage');
  stage.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? {x:event.touches[0].clientX, y:event.touches[0].clientY} : null;
  }, {passive:true});
  stage.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    touchStart = null;
  }, {passive:true});
  stage.addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
  });

  function setupFilm(section, grid, items) {
    const controls = section.querySelector('.film-controls');
    const pause = controls.querySelector('[data-film-pause]');
    const frames = [...grid.children];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let userPaused = reducedMotion.matches;
    let hovered = false, focused = false, visible = true, timer;
    controls.hidden = items.length < 2;
    function canPlay() {
      return frames.length > 1 && grid.scrollWidth > grid.clientWidth + 2 && !userPaused && !reducedMotion.matches &&
        !hovered && !focused && visible && !document.hidden && !viewer.open;
    }
    function refresh() {
      clearTimeout(timer);
      const fits = grid.scrollWidth <= grid.clientWidth + 2;
      controls.querySelector('[data-film-prev]').disabled = fits;
      controls.querySelector('[data-film-next]').disabled = fits;
      pause.disabled = fits || reducedMotion.matches;
      pause.textContent = userPaused || reducedMotion.matches ? '播放' : '暂停';
      pause.setAttribute('aria-pressed', String(userPaused || reducedMotion.matches));
      if (reducedMotion.matches) pause.setAttribute('title', '设备已开启减少动态效果，使用左右按钮浏览');
      else pause.removeAttribute('title');
      if (canPlay()) timer = setTimeout(() => { advance(1); refresh(); }, 5000);
    }
    function advance(direction) {
      const origin = frames[0]?.offsetLeft || 0;
      const positions = frames.map(frame => frame.offsetLeft - origin);
      const max = Math.max(0, grid.scrollWidth - grid.clientWidth);
      const left = grid.scrollLeft;
      let target;
      if (direction > 0) target = left >= max - 2 ? 0 : Math.min(positions.find(x => x > left + 2) ?? max, max);
      else target = left <= 2 ? max : [...positions].reverse().find(x => x < left - 2) ?? 0;
      grid.scrollTo({left:target, behavior:reducedMotion.matches || (direction > 0 && target === 0) ? 'instant' : 'smooth'});
    }
    function manualStep(direction) { userPaused = true; advance(direction); refresh(); }
    controls.querySelector('[data-film-prev]').addEventListener('click', () => manualStep(-1));
    controls.querySelector('[data-film-next]').addEventListener('click', () => manualStep(1));
    pause.addEventListener('click', () => { userPaused = !userPaused; refresh(); });
    grid.addEventListener('mouseenter', () => { hovered = true; refresh(); });
    grid.addEventListener('mouseleave', () => { hovered = false; refresh(); });
    section.addEventListener('focusin', () => { focused = true; refresh(); });
    section.addEventListener('focusout', event => { focused = section.contains(event.relatedTarget); refresh(); });
    grid.addEventListener('pointerdown', event => { if (event.pointerType === 'touch' || event.pointerType === 'pen') {userPaused = true; refresh();} });
    grid.addEventListener('wheel', () => {userPaused = true; refresh();}, {passive:true});
    document.addEventListener('visibilitychange', refresh);
    reducedMotion.addEventListener('change', refresh);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; refresh();});
      observer.observe(grid);
    }
    filmRefreshers.push(refresh);
    window.addEventListener('resize', refresh);
    grid.querySelectorAll('img').forEach(img => img.addEventListener('load', refresh));
    refresh();
  }
  const sections = [...document.querySelectorAll('[data-gallery]')];
  if (sections.length) sections.forEach(section => renderGallery(
    section.dataset.gallery, section.querySelector('[data-photo-grid]'), section.querySelector('[data-gallery-status]'), section
  ));
  else {
    const grid = document.querySelector('#photo-grid');
    const status = document.querySelector('#gallery-status');
    if (grid && status) renderGallery(activeAlbum, grid, status);
  }
})();
