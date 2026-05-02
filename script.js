/* ── Global Constants & State ── */
const MAX_X  = 22;
const MAX_Y  = 14;
const LERP   = 0.07;

/* ─────────────────────────────────────────────────────────────────
   WORKER_URL: Cloudflare Worker를 배포한 뒤 아래 빈 문자열을
   실제 URL로 교체하세요.
   예) const WORKER_URL = 'https://lenticular-share.yourname.workers.dev';
──────────────────────────────────────────────────────────────────── */
const WORKER_URL = '';

/* ── Drawing Editor Logic ── */
const drawingModal = document.getElementById('drawingModal');
const drawingBoard = document.getElementById('drawingBoard');
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');
const penColor = document.getElementById('penColor');
const penSize = document.getElementById('penSize');
const penType = document.getElementById('penType');
const clearBtn = document.getElementById('clearCanvasBtn');
const cancelBtn = document.getElementById('cancelDrawBtn');
const saveBtn = document.getElementById('saveDrawBtn');

let isDrawing = false; let currentBgImage = null; let onSaveCallback = null;
let currentDrawW = 300, currentDrawH = 400;

function openDrawingEditor(imgObj, isLandscape, callback) {
  onSaveCallback = callback;
  currentDrawW = isLandscape ? 400 : 300; currentDrawH = isLandscape ? 300 : 400;
  drawCanvas.width = currentDrawW; drawCanvas.height = currentDrawH;
  if (isLandscape) drawingBoard.classList.add('landscape'); else drawingBoard.classList.remove('landscape');
  drawCtx.clearRect(0, 0, currentDrawW, currentDrawH);

  const scale = Math.max(currentDrawW / imgObj.naturalWidth, currentDrawH / imgObj.naturalHeight);
  const w = imgObj.naturalWidth * scale; const h = imgObj.naturalHeight * scale;
  drawCtx.drawImage(imgObj, (currentDrawW - w) / 2, (currentDrawH - h) / 2, w, h);

  currentBgImage = drawCtx.getImageData(0, 0, currentDrawW, currentDrawH);
  drawingModal.classList.add('show');
}

function closeDrawingEditor() { drawingModal.classList.remove('show'); }

function applyPenStyle() {
  drawCtx.strokeStyle = penColor.value; drawCtx.lineWidth = penSize.value; drawCtx.lineCap = 'round'; drawCtx.lineJoin = 'round';
  if (penType.value === 'marker') { drawCtx.globalAlpha = 0.4; drawCtx.shadowBlur = 0; }
  else if (penType.value === 'neon') { drawCtx.globalAlpha = 1.0; drawCtx.shadowBlur = 15; drawCtx.shadowColor = penColor.value; }
  else { drawCtx.globalAlpha = 1.0; drawCtx.shadowBlur = 0; }
}

drawCanvas.addEventListener('mousedown', (e) => { isDrawing = true; applyPenStyle(); drawCtx.beginPath(); drawCtx.moveTo(e.offsetX, e.offsetY); });
drawCanvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; drawCtx.lineTo(e.offsetX, e.offsetY); drawCtx.stroke(); });
window.addEventListener('mouseup', () => { isDrawing = false; });
clearBtn.addEventListener('click', () => { if (currentBgImage) drawCtx.putImageData(currentBgImage, 0, 0); });
cancelBtn.addEventListener('click', closeDrawingEditor);
saveBtn.addEventListener('click', () => {
  drawCtx.globalAlpha = 1.0; drawCtx.shadowBlur = 0;
  const newImageUrl = drawCanvas.toDataURL('image/png');
  if (onSaveCallback) onSaveCallback(newImageUrl);
  closeDrawingEditor();
});

