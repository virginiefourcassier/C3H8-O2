const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const UI = {
  temp: document.getElementById("temp"),
  c3h8: document.getElementById("c3h8"),
  o2: document.getElementById("o2"),
  btnSymbols: document.getElementById("btnSymbols"),
  btnPause: document.getElementById("btnPause"),
  btnReset: document.getElementById("btnReset")
};

let showSymbols = true;
let paused = false;
let lastTs = null;

const W = canvas.width;
const H = canvas.height;

const R = 15;                 // rayon (grossi)
const HUD = { x: 18, y: 18, w: 240, h: 140 };

let C3H8 = [];
let O2 = [];
let H2O = [];
let CO2 = [];

// --------- utilitaires couleur ----------
function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function hexToRgb(hex){
  const h = hex.replace("#","").trim();
  const v = parseInt(h.length===3 ? h.split("").map(c=>c+c).join("") : h, 16);
  return { r:(v>>16)&255, g:(v>>8)&255, b:v&255 };
}
function rgbToHex({r,g,b}){
  const to2 = (n)=>("0"+Math.round(n).toString(16)).slice(-2);
  return "#"+to2(r)+to2(g)+to2(b);
}
function mix(c1, c2, t){
  t = clamp01(t);
  return { r: c1.r + (c2.r-c1.r)*t, g: c1.g + (c2.g-c1.g)*t, b: c1.b + (c2.b-c1.b)*t };
}

