/* ── Global Constants & State ── */
const MAX_X  = 22;
const MAX_Y  = 14;
const LERP   = 0.07;

// 💡 GIF 렌더링용 Worker 파일 우회 로딩 (CORS 보안 에러 방지)
let gifWorkerBlobUrl = null;
fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js')
  .then(res => res.text())
  .then(text => {
    const blob = new Blob([text], { type: 'application/javascript' });
    gifWorkerBlobUrl = URL.createObjectURL(blob);
  }).catch(e => console.error("GIF Worker 로드 실패", e));

let isGlobalMotionEnabled = false;
let globalTargetX = 0; let globalTargetY = 0;

function requestMotionPermission(btn) {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(permissionState => {
      if (permissionState === 'granted') enableGlobalMotion(btn);
    }).catch(console.error);
  } else {
    enableGlobalMotion(btn);
  }
}

function enableGlobalMotion(btn) {
  isGlobalMotionEnabled = true;
  btn.innerText = "✓ 센서 켜짐";
  btn.classList.add('active');
  window.addEventListener('deviceorientation', (e) => {
    const gamma = Math.min(Math.max(e.gamma, -45), 45); 
    const beta = Math.min(Math.max(e.beta - 45, -45), 45); 
    globalTargetX = (gamma / 45) * MAX_X; 
    globalTargetY = (beta / 45) * -MAX_Y;
  });
}

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
  const isMobile = window.innerWidth <= 768;
  if(isMobile) { currentDrawW = isLandscape ? 280 : 280; currentDrawH = isLandscape ? 210 : 373; } 
  else { currentDrawW = isLandscape ? 400 : 300; currentDrawH = isLandscape ? 300 : 400; }

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
function getPointerPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}
drawCanvas.addEventListener('mousedown', (e) => { isDrawing = true; applyPenStyle(); drawCtx.beginPath(); const pos = getPointerPos(e); drawCtx.moveTo(pos.x, pos.y); });
drawCanvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; const pos = getPointerPos(e); drawCtx.lineTo(pos.x, pos.y); drawCtx.stroke(); });
window.addEventListener('mouseup', () => { isDrawing = false; });
drawCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); isDrawing = true; applyPenStyle(); drawCtx.beginPath(); const pos = getPointerPos(e); drawCtx.moveTo(pos.x, pos.y); }, {passive: false});
drawCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (!isDrawing) return; const pos = getPointerPos(e); drawCtx.lineTo(pos.x, pos.y); drawCtx.stroke(); }, {passive: false});
window.addEventListener('touchend', () => { isDrawing = false; });
clearBtn.addEventListener('click', () => { if (currentBgImage) drawCtx.putImageData(currentBgImage, 0, 0); });
cancelBtn.addEventListener('click', closeDrawingEditor);
saveBtn.addEventListener('click', () => {
  drawCtx.globalAlpha = 1.0; drawCtx.shadowBlur = 0;
  if (onSaveCallback) onSaveCallback(drawCanvas.toDataURL('image/png'));
  closeDrawingEditor();
});