/* ── Lenticular Class ── */
class LenticularCard {
  constructor(workspaceNode, onImageUpdate) {
    this.workspace = workspaceNode; this.onImageUpdate = onImageUpdate;
    this.isLandscape = false; this.width = 300; this.height = 400;

    this.card    = this.workspace.querySelector('.card');
    this.canvas  = this.workspace.querySelector('.canvas');
    this.gloss   = this.workspace.querySelector('.gloss');
    this.idle    = this.workspace.querySelector('.idle');
    this.hint    = this.workspace.querySelector('.stage-hint');
    this.shareBtn = this.workspace.querySelector('.share-trigger-btn');
    this.saveBtn  = this.workspace.querySelector('.save-trigger-btn');
    this.dz1     = this.workspace.querySelector('.dz1');
    this.dz2     = this.workspace.querySelector('.dz2');
    this.file1   = this.workspace.querySelector('.file1');
    this.file2   = this.workspace.querySelector('.file2');
    this.thumb1  = this.workspace.querySelector('.thumb1');
    this.thumb2  = this.workspace.querySelector('.thumb2');
    this.editBtn1 = this.workspace.querySelector('.edit-btn1');
    this.editBtn2 = this.workspace.querySelector('.edit-btn2');
    this.ratioBtns = this.workspace.querySelectorAll('.ratio-btn');

    this.ctx = this.canvas.getContext('2d');
    this.updateCanvasSize();
    this.img1 = null; this.img2 = null;
    this.curX = 0; this.curY = 0; this.tgtX = 0; this.tgtY = 0; this.hovering = false;

    this.initEvents(); this.tick = this.tick.bind(this); requestAnimationFrame(this.tick);
  }

  updateCanvasSize() {
    this.width = this.isLandscape ? 400 : 300; this.height = this.isLandscape ? 300 : 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width  = this.width * dpr; this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.render((this.curX + MAX_X) / (MAX_X * 2));
  }

