/* ── Constants ── */
const CARD_W = 300;
const CARD_H = 400;
const MAX_X  = 22;
const MAX_Y  = 14;
const LERP   = 0.07;

/* ── Lenticular Class ── */
class LenticularCard {
  constructor(workspaceNode, onImageUpdate) {
    this.workspace = workspaceNode;
    this.onImageUpdate = onImageUpdate; 
    
    this.card   = this.workspace.querySelector('.card');
    this.canvas = this.workspace.querySelector('.canvas');
    this.gloss  = this.workspace.querySelector('.gloss');
    this.idle   = this.workspace.querySelector('.idle');
    this.hint   = this.workspace.querySelector('.stage-hint');
    
    this.dz1    = this.workspace.querySelector('.dz1');
    this.dz2    = this.workspace.querySelector('.dz2');
    this.file1  = this.workspace.querySelector('.file1');
    this.file2  = this.workspace.querySelector('.file2');
    this.thumb1 = this.workspace.querySelector('.thumb1');
    this.thumb2 = this.workspace.querySelector('.thumb2');

    this.ctx = this.canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width  = CARD_W * dpr;
    this.canvas.height = CARD_H * dpr;
    this.ctx.scale(dpr, dpr);

    this.img1 = null;
    this.img2 = null;
    this.curX = 0;
    this.curY = 0;
    this.tgtX = 0;
    this.tgtY = 0;
    this.hovering = false;

    this.initEvents();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  drawCover(img) {
    const scale = Math.max(CARD_W / img.naturalWidth, CARD_H / img.naturalHeight);
    const w = img.naturalWidth  * scale;
    const h = img.naturalHeight * scale;
    this.ctx.drawImage(img, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
  }

  render(progress) {
    this.ctx.clearRect(0, 0, CARD_W, CARD_H);
    if (!this.img1 && !this.img2) return;

    const p = Math.max(0, Math.min(1, progress));

    if (this.img1 && p < 1) {
      this.ctx.globalAlpha = 1 - p;
      this.drawCover(this.img1);
    }
    if (this.img2 && p > 0) {
      this.ctx.globalAlpha = p;
      this.drawCover(this.img2);
    }
    this.ctx.globalAlpha = 1.0;
  }

  tick() {
    this.curX += (this.tgtX - this.curX) * LERP;
    this.curY += (this.tgtY - this.curY) * LERP;

    const scale = this.hovering ? 1.045 : 1;
    this.card.style.transform = `rotateX(${this.curY}deg) rotateY(${this.curX}deg) scale(${scale})`;

    const gx = 50 + (this.curX / MAX_X) * 28;
    const gy = 50 - (this.curY / MAX_Y) * 28;
    this.gloss.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 38%, transparent 65%)`;

    const progress = (this.curX + MAX_X) / (MAX_X * 2);
    this.render(progress);

    requestAnimationFrame(this.tick);
  }

  initEvents() {
    this.card.addEventListener('mouseenter', () => { this.hovering = true; });
    this.card.addEventListener('mouseleave', () => { this.hovering = false; this.tgtX = 0; this.tgtY = 0; });
    this.card.addEventListener('mousemove', (e) => {
      const r  = this.card.getBoundingClientRect();
      this.tgtX = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * MAX_X;
      this.tgtY = ((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * -MAX_Y;
    });

    this.setupDrop(this.dz1, this.file1, 1);
    this.setupDrop(this.dz2, this.file2, 2);
  }

  onImageReady() {
    if (this.img1 || this.img2) {
      this.idle.classList.add('gone');
      this.hint.classList.add('show');
    }
  }

  loadFile(file, num) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const el  = new Image();
    el.onload = () => {
      if (num === 1) this.img1 = el; else this.img2 = el;
      
      const thumb = num === 1 ? this.thumb1 : this.thumb2;
      thumb.src = url;
      thumb.classList.add('show');
      
      const dz = num === 1 ? this.dz1 : this.dz2;
      dz.classList.add('filled');
      
      if ((num === 1) || (num === 2 && !this.img1)) {
        if (this.onImageUpdate) this.onImageUpdate(url);
      }
      
      this.onImageReady();
    };
    el.src = url;
  }

  setupDrop(dz, input, num) {
    dz.addEventListener('dragover',  (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', ()  => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); this.loadFile(e.dataTransfer.files[0], num); });
    input.addEventListener('change', () => this.loadFile(input.files[0], num));
  }
}

/* ── App State & Initialization ── */
const historyList   = document.getElementById('historyList');
const activeWorkspace = document.getElementById('activeWorkspace');
const template      = document.getElementById('cardSetTemplate');
const addSetBtn     = document.getElementById('addSetBtn');

let cardSets = []; 
let setIdCounter = 0;

function createNewCardSet() {
  const id = ++setIdCounter;

  const clone = template.content.cloneNode(true);
  const workspaceNode = clone.querySelector('.workspace');
  activeWorkspace.appendChild(workspaceNode);

  const thumbNode = document.createElement('div');
  thumbNode.className = 'history-item';
  thumbNode.innerText = `Set ${id}`; 
  thumbNode.addEventListener('click', () => switchActiveSet(id));
  
  // 💡 수정된 부분: appendChild 대신 prepend를 사용하여 썸네일을 목록의 맨 위에 추가합니다.
  historyList.prepend(thumbNode);

  const instance = new LenticularCard(workspaceNode, (imgUrl) => {
    thumbNode.style.backgroundImage = `url(${imgUrl})`;
    thumbNode.innerText = ''; 
  });

  cardSets.push({ id, workspaceNode, thumbNode, instance });

  switchActiveSet(id);
}

function switchActiveSet(targetId) {
  cardSets.forEach(set => {
    if (set.id === targetId) {
      set.workspaceNode.classList.add('active');
      set.thumbNode.classList.add('active');
    } else {
      set.workspaceNode.classList.remove('active');
      set.thumbNode.classList.remove('active');
    }
  });
}

createNewCardSet();
addSetBtn.addEventListener('click', createNewCardSet);