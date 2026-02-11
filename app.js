
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const UI = {
  temp: document.getElementById("temp"),
  c3h8: document.getElementById("c3h8"),
  o2: document.getElementById("o2"),
  symbols: document.getElementById("symbols"),
  pause: document.getElementById("pause"),
  reset: document.getElementById("reset")
};

let showSymbols = true;
let paused = false;
let lastTs = null;

const R = 14;
const W = canvas.width;
const H = canvas.height;

let C3H8 = [];
let O2 = [];
let H2O = [];
let CO2 = [];

function randVel(scale){ return (Math.random()-0.5)*scale; }

function newMol(type){
  return {
    type,
    x: Math.random()*(W-40)+20,
    y: Math.random()*(H-200)+20,
    vx: randVel(120),
    vy: randVel(120),
    armed: 0,
    armed_t: 0
  };
}

function resetSim(){
  C3H8 = [];
  O2 = [];
  H2O = [];
  CO2 = [];

  for(let i=0;i<Number(UI.c3h8.value);i++) C3H8.push(newMol("C3H8"));
  for(let i=0;i<Number(UI.o2.value);i++) O2.push(newMol("O2"));

  lastTs = null;
}

function drawSphere(x,y,color,label,r=R){
  ctx.beginPath();
  ctx.arc(x,y,r,0,2*Math.PI);
  ctx.fillStyle=color;
  ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,0.2)";
  ctx.stroke();

  if(showSymbols && label){
    ctx.fillStyle=(color==="#ffffff")?"#111":"#fff";
    ctx.font="bold 12px Arial";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(label,x,y);
  }
}

function drawC3H8(m){
  const dx = R*1.2;
  drawSphere(m.x-dx, m.y, "#444","C");
  drawSphere(m.x, m.y, "#444","C");
  drawSphere(m.x+dx, m.y, "#444","C");

  const hy = R*1.4;
  drawSphere(m.x-dx, m.y-hy,"#fff","H",R*0.8);
  drawSphere(m.x-dx, m.y+hy,"#fff","H",R*0.8);
  drawSphere(m.x, m.y-hy,"#fff","H",R*0.8);
  drawSphere(m.x, m.y+hy,"#fff","H",R*0.8);
  drawSphere(m.x+dx, m.y-hy,"#fff","H",R*0.8);
  drawSphere(m.x+dx, m.y+hy,"#fff","H",R*0.8);

  if(showSymbols){
    ctx.fillStyle="#111";
    ctx.fillText("C₃H₈",m.x,m.y-R*2);
  }
}

function drawO2(m){
  drawSphere(m.x-R*0.7,m.y,"#d02020","O");
  drawSphere(m.x+R*0.7,m.y,"#d02020","O");
  if(showSymbols) ctx.fillText("O₂",m.x,m.y-R*2);
}

function drawH2O(m){
  drawSphere(m.x,m.y,"#d02020","O");
  drawSphere(m.x-R,m.y+R,"#fff","H",R*0.8);
  drawSphere(m.x+R,m.y+R,"#fff","H",R*0.8);
  if(showSymbols) ctx.fillText("H₂O",m.x,m.y-R*2);
}

function drawCO2(m){
  drawSphere(m.x,m.y,"#444","C");
  drawSphere(m.x-R*1.2,m.y,"#d02020","O");
  drawSphere(m.x+R*1.2,m.y,"#d02020","O");
  if(showSymbols) ctx.fillText("CO₂",m.x,m.y-R*2);
}

function step(arr,dt,mult){
  for(const m of arr){
    m.x+=m.vx*dt*mult;
    m.y+=m.vy*dt*mult;
    if(m.x<20||m.x>W-20)m.vx*=-1;
    if(m.y<20||m.y>H-120)m.vy*=-1;
  }
}

function react(dt,temp){
  const p=0.7*(0.6+0.2*temp);
  const r2=(R*3)*(R*3);

  for(let i=C3H8.length-1;i>=0;i--){
    const ch=C3H8[i];
    for(let j=O2.length-1;j>=0;j--){
      const o=O2[j];
      const dx=ch.x-o.x;
      const dy=ch.y-o.y;
      if(dx*dx+dy*dy<r2){
        if(Math.random()<p){
          O2.splice(j,1);
          ch.armed++;
          if(ch.armed>=5){
            C3H8.splice(i,1);
            for(let k=0;k<3;k++) CO2.push(newMol("CO2"));
            for(let k=0;k<4;k++) H2O.push(newMol("H2O"));
          }
        }
        break;
      }
    }
  }
}

function loop(ts){
  if(lastTs===null) lastTs=ts;
  const dt=Math.min(0.033,(ts-lastTs)/1000);
  lastTs=ts;

  const mult=(Number(UI.temp.value)**2)*0.25;

  if(!paused){
    step(C3H8,dt,mult);
    step(O2,dt,mult);
    step(H2O,dt,mult*0.9);
    step(CO2,dt,mult*0.9);
    react(dt,Number(UI.temp.value));
  }

  ctx.clearRect(0,0,W,H);

  for(const m of C3H8) drawC3H8(m);
  for(const m of O2) drawO2(m);
  for(const m of CO2) drawCO2(m);
  for(const m of H2O) drawH2O(m);

  requestAnimationFrame(loop);
}

UI.symbols.onclick=()=>{showSymbols=!showSymbols;UI.symbols.textContent=showSymbols?"Symboles : ON":"Symboles : OFF";};
UI.pause.onclick=()=>{paused=!paused;UI.pause.textContent=paused?"Reprendre":"Pause";};
UI.reset.onclick=()=>{paused=false;UI.pause.textContent="Pause";resetSim();};

UI.c3h8.oninput=resetSim;
UI.o2.oninput=resetSim;

resetSim();
requestAnimationFrame(loop);