/* ── Lenticular Class ── */
class LenticularCard {
  constructor(workspaceNode, onImageUpdate) {
    this.workspace = workspaceNode; this.onImageUpdate = onImageUpdate; 
    this.isLandscape = false; this.width = 300; this.height = 400;
    this.card   = this.workspace.querySelector('.card'); this.canvas = this.workspace.querySelector('.canvas');
    this.gloss  = this.workspace.querySelector('.gloss'); this.idle   = this.workspace.querySelector('.idle');
    this.hint   = this.workspace.querySelector('.stage-hint'); 
    
    this.shareBtn = this.workspace.querySelector('.share-trigger-btn');
    this.saveGifBtn = this.workspace.querySelector('.save-gif-btn'); // 💡 저장 버튼 바인딩
    this.motionBtn = this.workspace.querySelector('.workspace-motion-btn'); 
    
    this.dz1    = this.workspace.querySelector('.dz1'); this.dz2    = this.workspace.querySelector('.dz2');
    this.file1  = this.workspace.querySelector('.file1'); this.file2  = this.workspace.querySelector('.file2');
    this.thumb1 = this.workspace.querySelector('.thumb1'); this.thumb2 = this.workspace.querySelector('.thumb2');
    this.editBtn1 = this.workspace.querySelector('.edit-btn1'); this.editBtn2 = this.workspace.querySelector('.edit-btn2');
    this.ratioBtns = this.workspace.querySelectorAll('.ratio-btn');

    this.ctx = this.canvas.getContext('2d');
    this.updateCanvasSize();
    this.img1 = null; this.img2 = null;
    this.curX = 0; this.curY = 0; this.tgtX = 0; this.tgtY = 0; this.hovering = false;

    this.initEvents(); this.tick = this.tick.bind(this); requestAnimationFrame(this.tick);
  }
  updateCanvasSize() {
    const isMobile = window.innerWidth <= 768;
    if(isMobile) { this.width = this.isLandscape ? 340 : 280; this.height = this.isLandscape ? 255 : 373; } 
    else { this.width = this.isLandscape ? 400 : 300; this.height = this.isLandscape ? 300 : 400; }
    
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
  drawCover(ctx, img, w_area, h_area) {
    const scale = Math.max(w_area / img.naturalWidth, h_area / img.naturalHeight);
    const w = img.naturalWidth * scale; const h = img.naturalHeight * scale;
    ctx.drawImage(img, (w_area - w) / 2, (h_area - h) / 2, w, h);
  }
  render(progress) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (!this.img1 && !this.img2) return;
    const p = Math.max(0, Math.min(1, progress));
    if (this.img1 && p < 1) { this.ctx.globalAlpha = 1 - p; this.drawCover(this.ctx, this.img1, this.width, this.height); }
    if (this.img2 && p > 0) { this.ctx.globalAlpha = p; this.drawCover(this.ctx, this.img2, this.width, this.height); }
    this.ctx.globalAlpha = 1.0;
  }
  tick() {
    if (isGlobalMotionEnabled) { this.tgtX = globalTargetX; this.tgtY = globalTargetY; }
    this.curX += (this.tgtX - this.curX) * LERP; this.curY += (this.tgtY - this.curY) * LERP;
    const scale = this.hovering && !isGlobalMotionEnabled ? 1.045 : 1;
    this.card.style.transform = `rotateX(${this.curY}deg) rotateY(${this.curX}deg) scale(${scale})`;
    const gx = 50 + (this.curX / MAX_X) * 28; const gy = 50 - (this.curY / MAX_Y) * 28;
    this.gloss.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 38%, transparent 65%)`;
    this.render((this.curX + MAX_X) / (MAX_X * 2));
    requestAnimationFrame(this.tick);
  }

  // 💡 GIF 다운로드 생성 핵심 로직
  async generateAndDownloadGIF() {
    if (!gifWorkerBlobUrl) {
      showToast("로딩 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!this.img1 && !this.img2) {
      showToast("먼저 이미지를 업로드해주세요.");
      return;
    }
    showToast("렌티큘러 굽는 중... (약 5초 소요) ⏳\n화면을 유지해주세요!");

    const W = this.width, H = this.height;
    const gif = new GIF({ workers: 2, quality: 10, width: W, height: H, workerScript: gifWorkerBlobUrl });

    // ── 중간 캔버스: 이미지 블렌딩 결과물 ──────────────────────────
    const compCanvas = document.createElement('canvas');
    compCanvas.width = W; compCanvas.height = H;
    const cCtx = compCanvas.getContext('2d');

    // ── 최종 프레임 캔버스 ──────────────────────────────────────────
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = W; tempCanvas.height = H;
    const tCtx = tempCanvas.getContext('2d');

    const FRAMES      = 36;   // 프레임 수 (1 사이클)
    const STRIPS      = 80;   // 수직 스트립 수 (많을수록 부드러운 원근감)
    const PERSPECTIVE = 900;  // 원근 거리 px — 낮을수록 왜곡 강함 (CSS perspective 값과 동일 개념)
    const MAX_TILT    = 52;   // 최대 회전각 (°) — 크게 잡아야 3D 회전이 명확하게 보임

    for (let i = 0; i < FRAMES; i++) {
      const time    = (i / FRAMES) * Math.PI * 2;
      const sineVal = Math.sin(time);            // -1 ~ +1
      const p       = (sineVal + 1) / 2;         // 이미지 교체 비율 (0=img1, 1=img2)
      const tiltDeg = sineVal * MAX_TILT;         // 실제 회전각
      const tiltRad = tiltDeg * Math.PI / 180;

      // ── ① 블렌딩된 이미지를 중간 캔버스에 렌더 ──────────────────
      cCtx.clearRect(0, 0, W, H);
      if (this.img1 && p < 1) { cCtx.globalAlpha = 1 - p; this.drawCover(cCtx, this.img1, W, H); }
      if (this.img2 && p > 0) { cCtx.globalAlpha = p;     this.drawCover(cCtx, this.img2, W, H); }
      cCtx.globalAlpha = 1.0;

      // ── ② 수직 스트립 원근 투영 (CSS rotateY의 수학적 재현) ─────
      //  각 스트립의 3D x좌표 → Y축 회전 → 원근 투영 → 화면 x좌표
      //  결과: 가까운 면은 크게, 먼 면은 작게 → 진짜 3D 회전처럼 보임
      tCtx.fillStyle = '#080808';
      tCtx.fillRect(0, 0, W, H);

      const cx = W / 2; // 화면 수평 중심

      for (let s = 0; s < STRIPS; s++) {
        const u0 = s / STRIPS;           // 스트립 왼쪽 경계 (0~1)
        const u1 = (s + 1) / STRIPS;     // 스트립 오른쪽 경계

        // 카드 중심 기준 3D x 좌표
        const x3d0 = (u0 - 0.5) * W;
        const x3d1 = (u1 - 0.5) * W;

        // Y축 회전 후: xRot(화면 좌우), z(깊이 — 양수=뷰어에 가까움)
        const xRot0 = x3d0 * Math.cos(tiltRad),  z0 = x3d0 * Math.sin(tiltRad);
        const xRot1 = x3d1 * Math.cos(tiltRad),  z1 = x3d1 * Math.sin(tiltRad);

        // 뷰어 뒤로 넘어간 면은 건너뜀
        if (PERSPECTIVE - z0 <= 0 || PERSPECTIVE - z1 <= 0) continue;

        // 원근 투영: x' = cx + xRot × (P / (P − z))
        const xs0 = cx + xRot0 * (PERSPECTIVE / (PERSPECTIVE - z0));
        const xs1 = cx + xRot1 * (PERSPECTIVE / (PERSPECTIVE - z1));

        const destX = Math.min(xs0, xs1);
        const destW = Math.abs(xs1 - xs0);
        if (destW < 0.5) continue;

        // 중간 캔버스에서 해당 스트립 잘라 붙이기
        tCtx.drawImage(compCanvas, u0 * W, 0, W / STRIPS, H, destX, 0, destW, H);
      }

      // ── ③ 홀로그램 광택 (카드 영역에 클리핑) ────────────────────
      // 회전 후 카드의 화면상 좌우 경계 계산
      const edgeLeft  = cx + (-W / 2) * Math.cos(tiltRad) * (PERSPECTIVE / (PERSPECTIVE - (-W / 2) * Math.sin(tiltRad)));
      const edgeRight = cx + ( W / 2) * Math.cos(tiltRad) * (PERSPECTIVE / (PERSPECTIVE - ( W / 2) * Math.sin(tiltRad)));
      const cardLeft  = Math.min(edgeLeft, edgeRight);
      const cardRight = Math.max(edgeLeft, edgeRight);

      tCtx.save();
      tCtx.beginPath();
      tCtx.rect(cardLeft, 0, cardRight - cardLeft, H);
      tCtx.clip();

      const glossX = cardLeft + (cardRight - cardLeft) * (0.5 + sineVal * 0.30);
      const glossY = H * (0.5 - Math.cos(time) * 0.25);
      const grad   = tCtx.createRadialGradient(glossX, glossY, 0, glossX, glossY, (cardRight - cardLeft) * 0.75);
      grad.addColorStop(0,    'rgba(255,255,255,0.14)');
      grad.addColorStop(0.40, 'rgba(255,255,255,0.04)');
      grad.addColorStop(1,    'rgba(255,255,255,0)');
      tCtx.globalCompositeOperation = 'screen';
      tCtx.fillStyle = grad;
      tCtx.fillRect(cardLeft, 0, cardRight - cardLeft, H);
      tCtx.globalCompositeOperation = 'source-over';
      tCtx.restore();

      gif.addFrame(tempCanvas, { delay: 50, copy: true });
    }

    gif.on('finished', (blob) => {
      showToast("완성! 파일이 다운로드됩니다 🎉");
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'my_lenticular_card.gif';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    });

    gif.render();
  }

  initEvents() {
    this.card.addEventListener('mouseenter', () => { this.hovering = true; });
    this.card.addEventListener('mouseleave', () => { this.hovering = false; if(!isGlobalMotionEnabled){ this.tgtX = 0; this.tgtY = 0; }});
    this.card.addEventListener('mousemove', (e) => {
      if(isGlobalMotionEnabled) return; 
      const r = this.card.getBoundingClientRect();
      this.tgtX = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * MAX_X;
      this.tgtY = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -MAX_Y;
    });

    const isMobile = typeof window.orientation !== 'undefined' || navigator.userAgent.includes('Mobile');
    if (isMobile) {
      this.motionBtn.style.display = 'block';
      this.motionBtn.addEventListener('click', () => requestMotionPermission(this.motionBtn));
    }

    this.setupDrop(this.dz1, this.file1, 1); this.setupDrop(this.dz2, this.file2, 2);
    this.editBtn1.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (this.img1) openDrawingEditor(this.img1, this.isLandscape, (url) => this.loadFromUrl(url, 1)); });
    this.editBtn2.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (this.img2) openDrawingEditor(this.img2, this.isLandscape, (url) => this.loadFromUrl(url, 2)); });
    this.ratioBtns.forEach(btn => btn.addEventListener('click', () => this.setRatio(btn.dataset.ratio)));
    
    // 버튼 기능 연동
    this.shareBtn.addEventListener('click', () => { openShareModal(this.img1, this.img2, this.isLandscape); });
    this.saveGifBtn.addEventListener('click', () => { this.generateAndDownloadGIF(); });

    window.addEventListener('resize', () => this.updateCanvasSize()); 
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

/* ── Animated Share Modal Logic (순수 Auto-Sway) ── */
const shareModal = document.getElementById('shareModal');
const closeShareBtn = document.getElementById('closeShareBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const sendShareBtn = document.getElementById('sendShareBtn');
const toast = document.getElementById('toast');

const shareCanvas = document.getElementById('shareCanvas');
const shareCtx = shareCanvas.getContext('2d');
const sharePreviewCard = document.getElementById('sharePreviewCard');
const shareGloss = document.getElementById('shareGloss');

let shareImg1 = null, shareImg2 = null;
let shareW = 180, shareH = 240;
let isSharePlaying = false;
let shareAnimationId = null;

function openShareModal(img1, img2, isLandscape) {
  shareImg1 = img1; shareImg2 = img2;
  shareW = isLandscape ? 240 : 180; shareH = isLandscape ? 180 : 240;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  shareCanvas.width = shareW * dpr; shareCanvas.height = shareH * dpr;
  shareCtx.scale(dpr, dpr);

  if (isLandscape) sharePreviewCard.classList.add('landscape'); else sharePreviewCard.classList.remove('landscape');
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
  const progressVal = (sineVal + 1) / 2;

  sharePreviewCard.style.transform = `rotateX(${tiltY}deg) rotateY(${tiltX}deg)`;
  const gx = 50 + (tiltX / 18) * 30; const gy = 50 - (tiltY / 5) * 30;
  shareGloss.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.2) 0%, transparent 65%)`;