  setRatio(mode) {
    this.isLandscape = (mode === 'landscape');
    if(this.isLandscape) this.card.classList.add('landscape'); else this.card.classList.remove('landscape');
    this.ratioBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.ratio === mode));
    this.updateCanvasSize();
    if (this.onImageUpdate && (this.img1 || this.img2)) this.onImageUpdate(this.thumb1.src, this.isLandscape);
  }

  drawCover(img) {
    const scale = Math.max(this.width / img.naturalWidth, this.height / img.naturalHeight);
    const w = img.naturalWidth * scale; const h = img.naturalHeight * scale;
    this.ctx.drawImage(img, (this.width - w) / 2, (this.height - h) / 2, w, h);
  }

  render(progress) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (!this.img1 && !this.img2) return;
    const p = Math.max(0, Math.min(1, progress));
    if (this.img1 && p < 1) { this.ctx.globalAlpha = 1 - p; this.drawCover(this.img1); }
    if (this.img2 && p > 0) { this.ctx.globalAlpha = p; this.drawCover(this.img2); }
    this.ctx.globalAlpha = 1.0;
  }

  tick() {
    this.curX += (this.tgtX - this.curX) * LERP; this.curY += (this.tgtY - this.curY) * LERP;
    const scale = this.hovering ? 1.045 : 1;
    this.card.style.transform = `rotateX(${this.curY}deg) rotateY(${this.curX}deg) scale(${scale})`;
    const gx = 50 + (this.curX / MAX_X) * 28; const gy = 50 - (this.curY / MAX_Y) * 28;
    this.gloss.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 38%, transparent 65%)`;
    this.render((this.curX + MAX_X) / (MAX_X * 2));
    requestAnimationFrame(this.tick);
  }

  /* ── GIF 저장 ── */
  saveAsGif() {
    if (!this.img1 && !this.img2) {
      showToast('먼저 이미지를 업로드해주세요');
      return;
    }
    if (typeof GIF === 'undefined') {
      showToast('GIF 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도하세요.');
      return;
    }

    const btn = this.saveBtn;
    btn.disabled = true;
    btn.textContent = '생성 중…';

    const W = this.width;
    const H = this.height;
    const img1 = this.img1;
    const img2 = this.img2;

    const offscreen = document.createElement('canvas');
    offscreen.width = W; offscreen.height = H;
    const octx = offscreen.getContext('2d');

    function drawCoverOff(img) {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * s; const h = img.naturalHeight * s;
      octx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: W,
      height: H,
      workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
    });

    const FRAMES = 30;
    const DELAY  = 60; // ms

    for (let i = 0; i < FRAMES; i++) {
      // 0 → 1 → 0 부드러운 코사인 왕복
      const progress = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FRAMES);
      const p = Math.max(0, Math.min(1, progress));

      octx.clearRect(0, 0, W, H);
      if (img1 && p < 1) { octx.globalAlpha = 1 - p; drawCoverOff(img1); }
      if (img2 && p > 0) { octx.globalAlpha = p;     drawCoverOff(img2); }
      octx.globalAlpha = 1.0;

      gif.addFrame(octx, { delay: DELAY, copy: true });
    }

    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lenticular-card.gif';
      a.click();
      URL.revokeObjectURL(url);
      btn.disabled = false;
      btn.textContent = '⬇ 저장';
      showToast('✅ GIF 저장 완료!');
    });

    gif.on('error', () => {
      btn.disabled = false;
      btn.textContent = '⬇ 저장';
      showToast('❌ GIF 생성 중 오류가 발생했습니다');
    });

    gif.render();
  }

  initEvents() {
    this.card.addEventListener('mouseenter', () => { this.hovering = true; });
    this.card.addEventListener('mouseleave', () => { this.hovering = false; this.tgtX = 0; this.tgtY = 0; });
    this.card.addEventListener('mousemove', (e) => {
      const r = this.card.getBoundingClientRect();
      this.tgtX = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * MAX_X;
      this.tgtY = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -MAX_Y;
    });

    this.setupDrop(this.dz1, this.file1, 1); this.setupDrop(this.dz2, this.file2, 2);
    this.editBtn1.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (this.img1) openDrawingEditor(this.img1, this.isLandscape, (url) => this.loadFromUrl(url, 1)); });
    this.editBtn2.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (this.img2) openDrawingEditor(this.img2, this.isLandscape, (url) => this.loadFromUrl(url, 2)); });
    this.ratioBtns.forEach(btn => btn.addEventListener('click', () => this.setRatio(btn.dataset.ratio)));

    this.shareBtn.addEventListener('click', () => {
      openShareModal(this.img1, this.img2, this.isLandscape);
    });

    this.saveBtn.addEventListener('click', () => this.saveAsGif());
  }

  onImageReady() { if (this.img1 || this.img2) { this.idle.classList.add('gone'); this.hint.classList.add('show'); } }
  loadFile(file, num) { if (!file || !file.type.startsWith('image/')) return; this.loadFromUrl(URL.createObjectURL(file), num); }
  loadFromUrl(url, num) {
    const el = new Image();
    el.onload = () => {
      if (num === 1) this.img1 = el; else this.img2 = el;
      const thumb = num === 1 ? this.thumb1 : this.thumb2;
      thumb.src = url; thumb.classList.add('show');
      const dz = num === 1 ? this.dz1 : this.dz2; dz.classList.add('filled');
      if ((num === 1) || (num === 2 && !this.img1)) { if (this.onImageUpdate) this.onImageUpdate(url, this.isLandscape); }
      this.onImageReady();
    };
    el.src = url;
  }
  setupDrop(dz, input, num) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); this.loadFile(e.dataTransfer.files[0], num); });
    input.addEventListener('change', () => this.loadFile(input.files[0], num));
  }
}

/* ── 공유 유틸리티 ── */

/**
 * HTMLImageElement를 지정 크기의 canvas에 cover로 그린 뒤 PNG Blob 반환
 * @param {HTMLImageElement} imgEl
 * @param {number} w
 * @param {number} h
 * @returns {Promise<Blob>}
 */
function imageToBlob(imgEl, w, h) {
  return new Promise((resolve, reject) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const s = Math.max(w / imgEl.naturalWidth, h / imgEl.naturalHeight);
    const sw = imgEl.naturalWidth * s; const sh = imgEl.naturalHeight * s;
    ctx.drawImage(imgEl, (w - sw) / 2, (h - sh) / 2, sw, sh);
    c.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
  });
}

/**
 * 두 이미지를 Worker로 전송하고 공유 URL을 반환
 * @returns {Promise<string>} 공유 URL
 */
async function sendToWorker(img1, img2, message, isLandscape, w, h) {
  const form = new FormData();
  form.append('img1', await imageToBlob(img1, w, h), 'img1.png');
  if (img2) form.append('img2', await imageToBlob(img2, w, h), 'img2.png');
  form.append('message', message || '');
  form.append('isLandscape', String(isLandscape));

  const res = await fetch(WORKER_URL + '/api/share', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Worker responded ${res.status}`);
  const { uuid } = await res.json();
  return `${location.origin}/share/${uuid}`;
}