// --------- sphère “3D” (ombre + reflet) ----------
function drawSphere(x, y, baseHex, label, outlineHex=null, r=R){
  const base = hexToRgb(baseHex);
  const white = {r:255,g:255,b:255};
  const black = {r:0,g:0,b:0};

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;

  const grad = ctx.createRadialGradient(x - r*0.35, y - r*0.35, r*0.2, x, y, r);
  grad.addColorStop(0.00, rgbToHex(mix(base, white, 0.75)));
  grad.addColorStop(0.35, rgbToHex(mix(base, white, 0.25)));
  grad.addColorStop(1.00, rgbToHex(mix(base, black, 0.22)));

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2;
  ctx.strokeStyle = outlineHex ? outlineHex : "rgba(0,0,0,0.12)";
  ctx.stroke();

  // reflet
  ctx.beginPath();
  ctx.arc(x - r*0.35, y - r*0.35, r*0.35, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();

  ctx.restore();

  if(showSymbols && label){
    ctx.save();
    ctx.fillStyle = (baseHex.toLowerCase() === "#ffffff") ? "#111" : "#fff";
    ctx.font = `bold ${Math.round(r*0.9)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    ctx.restore();
  }
}

function drawRoundedRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function randVel(scale){ return (Math.random()-0.5) * scale; }

function newMol(type, x=null, y=null){
  const speed = 150;
  return {
    type,
    x: (x===null) ? (Math.random()*(W-2*R)+R) : x,
    y: (y===null) ? (Math.random()*(H-260)+R) : y,
    vx: randVel(speed),
    vy: randVel(speed),
    armed: 0,
    armed_t: 0
  };
}

// --------- init / UI ----------
function resetSim(){
  C3H8 = [];
  O2 = [];
  H2O = [];
  CO2 = [];

  const nC3H8 = Number(UI.c3h8.value);
  const nO2 = Number(UI.o2.value);

  for(let i=0;i<nC3H8;i++) C3H8.push(newMol("C3H8"));
  for(let i=0;i<nO2;i++)  O2.push(newMol("O2"));

  lastTs = null;
}

function toggleSymbols(){
  showSymbols = !showSymbols;
  UI.btnSymbols.textContent = showSymbols ? "Symboles : ON" : "Symboles : OFF";
}
function pauseSim(){
  paused = !paused;
  UI.btnPause.textContent = paused ? "Reprendre" : "Pause";
}

// --------- mouvement ----------
function step(arr, dt, mult){
  for(const m of arr){
    m.x += m.vx * dt * mult;
    m.y += m.vy * dt * mult;

    if(m.x < R){ m.x = R; m.vx *= -1; }
    if(m.x > W - R){ m.x = W - R; m.vx *= -1; }
    if(m.y < R){ m.y = R; m.vy *= -1; }
    if(m.y > H - 140){ m.y = H - 140; m.vy *= -1; }
  }
}

// --------- dessin molécules ----------
function drawC3H8(m){
  // 3 carbones plus visibles : plus gros, plus sombre
  const dx = R*1.15;
  const rC = R*1.20;
  const rH = R*0.80;

  drawSphere(m.x - dx, m.y, "#2b2b2b", "C", "rgba(0,0,0,0.35)", rC);
  drawSphere(m.x,       m.y, "#2b2b2b", "C", "rgba(0,0,0,0.35)", rC);
  drawSphere(m.x + dx,  m.y, "#2b2b2b", "C", "rgba(0,0,0,0.35)", rC);

  // hydrogènes : schéma simple et lisible
  const hy = R*1.35;
  drawSphere(m.x - dx, m.y - hy, "#ffffff", "H", "rgba(0,0,0,0.35)", rH);
  drawSphere(m.x - dx, m.y + hy, "#ffffff", "H", "rgba(0,0,0,0.35)", rH);

  drawSphere(m.x, m.y - hy, "#ffffff", "H", "rgba(0,0,0,0.35)", rH);
  drawSphere(m.x, m.y + hy, "#ffffff", "H", "rgba(0,0,0,0.35)", rH);

  drawSphere(m.x + dx, m.y - hy, "#ffffff", "H", "rgba(0,0,0,0.35)", rH);
  drawSphere(m.x + dx, m.y + hy, "#ffffff", "H", "rgba(0,0,0,0.35)", rH);

  // 2 H supplémentaires près des extrémités (8 H au total)
  drawSphere(m.x - dx - R*0.9, m.y, "#ffffff", "H", "rgba(0,0,0,0.35)", rH);
  drawSphere(m.x + dx + R*0.9, m.y, "#ffffff", "H", "rgba(0,0,0,0.35)", rH);

  if(showSymbols){
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("C₃H₈", m.x, m.y - hy - rC*0.7);
    ctx.restore();
  }
}

function drawO2(m){
  const dx = R*0.65;
  drawSphere(m.x - dx, m.y, "#d02020", "O", null, R);
  drawSphere(m.x + dx, m.y, "#d02020", "O", null, R);

  if(showSymbols){
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("O₂", m.x, m.y - R*1.4);
    ctx.restore();
  }
}

function drawH2O(m){
  drawSphere(m.x, m.y, "#d02020", "O", null, R);
  const a = R*1.05;
  drawSphere(m.x - a, m.y + a*0.55, "#ffffff", "H", "rgba(0,0,0,0.35)", R*0.85);
  drawSphere(m.x + a, m.y + a*0.55, "#ffffff", "H", "rgba(0,0,0,0.35)", R*0.85);

  if(showSymbols){
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("H₂O", m.x, m.y - R*1.4);
    ctx.restore();
  }
}

function drawCO2(m){
  drawSphere(m.x, m.y, "#2b2b2b", "C", "rgba(0,0,0,0.35)", R*1.05);
  const dx = R*1.15;
  drawSphere(m.x - dx, m.y, "#d02020", "O", null, R);
  drawSphere(m.x + dx, m.y, "#d02020", "O", null, R);

  if(showSymbols){
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("CO₂", m.x, m.y - R*1.4);
    ctx.restore();
  }
}

// --------- réaction : C3H8 + 5 O2 -> 3 CO2 + 4 H2O ---------
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

function react(dt, temp){
  // accéléré pour finir en < 2 min (selon quantités)
  const pBase = 0.78;
  const p = Math.min(0.98, pBase * (0.60 + 0.22*temp));
  const rHit = R*3.0;
  const r2 = rHit*rHit;

  // fenêtre d'armement : le propane doit rencontrer 5 O2 dans un laps de temps
  const armWindow = 1.2;

  for(const m of C3H8){
    if(m.armed > 0){
      m.armed_t += dt;
      if(m.armed_t > armWindow){
        m.armed = 0;
        m.armed_t = 0;
      }
    }
  }

  for(let i = C3H8.length - 1; i >= 0; i--){
    const pr = C3H8[i];

    // trouve un O2 proche
    let hit = -1;
    for(let j = O2.length - 1; j >= 0; j--){
      const o = O2[j];
      if(dist2(pr.x, pr.y, o.x, o.y) <= r2){
        hit = j;
        break;
      }
    }
    if(hit === -1) continue;

    if(Math.random() < p){
      // consommer 1 O2
      O2.splice(hit, 1);

      pr.armed += 1;
      pr.armed_t = 0;

      // si 5 O2 "acquis" => réaction
      if(pr.armed >= 5){
        C3H8.splice(i, 1);

        // produits au voisinage (mobiles)
        for(let k=0;k<3;k++){
          CO2.push(newMol("CO2", pr.x + (Math.random()*40-20), pr.y + (Math.random()*40-20)));
        }
        for(let k=0;k<4;k++){
          H2O.push(newMol("H2O", pr.x + (Math.random()*40-20), pr.y + (Math.random()*40-20)));
        }
      }
    }
  }
}

// --------- HUD encadré ----------
function drawHUD(){
  ctx.save();
  drawRoundedRect(HUD.x, HUD.y, HUD.w, HUD.h, 14);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.stroke();

  ctx.fillStyle = "#111";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const lines = [
    `C₃H₈ : ${C3H8.length}`,
    `O₂  : ${O2.length}`,
    `CO₂ : ${CO2.length}`,
    `H₂O : ${H2O.length}`,
  ];
  let yy = HUD.y + 12;
  for(const ln of lines){
    ctx.fillText(ln, HUD.x + 14, yy);
    yy += 22;
  }
  ctx.restore();
}

// --------- rendu ----------
function render(){
  ctx.clearRect(0,0,W,H);

  for(const m of C3H8) drawC3H8(m);
  for(const m of O2)   drawO2(m);
  for(const m of CO2)  drawCO2(m);
  for(const m of H2O)  drawH2O(m);

  drawHUD();

  if(paused){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = "#111";
    ctx.font = "bold 46px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSE", W/2, H/2);
    ctx.restore();
  }
}

// --------- boucle ----------
function loop(ts){
  if(lastTs === null) lastTs = ts;
  const dt = Math.min(0.033, (ts - lastTs)/1000);
  lastTs = ts;

  const temp = Number(UI.temp.value);
  // effet T accentué : vitesse ~ T^2
  const speedMult = (temp*temp) * 0.25; // T=2 -> 1 ; T=5 -> 6.25

  if(!paused){
    step(C3H8, dt, speedMult);
    step(O2,   dt, speedMult*1.05);
    step(H2O,  dt, speedMult*0.95);
    step(CO2,  dt, speedMult*0.95);
    react(dt, temp);
  }

  render();
  requestAnimationFrame(loop);
}

// --------- events ----------
UI.btnSymbols.addEventListener("click", toggleSymbols);
UI.btnPause.addEventListener("click", pauseSim);
UI.btnReset.addEventListener("click", () => { paused = false; UI.btnPause.textContent = "Pause"; resetSim(); });

UI.c3h8.addEventListener("input", resetSim);
UI.o2.addEventListener("input", resetSim);

// init
resetSim();
requestAnimationFrame(loop);