  renderShareCanvas(progressVal);
  shareAnimationId = requestAnimationFrame(playShareAnimation);
}

function showToast(msg) {
  toast.innerText = msg; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

closeShareBtn.addEventListener('click', closeShareModal);
copyLinkBtn.addEventListener('click', () => { showToast('🔗 링크가 클립보드에 복사되었습니다!'); closeShareModal(); });
sendShareBtn.addEventListener('click', () => { showToast('💌 친구에게 메시지를 전송했습니다!'); closeShareModal(); });

/* ── App State, History & Menu Toggle ── */
const historyList = document.getElementById('historyList');
const activeWorkspace = document.getElementById('activeWorkspace');
const template = document.getElementById('cardSetTemplate');
const addSetBtn = document.getElementById('addSetBtn');
const menuToggleBtn = document.getElementById('menuToggleBtn');
const historyPanel = document.getElementById('historyPanel');

let cardSets = []; let setIdCounter = 0;

if(menuToggleBtn) {
    menuToggleBtn.addEventListener('click', () => {
        historyPanel.classList.toggle('open');
    });
}

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
    if(isLandscape) thumbNode.classList.add('landscape'); else thumbNode.classList.remove('landscape');
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
  if (wasActive) { if (cardSets.length > 0) switchActiveSet(cardSets[cardSets.length - 1].id); else createNewCardSet(); }
}

function switchActiveSet(targetId) {
  cardSets.forEach(set => {
    if (set.id === targetId) { set.workspaceNode.classList.add('active'); set.thumbNode.classList.add('active'); }
    else { set.workspaceNode.classList.remove('active'); set.thumbNode.classList.remove('active'); }
  });
  historyPanel.classList.remove('open');
}

createNewCardSet();
addSetBtn.addEventListener('click', createNewCardSet);