/* ── Animated Share Modal Logic ── */
const shareModal = document.getElementById('shareModal');
const closeShareBtn = document.getElementById('closeShareBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const sendShareBtn = document.getElementById('sendShareBtn');
const toast = document.getElementById('toast');

const shareCanvas = document.getElementById('shareCanvas');
const shareCtx = shareCanvas.getContext('2d');
const sharePreviewCard = document.getElementById('sharePreviewCard');
const shareGloss = document.getElementById('shareGloss');
const shareMsgInput = document.querySelector('.share-msg-input');

let shareImg1 = null, shareImg2 = null;
let shareW = 180, shareH = 240;
let shareIsLandscape = false;
let isSharePlaying = false;
let shareAnimationId = null;

function openShareModal(img1, img2, isLandscape) {
  shareImg1 = img1; shareImg2 = img2;
  shareIsLandscape = isLandscape;
  shareW = isLandscape ? 240 : 180;
  shareH = isLandscape ? 180 : 240;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  shareCanvas.width = shareW * dpr;
  shareCanvas.height = shareH * dpr;
  shareCtx.scale(dpr, dpr);

  if (isLandscape) sharePreviewCard.classList.add('landscape');
  else sharePreviewCard.classList.remove('landscape');

  shareModal.classList.add('show');

  isSharePlaying = true;
  playShareAnimation();
}

function closeShareModal() {
  shareModal.classList.remove('show');
  isSharePlaying = false;
  if (shareAnimationId) cancelAnimationFrame(shareAnimationId);
}

function drawShareCover(img) {
  const scale = Math.max(shareW / img.naturalWidth, shareH / img.naturalHeight);
  const w = img.naturalWidth * scale; const h = img.naturalHeight * scale;
  shareCtx.drawImage(img, (shareW - w) / 2, (shareH - h) / 2, w, h);
}

function renderShareCanvas(progress) {
  shareCtx.clearRect(0, 0, shareW, shareH);
  if (!shareImg1 && !shareImg2) return;
  const p = Math.max(0, Math.min(1, progress));
  if (shareImg1 && p < 1) { shareCtx.globalAlpha = 1 - p; drawShareCover(shareImg1); }
  if (shareImg2 && p > 0) { shareCtx.globalAlpha = p; drawShareCover(shareImg2); }
  shareCtx.globalAlpha = 1.0;
}

function playShareAnimation() {
  if (!isSharePlaying) return;

  const time = Date.now() / 800;
  const sineVal = Math.sin(time);

  const tiltX = sineVal * 18;
  const tiltY = Math.cos(time * 0.5) * 5;

  sharePreviewCard.style.transform = `rotateX(${tiltY}deg) rotateY(${tiltX}deg)`;

  const gx = 50 + (tiltX / 18) * 30;
  const gy = 50 - (tiltY / 5) * 30;
  shareGloss.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.2) 0%, transparent 65%)`;

  const progress = (sineVal + 1) / 2;
  renderShareCanvas(progress);

  shareAnimationId = requestAnimationFrame(playShareAnimation);
}

function showToast(msg) {
  toast.innerText = msg; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

closeShareBtn.addEventListener('click', closeShareModal);

/* 링크 복사 */
copyLinkBtn.addEventListener('click', async () => {
  if (!shareImg1) { showToast('업로드된 이미지가 없습니다'); return; }
  if (!WORKER_URL) {
    showToast('⚠️ WORKER_URL을 script.js에 설정해주세요');
    return;
  }
  const msg = shareMsgInput?.value || '';
  copyLinkBtn.disabled = true;
  copyLinkBtn.textContent = '업로드 중…';
  try {
    const link = await sendToWorker(shareImg1, shareImg2, msg, shareIsLandscape, shareW, shareH);
    await navigator.clipboard.writeText(link);
    showToast('🔗 링크가 클립보드에 복사되었습니다!');
    closeShareModal();
  } catch (e) {
    console.error(e);
    showToast('❌ 공유 중 오류가 발생했습니다');
  } finally {
    copyLinkBtn.disabled = false;
    copyLinkBtn.textContent = '🔗 링크 복사';
  }
});

/* 전송하기 (Web Share API → fallback: clipboard) */
sendShareBtn.addEventListener('click', async () => {
  if (!shareImg1) { showToast('업로드된 이미지가 없습니다'); return; }
  if (!WORKER_URL) {
    showToast('⚠️ WORKER_URL을 script.js에 설정해주세요');
    return;
  }
  const msg = shareMsgInput?.value || '';
  sendShareBtn.disabled = true;
  sendShareBtn.textContent = '전송 중…';
  try {
    const link = await sendToWorker(shareImg1, shareImg2, msg, shareIsLandscape, shareW, shareH);
    if (navigator.share) {
      await navigator.share({ title: 'Lenticular Card', text: msg, url: link });
    } else {
      await navigator.clipboard.writeText(link);
      showToast('🔗 링크가 클립보드에 복사되었습니다!');
    }
    closeShareModal();
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error(e);
      showToast('❌ 공유 중 오류가 발생했습니다');
    }
  } finally {
    sendShareBtn.disabled = false;
    sendShareBtn.textContent = '전송하기';
  }
});

/* ── App State & Initialization ── */
const historyList = document.getElementById('historyList');
const activeWorkspace = document.getElementById('activeWorkspace');
const template = document.getElementById('cardSetTemplate');
const addSetBtn = document.getElementById('addSetBtn');

let cardSets = []; let setIdCounter = 0;

function createNewCardSet() {
  const id = ++setIdCounter;
  const clone = template.content.cloneNode(true);
  const workspaceNode = clone.querySelector('.workspace');
  activeWorkspace.appendChild(workspaceNode);

  const thumbNode = document.createElement('div');
  thumbNode.className = 'history-item';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'history-title'; titleSpan.innerText = `Set ${id}`;
  thumbNode.appendChild(titleSpan);

  const deleteBtn = document.createElement('div');
  deleteBtn.className = 'delete-set-btn'; deleteBtn.innerText = '✕';
  deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteCardSet(id); });
  thumbNode.appendChild(deleteBtn);
  thumbNode.addEventListener('click', () => switchActiveSet(id));
  historyList.prepend(thumbNode);

  const instance = new LenticularCard(workspaceNode, (imgUrl, isLandscape) => {
    thumbNode.style.backgroundImage = `url(${imgUrl})`;
    titleSpan.style.display = 'none';
    if(isLandscape) thumbNode.classList.add('landscape');
    else thumbNode.classList.remove('landscape');
  });

  cardSets.push({ id, workspaceNode, thumbNode, instance });
  switchActiveSet(id);
}

function deleteCardSet(targetId) {
  const index = cardSets.findIndex(set => set.id === targetId);
  if (index === -1) return;
  const setToDelete = cardSets[index];
  const wasActive = setToDelete.workspaceNode.classList.contains('active');
  setToDelete.workspaceNode.remove(); setToDelete.thumbNode.remove();
  cardSets.splice(index, 1);
  if (wasActive) {
    if (cardSets.length > 0) switchActiveSet(cardSets[cardSets.length - 1].id);
    else createNewCardSet();
  }
}

function switchActiveSet(targetId) {
  cardSets.forEach(set => {
    if (set.id === targetId) { set.workspaceNode.classList.add('active'); set.thumbNode.classList.add('active'); }
    else { set.workspaceNode.classList.remove('active'); set.thumbNode.classList.remove('active'); }
  });
}

createNewCardSet();
addSetBtn.addEventListener('click', createNewCardSet);
