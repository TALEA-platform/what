// LE PERSONE DEL PLASTICO — la geometria, staccata da chi la disegna.
//
// Stava dentro `rifugioModel3d.js`, ed era giusto finche' le persone servivano
// a una scena sola. Ora servono a DUE: il plastico girevole del capitolo sul
// rifugio e i tre primi piani di «dove manca, si costruisce». Copiarle avrebbe
// voluto dire tenere allineate a mano due signore con lo stesso cappello.
//
// Qui non c'e' nessun render: ci sono i punti. Chi chiama passa il proprio
// `addFace` e i propri contenitori, e ne fa quello che vuole —
//   · il plastico li proietta a ogni fotogramma, con l'angolo del momento;
//   · `scripts/build_cast_figures.mjs` li proietta UNA volta in assonometria,
//     butta via tutto quello che non si vede e ne cuoce un disegno statico.
//
// ── `detail`: lo stesso corpo, meno faccette ─────────────────────────────
// Nel plastico le persone si guardano da vicino e si girano, quindi la
// tassellatura serve tutta. Nei primi piani sono alte ottanta pixel e non si
// muovono: meta' dei meridiani di una testa non si distingue nemmeno. Il
// moltiplicatore riduce i segmenti di TUTTE le primitive insieme, cosi' la
// riduzione resta proporzionata e nessun pezzo diventa un poligono mentre i
// vicini restano tondi. A 1 (il valore del plastico) i conti tornano identici
// a prima: `Math.round(k * 1)` e' `k`.

/** La tavolozza del cast: pelli, capelli, stoffe, e i pochi oggetti che le
 *  persone si portano dietro (bastone, cappello, carrozzina). */
export const CAST = {
  skinLight: "#E9C6A0",
  skinWarm: "#B07A4E",
  skinCopper: "#C68F62",
  skinDeep: "#8E6443",
  hair: "#3A2B22",
  hairDark: "#2A2620",
  elderTop: "#9FB09F",
  elderSkirt: "#BBAA8B",
  coral: "#C48D74",
  blueGrey: "#7E8B93",
  childYellow: "#DBB56C",
  chairBlue: "#7E9CB0",
  chairOlive: "#8C9A6E",
  pregnant: "#C58C82",
  shoe: "#42403A",
  brownShoe: "#6E5A47",
  metal: "#6E7A82",
  metalHi: "#AEB4B8",
  cane: "#9A7B58",
  hat: "#D9C79B",
  greyHair: "#B9B2A6",
};

const point = (x, y, z = 0) => ({ x, y, z });

/**
 * Costruisce le primitive e le figure attorno al contesto di chi disegna.
 *
 * @param {object} ctx
 * @param {(target: any[], points: object[], fill: string, normal: object, options?: object) => void} ctx.addFace
 * @param {any[]} ctx.solids        dove finiscono i volumi
 * @param {any[]} ctx.contactFaces  dove finiscono le ombre di contatto
 * @param {string} ctx.ink          il nero del disegno
 * @param {number} ctx.personYaw    l'asse frontale predefinito
 * @param {() => object} [ctx.figureOptions] le opzioni correnti (cambiano a ogni persona)
 * @param {() => number} [ctx.benchSeatZ]    la quota della seduta, per chi si siede
 * @param {number} [ctx.detail]     moltiplicatore della tassellatura
 */
export function createCastFigures({
  addFace,
  solids,
  contactFaces,
  ink,
  personYaw,
  figureOptions = () => ({}),
  benchSeatZ = () => 0.45,
  detail = 1,
}) {
  const segCount = (n, min) => Math.max(min, Math.round(n * detail));

  const vAdd = (a,b) => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
  const vSub = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const vScale = (v,s) => ({x:v.x*s,y:v.y*s,z:v.z*s});
  const vCross = (a,b) => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const vLength = (v) => Math.hypot(v.x,v.y,v.z) || 1;
  const vNormal = (v) => vScale(v,1/vLength(v));

  function localPoint(cx, cy, forward, side, z, yaw = personYaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return point(cx + forward*c - side*s, cy + forward*s + side*c, z);
  }

  function localNormal(forward, side, z, yaw = personYaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return vNormal({x:forward*c-side*s,y:forward*s+side*c,z});
  }

  function figureMaterial(front, side = front, back = side, top = front) {
    return {front,side,back,top};
  }

  function mixHex(a,b,t) {
    const value=(hex,shift)=>parseInt(hex.slice(1),16)>>shift&255;
    const channel=(shift)=>Math.round(value(a,shift)+(value(b,shift)-value(a,shift))*t).toString(16).padStart(2,"0");
    return `#${channel(16)}${channel(8)}${channel(0)}`;
  }

  function surfaceTone(fill,normal) {
    const light=vNormal({x:-.45,y:-.3,z:1});
    const amount=normal.x*light.x+normal.y*light.y+normal.z*light.z;
    return amount >= 0
      ? mixHex(fill,"#FFF8EA",Math.min(.035,amount*.03))
      : mixHex(fill,ink,Math.min(.03,-amount*.025));
  }

  function addRoundFrustum(target,cx,cy,bottomWidth,bottomDepth,topWidth,topDepth,z0,z1,colours,yaw=personYaw,segments=10) {
    const sides=segCount(segments,6);
    const bottom=[];
    const top=[];
    for(let i=0;i<sides;i++) {
      const a=i/sides*Math.PI*2;
      bottom.push(localPoint(cx,cy,Math.cos(a)*bottomDepth/2,Math.sin(a)*bottomWidth/2,z0,yaw));
      top.push(localPoint(cx,cy,Math.cos(a)*topDepth/2,Math.sin(a)*topWidth/2,z1,yaw));
    }
    for(let i=0;i<sides;i++) {
      const j=(i+1)%sides;
      const a=(i+.5)/sides*Math.PI*2;
      const normal=localNormal(Math.cos(a),Math.sin(a),0,yaw);
      const fill=surfaceTone(colours.front,normal);
      addFace(target,[bottom[i],bottom[j],top[j],top[i]],fill,normal,{...figureOptions(),stroke:fill});
    }
    const topFill=surfaceTone(colours.top,{x:0,y:0,z:1});
    addFace(target,top,topFill,{x:0,y:0,z:1},{...figureOptions(),stroke:topFill});
  }

  function addOrientedFrustum(target, cx, cy, bottomWidth, bottomDepth, topWidth, topDepth, z0, z1, colours, yaw = personYaw, options = null) {
    const opts = options ?? figureOptions();
    const bfl=localPoint(cx,cy,bottomDepth/2,-bottomWidth/2,z0,yaw);
    const bfr=localPoint(cx,cy,bottomDepth/2,bottomWidth/2,z0,yaw);
    const bbr=localPoint(cx,cy,-bottomDepth/2,bottomWidth/2,z0,yaw);
    const bbl=localPoint(cx,cy,-bottomDepth/2,-bottomWidth/2,z0,yaw);
    const tfl=localPoint(cx,cy,topDepth/2,-topWidth/2,z1,yaw);
    const tfr=localPoint(cx,cy,topDepth/2,topWidth/2,z1,yaw);
    const tbr=localPoint(cx,cy,-topDepth/2,topWidth/2,z1,yaw);
    const tbl=localPoint(cx,cy,-topDepth/2,-topWidth/2,z1,yaw);
    addFace(target,[tfl,tfr,tbr,tbl],colours.top,{x:0,y:0,z:1},opts);
    addFace(target,[bfl,bfr,tfr,tfl],colours.front,localNormal(1,0,0,yaw),opts);
    addFace(target,[bfr,bbr,tbr,tfr],colours.side,localNormal(0,1,0,yaw),opts);
    addFace(target,[bbr,bbl,tbl,tbr],colours.back,localNormal(-1,0,0,yaw),opts);
    addFace(target,[bbl,bfl,tfl,tbl],colours.side,localNormal(0,-1,0,yaw),opts);
  }

  function addOrientedBox(target, cx, cy, width, depth, height, colours, base, yaw = personYaw, options = null) {
    addOrientedFrustum(target,cx,cy,width,depth,width,depth,base,base+height,colours,yaw,options);
  }

  function addEllipsoid(target, cx, cy, cz, forwardRadius, sideRadius, zRadius, fill, yaw = personYaw, options = null, longitudes = 12) {
    const opts = options ?? figureOptions();
    const meridians = segCount(longitudes,5);
    const latitudeSteps = meridians >= 10 ? 6 : 4;
    const latitudes = Array.from({length:latitudeSteps+1},(_,i)=>-Math.PI/2+i/latitudeSteps*Math.PI);
    for (let lat=0;lat<latitudes.length-1;lat++) {
      const a0=latitudes[lat];
      const a1=latitudes[lat+1];
      for (let lon=0;lon<meridians;lon++) {
        const l0=lon/meridians*Math.PI*2;
        const l1=(lon+1)/meridians*Math.PI*2;
        const make=(a,l) => localPoint(cx,cy,forwardRadius*Math.cos(a)*Math.cos(l),sideRadius*Math.cos(a)*Math.sin(l),cz+zRadius*Math.sin(a),yaw);
        const p0=make(a0,l0), p1=make(a0,l1), p2=make(a1,l1), p3=make(a1,l0);
        const am=(a0+a1)/2, lm=(l0+l1)/2;
        const normal=localNormal(Math.cos(am)*Math.cos(lm)/forwardRadius,Math.cos(am)*Math.sin(lm)/sideRadius,Math.sin(am)/zRadius,yaw);
        // `softness` smorza la variazione di tono fra faccetta e faccetta.
        // Sulle chiome serve: a piena forza i meridiani si vedevano tutti e
        // l'albero leggeva come un ombrellone con le stecche.
        const toned=surfaceTone(fill,normal);
        const faceFill=opts.softness ? mixHex(toned,fill,opts.softness) : toned;
        addFace(target,[p0,p1,p2,p3],faceFill,normal,{...opts,stroke:faceFill});
      }
    }
  }

  function addTube(target, start, end, radius, fill, segments = 8, options = null) {
    const opts = options ?? figureOptions();
    const sides=segCount(segments,4);
    const axis=vNormal(vSub(end,start));
    const helper=Math.abs(axis.z)>.88 ? {x:1,y:0,z:0} : {x:0,y:0,z:1};
    const u=vNormal(vCross(axis,helper));
    const v=vNormal(vCross(axis,u));
    const ring=(center,i) => {
      const a=i/sides*Math.PI*2;
      return vAdd(center,vAdd(vScale(u,Math.cos(a)*radius),vScale(v,Math.sin(a)*radius)));
    };
    for (let i=0;i<sides;i++) {
      const p0=ring(start,i),p1=ring(start,i+1),p2=ring(end,i+1),p3=ring(end,i);
      const normal=vNormal(vAdd(vScale(u,Math.cos((i+.5)/sides*Math.PI*2)),vScale(v,Math.sin((i+.5)/sides*Math.PI*2))));
      const faceFill=surfaceTone(fill,normal);
      addFace(target,[p0,p1,p2,p3],faceFill,normal,{...opts,stroke:faceFill});
    }
    const startRing=Array.from({length:sides},(_,i)=>ring(start,sides-1-i));
    const endRing=Array.from({length:sides},(_,i)=>ring(end,i));
    const startFill=surfaceTone(fill,vScale(axis,-1));
    const endFill=surfaceTone(fill,axis);
    addFace(target,startRing,startFill,vScale(axis,-1),{...opts,stroke:startFill});
    addFace(target,endRing,endFill,axis,{...opts,stroke:endFill});
  }

  function addTaperedTube(target,start,end,startRadius,endRadius,fill,segments=8,options=null) {
    const opts = options ?? figureOptions();
    const sides=segCount(segments,4);
    const axis=vNormal(vSub(end,start));
    const helper=Math.abs(axis.z)>.88 ? {x:1,y:0,z:0} : {x:0,y:0,z:1};
    const u=vNormal(vCross(axis,helper));
    const v=vNormal(vCross(axis,u));
    const ring=(center,i,radius)=>{
      const a=i/sides*Math.PI*2;
      return vAdd(center,vAdd(vScale(u,Math.cos(a)*radius),vScale(v,Math.sin(a)*radius)));
    };
    for(let i=0;i<sides;i++) {
      const p0=ring(start,i,startRadius),p1=ring(start,i+1,startRadius);
      const p2=ring(end,i+1,endRadius),p3=ring(end,i,endRadius);
      const normal=vNormal(vAdd(vScale(u,Math.cos((i+.5)/sides*Math.PI*2)),vScale(v,Math.sin((i+.5)/sides*Math.PI*2))));
      const faceFill=surfaceTone(fill,normal);
      addFace(target,[p0,p1,p2,p3],faceFill,normal,{...opts,stroke:faceFill});
    }
    const startRing=Array.from({length:sides},(_,i)=>ring(start,sides-1-i,startRadius));
    const endRing=Array.from({length:sides},(_,i)=>ring(end,i,endRadius));
    const startFill=surfaceTone(fill,vScale(axis,-1));
    const endFill=surfaceTone(fill,axis);
    addFace(target,startRing,startFill,vScale(axis,-1),{...opts,stroke:startFill});
    addFace(target,endRing,endFill,axis,{...opts,stroke:endFill});
  }

  function addJoint(center,radius,fill,yaw=personYaw) {
    addEllipsoid(solids,center.x,center.y,center.z,radius*.92,radius,radius,fill,yaw,figureOptions(),8);
  }

  function addHand(center,skin,yaw=personYaw,thumbSide=1,scale=1) {
    addEllipsoid(solids,center.x,center.y,center.z,.058*scale,.052*scale,.072*scale,skin,yaw,figureOptions(),8);
    const thumb=localPoint(center.x,center.y,.025,thumbSide*.052*scale,center.z-.008,yaw);
    addEllipsoid(solids,thumb.x,thumb.y,thumb.z,.032*scale,.026*scale,.04*scale,skin,yaw,figureOptions(),6);
  }

  function addContactShadow(cx,cy,forwardRadius,sideRadius,yaw=personYaw) {
    const points=Array.from({length:14},(_,i)=>{
      const a=i/14*Math.PI*2;
      return localPoint(cx,cy,Math.cos(a)*forwardRadius,Math.sin(a)*sideRadius,.238,yaw);
    });
    addFace(contactFaces,points,ink,{x:0,y:0,z:1},{className:"cast-contact-shadow",stroke:"none",opacity:.105});
  }

  function addFaceDetails(cx,cy,cz,skin,headForward=.15,headSide=.16,yaw=personYaw) {
    const facePlate=localPoint(cx,cy,headForward*.77,0,cz-.018,yaw);
    const faceColour=mixHex(skin,"#FFF8EA",.08);
    addEllipsoid(solids,facePlate.x,facePlate.y,facePlate.z,.035,headSide*.73,.145,faceColour,yaw,figureOptions(),8);

    const faceFront=headForward*1.025;
    [-.062,.062].forEach((side) => {
      const eye=localPoint(cx,cy,faceFront,side,cz+.045,yaw);
      addEllipsoid(solids,eye.x,eye.y,eye.z,.029,.025,.031,ink,yaw,figureOptions(),6);
    });

    const nose=localPoint(cx,cy,headForward*1.055,0,cz-.005,yaw);
    addEllipsoid(solids,nose.x,nose.y,nose.z,.04,.032,.05,mixHex(skin,"#FFF8EA",.16),yaw,figureOptions(),6);

    const mouthStart=localPoint(cx,cy,headForward*1.015,-.042,cz-.085,yaw);
    const mouthEnd=localPoint(cx,cy,headForward*1.015,.042,cz-.085,yaw);
    addTube(solids,mouthStart,mouthEnd,.008,"#70463D",8);

    [-1,1].forEach((sideSign)=>{
      const ear=localPoint(cx,cy,0,sideSign*headSide*.98,cz,yaw);
      addEllipsoid(solids,ear.x,ear.y,ear.z,.035,.04,.065,skin,yaw,figureOptions(),6);
    });
  }

  function addHead(cx,cy,cz,skin,hair,forwardRadius=.15,sideRadius=.17,zRadius=.2,yaw=personYaw) {
    const headForward=forwardRadius*1.2;
    const headSide=sideRadius*1.16;
    const headZ=zRadius*1.12;
    addEllipsoid(solids,cx,cy,cz,headForward,headSide,headZ,skin,yaw);
    // ── L'attaccatura dei capelli ────────────────────────────────────────
    // La calotta stava arretrata di mezzo raggio e ne era larga 0,88: il suo
    // bordo davanti arrivava a 0,38 del raggio della testa, cioe' a meta'
    // cranio. Da davanti — che e' come si guardano quasi sempre — erano tutti
    // stempiati fino alla sommita', con una fronte alta il doppio del normale.
    // Ora la calotta e' arretrata appena (0,18) ed e' larga quanto la testa:
    // il bordo cade a 0,80 del raggio, cioe' subito sopra le sopracciglia, che
    // e' dove sta l'attaccatura in una faccia vera. Gli occhi restano davanti
    // (stanno a 1,025) e non finiscono sotto la frangia.
    const hairCenter=localPoint(cx,cy,-headForward*.18,0,cz+headZ*.46,yaw);
    addEllipsoid(solids,hairCenter.x,hairCenter.y,hairCenter.z,headForward*.98,headSide*1.04,headZ*.56,hair,yaw);
    addFaceDetails(cx,cy,cz,skin,headForward,headSide,yaw);
  }

  function addShoe(cx,cy,side,z,colour=CAST.shoe,yaw=personYaw,scale=1,forwardOffset=0) {
    const heel=localPoint(cx,cy,-.015+forwardOffset,side,z,yaw);
    const toe=localPoint(cx,cy,.125+forwardOffset,side,z+.008,yaw);
    addEllipsoid(solids,heel.x,heel.y,z+.055*scale,.095*scale,.087*scale,.062*scale,colour,yaw,figureOptions(),8);
    addEllipsoid(solids,toe.x,toe.y,z+.052*scale,.13*scale,.09*scale,.058*scale,colour,yaw,figureOptions(),8);
  }

  function addElder3D(cx,cy,yaw=personYaw) {
    addContactShadow(cx,cy,.46,.48,yaw);
    addShoe(cx,cy,-.14,.245,"#5E564A",yaw,.95,.1);
    addShoe(cx,cy,.14,.245,"#5E564A",yaw,.95,-.055);
    addTaperedTube(solids,localPoint(cx,cy,0,-.14,.58,yaw),localPoint(cx,cy,.1,-.14,.31,yaw),.075,.058,CAST.skinLight);
    addTaperedTube(solids,localPoint(cx,cy,0,.14,.58,yaw),localPoint(cx,cy,-.055,.14,.31,yaw),.075,.058,CAST.skinLight);
    addRoundFrustum(solids,cx,cy,.68,.48,.48,.34,.34,1.22,figureMaterial(CAST.elderSkirt,"#A19076","#8D7E67","#C8B89A"),yaw,16);
    addRoundFrustum(solids,cx,cy,.47,.34,.54,.38,1.16,1.55,figureMaterial(CAST.elderTop,"#829A85","#718676","#B4C1AE"),yaw,16);
    addRoundFrustum(solids,cx,cy,.37,.29,.42,.31,1.46,1.56,figureMaterial("#748B78"),yaw,14);
    addTaperedTube(solids,point(cx,cy,1.54),point(cx,cy,1.65),.082,.072,CAST.skinLight,10);
    addHead(cx,cy,1.78,CAST.skinLight,CAST.greyHair,.15,.17,.2,yaw);

    const leftShoulder=localPoint(cx,cy,0,-.29,1.47,yaw);
    const leftElbow=localPoint(cx,cy,.02,-.36,1.17,yaw);
    const leftHand=localPoint(cx,cy,.03,-.4,.94,yaw);
    addTaperedTube(solids,leftShoulder,leftElbow,.095,.072,CAST.elderTop);
    addJoint(leftElbow,.074,CAST.elderTop,yaw);
    addTaperedTube(solids,leftElbow,leftHand,.066,.048,CAST.skinLight);
    addHand(leftHand,CAST.skinLight,yaw,-1,1.02);
    const rightShoulder=localPoint(cx,cy,0,.29,1.47,yaw);
    const rightElbow=localPoint(cx,cy,.04,.37,1.2,yaw);
    const rightHand=localPoint(cx,cy,.02,.42,.98,yaw);
    addTaperedTube(solids,rightShoulder,rightElbow,.095,.072,CAST.elderTop);
    addJoint(rightElbow,.074,CAST.elderTop,yaw);
    addTaperedTube(solids,rightElbow,rightHand,.066,.048,CAST.skinLight);
    addHand(rightHand,CAST.skinLight,yaw,1,1.02);

    const caneBottom=localPoint(cx,cy,.01,-.47,.25,yaw);
    const caneTop=localPoint(cx,cy,.01,-.47,1.02,yaw);
    addTube(solids,caneBottom,caneTop,.025,CAST.cane,6);
    addTube(solids,caneTop,leftHand,.025,CAST.cane,6);

    addRoundFrustum(solids,cx,cy,.64,.57,.64,.57,1.94,2.0,figureMaterial(CAST.hat,"#BCA979","#A99569","#E3D4AB"),yaw,16);
    addRoundFrustum(solids,cx,cy,.4,.34,.3,.27,1.98,2.15,figureMaterial(CAST.hat,"#BCA979","#A99569","#E3D4AB"),yaw,16);
  }

  // ── La stessa signora, seduta ──────────────────────────────────────────
  // Quando arrivano le sedute lei si siede: e' il modo piu' diretto di dire
  // che cosa serve una panchina. Non e' un personaggio nuovo, e' la stessa
  // persona in un'altra posa, quindi la si riconosce.
  function addElderSeated3D(cx,cy,yaw=personYaw) {
    addContactShadow(cx,cy,.52,.46,yaw);
    const seatZ = benchSeatZ() + .07;   // il corpo appoggia sopra le doghe
    // Piedi a terra, ginocchia avanti: le cosce orizzontali sono cio' che
    // fa leggere "seduta" e non "in piedi dietro una panchina".
    for (const side of [-.15,.15]) {
      addShoe(cx,cy,side,.245,"#5E564A",yaw,.95,.44);
      const hip=localPoint(cx,cy,-.04,side,seatZ+.02,yaw);
      const knee=localPoint(cx,cy,.44,side,seatZ,yaw);
      const ankle=localPoint(cx,cy,.46,side,.32,yaw);
      addTaperedTube(solids,hip,knee,.115,.095,CAST.elderSkirt);
      addJoint(knee,.093,CAST.elderSkirt,yaw);
      addTaperedTube(solids,knee,ankle,.088,.068,CAST.skinLight);
    }
    addRoundFrustum(solids,cx,cy,.66,.5,.52,.38,seatZ,seatZ+.3,
      figureMaterial(CAST.elderSkirt,"#A19076","#8D7E67","#C8B89A"),yaw,16);
    addRoundFrustum(solids,cx,cy,.5,.36,.56,.4,seatZ+.26,seatZ+.62,
      figureMaterial(CAST.elderTop,"#829A85","#718676","#B4C1AE"),yaw,16);
    addRoundFrustum(solids,cx,cy,.38,.3,.42,.31,seatZ+.56,seatZ+.66,
      figureMaterial("#748B78"),yaw,14);
    addTaperedTube(solids,point(cx,cy,seatZ+.64),point(cx,cy,seatZ+.74),.082,.072,CAST.skinLight,10);
    addHead(cx,cy,seatZ+.87,CAST.skinLight,CAST.greyHair,.15,.17,.2,yaw);
    addRoundFrustum(solids,cx,cy,.64,.57,.64,.57,seatZ+1.03,seatZ+1.09,
      figureMaterial(CAST.hat,"#BCA979","#A99569","#E3D4AB"),yaw,16);
    addRoundFrustum(solids,cx,cy,.4,.34,.3,.27,seatZ+1.07,seatZ+1.24,
      figureMaterial(CAST.hat,"#BCA979","#A99569","#E3D4AB"),yaw,16);

    // Braccia appoggiate in grembo, e il bastone che riposa contro la seduta.
    for (const s of [-1,1]) {
      const shoulder=localPoint(cx,cy,0,s*.29,seatZ+.56,yaw);
      const elbow=localPoint(cx,cy,.14,s*.33,seatZ+.3,yaw);
      const hand=localPoint(cx,cy,.34,s*.18,seatZ+.16,yaw);
      addTaperedTube(solids,shoulder,elbow,.095,.072,CAST.elderTop);
      addJoint(elbow,.074,CAST.elderTop,yaw);
      addTaperedTube(solids,elbow,hand,.066,.048,CAST.skinLight);
      addHand(hand,CAST.skinLight,yaw,s,1.02);
    }
    addTube(solids,localPoint(cx,cy,.34,-.48,.25,yaw),localPoint(cx,cy,-.02,-.44,seatZ+.26,yaw),.025,CAST.cane,6);
  }

  function addAdult3D(cx,cy,yaw=personYaw) {
    addContactShadow(cx,cy,.4,.37,yaw);
    addShoe(cx,cy,-.13,.245,CAST.shoe,yaw);
    addShoe(cx,cy,.13,.245,CAST.shoe,yaw);
    [-.13,.13].forEach((side)=>{
      const ankle=localPoint(cx,cy,.02,side,.32,yaw);
      const knee=localPoint(cx,cy,0,side,.61,yaw);
      const hip=localPoint(cx,cy,0,side,.9,yaw);
      addTaperedTube(solids,hip,knee,.105,.088,CAST.blueGrey);
      addJoint(knee,.09,CAST.blueGrey,yaw);
      addTaperedTube(solids,knee,ankle,.085,.068,CAST.blueGrey);
    });
    addRoundFrustum(solids,cx,cy,.43,.31,.42,.31,.84,1.12,figureMaterial(CAST.coral),yaw,16);
    addRoundFrustum(solids,cx,cy,.42,.31,.57,.38,1.1,1.54,figureMaterial(CAST.coral),yaw,18);
    addRoundFrustum(solids,cx,cy,.38,.28,.34,.26,1.48,1.57,figureMaterial("#A96F60"),yaw,14);
    addTaperedTube(solids,point(cx,cy,1.53),point(cx,cy,1.64),.078,.068,CAST.skinWarm,10);
    addHead(cx,cy,1.77,CAST.skinWarm,CAST.hair,.15,.17,.205,yaw);

    const l0=localPoint(cx,cy,0,-.3,1.46,yaw),l1=localPoint(cx,cy,.02,-.39,1.16,yaw),l2=localPoint(cx,cy,.06,-.37,.92,yaw);
    const r0=localPoint(cx,cy,0,.3,1.46,yaw),r1=localPoint(cx,cy,.04,.38,1.13,yaw),r2=localPoint(cx,cy,.07,.43,.84,yaw);
    addTaperedTube(solids,l0,l1,.092,.068,CAST.coral); addJoint(l1,.07,CAST.coral,yaw); addTaperedTube(solids,l1,l2,.062,.047,CAST.skinWarm);
    addTaperedTube(solids,r0,r1,.092,.068,CAST.coral); addJoint(r1,.07,CAST.coral,yaw); addTaperedTube(solids,r1,r2,.062,.047,CAST.skinWarm);
    addHand(l2,CAST.skinWarm,yaw,-1);
    addHand(r2,CAST.skinWarm,yaw,1);
  }

  function addChild3D(cx,cy,yaw=personYaw) {
    addContactShadow(cx,cy,.27,.25,yaw);
    addShoe(cx,cy,-.09,.245,CAST.shoe,yaw,.72);
    addShoe(cx,cy,.09,.245,CAST.shoe,yaw,.72);
    [-.09,.09].forEach((side)=>{
      const ankle=localPoint(cx,cy,0,side,.29,yaw),knee=localPoint(cx,cy,0,side,.45,yaw),hip=localPoint(cx,cy,0,side,.66,yaw);
      addTaperedTube(solids,hip,knee,.067,.057,CAST.skinLight,8);
      addJoint(knee,.058,CAST.skinLight,yaw);
      addTaperedTube(solids,knee,ankle,.055,.043,CAST.skinLight,8);
    });
    addRoundFrustum(solids,cx,cy,.3,.23,.31,.24,.59,.82,figureMaterial(CAST.childYellow),yaw,14);
    addRoundFrustum(solids,cx,cy,.31,.24,.37,.28,.8,1.09,figureMaterial(CAST.childYellow),yaw,16);
    addRoundFrustum(solids,cx,cy,.27,.21,.24,.2,1.04,1.11,figureMaterial("#C49A52"),yaw,12);
    addTaperedTube(solids,point(cx,cy,1.07),point(cx,cy,1.16),.055,.047,CAST.skinLight,8);
    addHead(cx,cy,1.27,CAST.skinLight,CAST.hairDark,.105,.12,.15,yaw);
    const l0=localPoint(cx,cy,0,-.2,1.0,yaw),l1=localPoint(cx,cy,.02,-.25,.84,yaw);
    const r0=localPoint(cx,cy,0,.2,1.0,yaw),r1=localPoint(cx,cy,.02,.3,.8,yaw);
    addTaperedTube(solids,l0,l1,.06,.043,CAST.childYellow,8); addTaperedTube(solids,r0,r1,.06,.043,CAST.childYellow,8);
    addHand(l1,CAST.skinLight,yaw,-1,.78);
    addHand(r1,CAST.skinLight,yaw,1,.78);
  }

  // ── Le ruote restano SOLIDE ────────────────────────────────────────────
  // Erano state ridotte a dischi piatti per risparmiare poligoni. Un disco
  // ha una faccia sola: ruotando di la', il back-face culling lo toglie di
  // scena e la ruota sparisce. Un toro e' chiuso, quindi da qualunque
  // angolo c'e' sempre una faccia rivolta a chi guarda. Costa di piu' ed e'
  // la scelta giusta: qui conta che ci sia tutto, non che sia rapido.
  function addWheel(cx,cy,forward,side,centerZ,radius,yaw=personYaw) {
    const segments=segCount(14,8);
    const ringPoints=Array.from({length:segments},(_,i)=>{
      const a=i/segments*Math.PI*2;
      return localPoint(cx,cy,forward+Math.cos(a)*radius,side,centerZ+Math.sin(a)*radius,yaw);
    });
    for (let i=0;i<segments;i++) addTube(solids,ringPoints[i],ringPoints[(i+1)%segments],.035,CAST.shoe,5);
    const hub=localPoint(cx,cy,forward,side,centerZ,yaw);
    // I raggi sono uno ogni due settori: contarli cosi', invece che con una
    // lista di indici fissi, li tiene proporzionati anche quando la ruota
    // viene tassellata piu' fitta o piu' rada.
    for (let i=0;i<segments;i+=2) addTube(solids,hub,ringPoints[i],.013,CAST.metalHi,5);
    addEllipsoid(solids,hub.x,hub.y,hub.z,.055,.045,.055,CAST.metal,yaw,figureOptions(),8);
  }

  function addWheelchair3D(cx,cy,yaw=personYaw) {
    addContactShadow(cx,cy,.85,.62,yaw);
    addWheel(cx,cy,-.06,-.4,.72,.48,yaw);
    addWheel(cx,cy,-.06,.4,.72,.48,yaw);
    addWheel(cx,cy,.58,-.36,.34,.14,yaw);
    addWheel(cx,cy,.58,.36,.34,.14,yaw);

    const seat=localPoint(cx,cy,.02,0,.75,yaw);
    addRoundFrustum(solids,seat.x,seat.y,.72,.62,.7,.59,.72,.86,figureMaterial(CAST.chairOlive),yaw,16);
    const back=localPoint(cx,cy,-.27,0,1.08,yaw);
    addOrientedBox(solids,back.x,back.y,.68,.13,.7,figureMaterial(CAST.chairOlive,"#6F7D55","#5E6B48","#A3AF87"),.73,yaw);

    [-.31,.31].forEach((side)=>{
      const postBottom=localPoint(cx,cy,-.34,side,.76,yaw);
      const postTop=localPoint(cx,cy,-.34,side,1.52,yaw);
      const handleEnd=localPoint(cx,cy,-.52,side,1.52,yaw);
      addTube(solids,postBottom,postTop,.024,CAST.metal,8);
      addTube(solids,postTop,handleEnd,.026,CAST.metal,8);
    });

    addRoundFrustum(solids,cx,cy,.47,.33,.46,.33,.83,1.08,figureMaterial(CAST.chairBlue),yaw,16);
    addRoundFrustum(solids,cx,cy,.46,.33,.53,.36,1.06,1.42,figureMaterial(CAST.chairBlue),yaw,18);
    addRoundFrustum(solids,cx,cy,.35,.25,.32,.24,1.37,1.44,figureMaterial("#627F91"),yaw,14);
    addTaperedTube(solids,point(cx,cy,1.39),point(cx,cy,1.51),.073,.063,CAST.skinCopper,10);
    addHead(cx,cy,1.64,CAST.skinCopper,CAST.hair,.145,.16,.195,yaw);
    const arm0=localPoint(cx,cy,0,-.28,1.33,yaw),arm1=localPoint(cx,cy,.08,-.37,1.05,yaw),hand=localPoint(cx,cy,.22,-.35,.91,yaw);
    addTaperedTube(solids,arm0,arm1,.086,.064,CAST.chairBlue); addJoint(arm1,.066,CAST.chairBlue,yaw); addTaperedTube(solids,arm1,hand,.058,.045,CAST.skinCopper);
    addHand(hand,CAST.skinCopper,yaw,-1,.95);
    const armR0=localPoint(cx,cy,0,.28,1.33,yaw),armR1=localPoint(cx,cy,.08,.37,1.05,yaw),handR=localPoint(cx,cy,.22,.35,.91,yaw);
    addTaperedTube(solids,armR0,armR1,.086,.064,CAST.chairBlue); addJoint(armR1,.066,CAST.chairBlue,yaw); addTaperedTube(solids,armR1,handR,.058,.045,CAST.skinCopper);
    addHand(handR,CAST.skinCopper,yaw,1,.95);

    [-.14,.14].forEach((side)=>{
      const hip=localPoint(cx,cy,.08,side,.86,yaw);
      const knee=localPoint(cx,cy,.42,side,.66,yaw);
      const ankle=localPoint(cx,cy,.55,side,.36,yaw);
      addTaperedTube(solids,hip,knee,.105,.085,CAST.chairOlive);
      addJoint(knee,.087,CAST.chairOlive,yaw);
      addTaperedTube(solids,knee,ankle,.08,.06,CAST.chairOlive);
      const foot=localPoint(cx,cy,.66,side,.29,yaw);
      addTaperedTube(solids,ankle,foot,.06,.052,CAST.shoe,8);
      const footrest=localPoint(cx,cy,.7,side,.245,yaw);
      addOrientedBox(solids,footrest.x,footrest.y,.19,.27,.035,figureMaterial(CAST.metal),.23,yaw);
    });
  }

  function addPregnant3D(cx,cy,yaw=personYaw) {
    addContactShadow(cx,cy,.47,.46,yaw);
    addShoe(cx,cy,-.14,.245,CAST.brownShoe,yaw,.9);
    addShoe(cx,cy,.14,.245,CAST.brownShoe,yaw,.9);
    addTaperedTube(solids,localPoint(cx,cy,0,-.14,.55,yaw),localPoint(cx,cy,0,-.14,.31,yaw),.075,.057,CAST.skinDeep);
    addTaperedTube(solids,localPoint(cx,cy,0,.14,.55,yaw),localPoint(cx,cy,0,.14,.31,yaw),.075,.057,CAST.skinDeep);
    addRoundFrustum(solids,cx,cy,.64,.5,.47,.36,.38,1.45,figureMaterial(CAST.pregnant,"#A97069","#925E59","#D6A49A"),yaw,16);
    const belly=localPoint(cx,cy,.18,0,1.08,yaw);
    addEllipsoid(solids,belly.x,belly.y,belly.z,.32,.31,.38,CAST.pregnant,yaw);
    addRoundFrustum(solids,cx,cy,.36,.27,.33,.25,1.4,1.49,figureMaterial("#AB716B"),yaw,14);
    addTaperedTube(solids,point(cx,cy,1.45),point(cx,cy,1.57),.078,.067,CAST.skinDeep,10);
    addHead(cx,cy,1.72,CAST.skinDeep,CAST.hairDark,.15,.17,.205,yaw);
    const bun=localPoint(cx,cy,-.1,-.18,1.9,yaw);
    addEllipsoid(solids,bun.x,bun.y,bun.z,.11,.12,.12,CAST.hairDark,yaw);

    const raisedShoulder=localPoint(cx,cy,0,-.28,1.37,yaw);
    const raisedElbow=localPoint(cx,cy,.04,-.48,1.6,yaw);
    const raisedHand=localPoint(cx,cy,.12,-.27,1.88,yaw);
    addTaperedTube(solids,raisedShoulder,raisedElbow,.092,.069,CAST.pregnant);
    addJoint(raisedElbow,.071,CAST.pregnant,yaw);
    addTaperedTube(solids,raisedElbow,raisedHand,.061,.046,CAST.skinDeep);
    addHand(raisedHand,CAST.skinDeep,yaw,-1);

    const lowShoulder=localPoint(cx,cy,0,.28,1.36,yaw);
    const lowElbow=localPoint(cx,cy,.16,.39,1.14,yaw);
    const lowHand=localPoint(cx,cy,.4,.16,1.07,yaw);
    addTaperedTube(solids,lowShoulder,lowElbow,.092,.069,CAST.pregnant);
    addJoint(lowElbow,.071,CAST.pregnant,yaw);
    addTaperedTube(solids,lowElbow,lowHand,.061,.046,CAST.skinDeep);
    addHand(lowHand,CAST.skinDeep,yaw,1);
  }

  function addPregnantSeated3D(cx,cy,yaw=personYaw) {
    const seatZ = benchSeatZ() + .04;
    addContactShadow(cx,cy,.54,.52,yaw);
    for (const side of [-.15,.15]) {
      addShoe(cx,cy,side,.245,CAST.brownShoe,yaw,.9,.42);
      const hip=localPoint(cx,cy,-.04,side,seatZ+.02,yaw);
      const knee=localPoint(cx,cy,.43,side,seatZ,yaw);
      const ankle=localPoint(cx,cy,.45,side,.32,yaw);
      addTaperedTube(solids,hip,knee,.105,.088,CAST.pregnant);
      addJoint(knee,.087,CAST.pregnant,yaw);
      addTaperedTube(solids,knee,ankle,.078,.058,CAST.skinDeep);
    }
    addRoundFrustum(solids,cx,cy,.66,.5,.5,.38,seatZ,seatZ+.46,
      figureMaterial(CAST.pregnant,"#A97069","#925E59","#D6A49A"),yaw,10);
    const belly=localPoint(cx,cy,.22,0,seatZ+.34,yaw);
    addEllipsoid(solids,belly.x,belly.y,belly.z,.3,.29,.31,CAST.pregnant,yaw);
    addRoundFrustum(solids,cx,cy,.44,.34,.39,.3,seatZ+.4,seatZ+.72,
      figureMaterial(CAST.pregnant,"#A97069","#925E59","#D6A49A"),yaw,10);
    addTaperedTube(solids,point(cx,cy,seatZ+.7),point(cx,cy,seatZ+.8),.075,.064,CAST.skinDeep,6);
    addHead(cx,cy,seatZ+.93,CAST.skinDeep,CAST.hairDark,.145,.165,.2,yaw);
    const bun=localPoint(cx,cy,-.1,-.18,seatZ+1.11,yaw);
    addEllipsoid(solids,bun.x,bun.y,bun.z,.1,.11,.11,CAST.hairDark,yaw,figureOptions(),8);
    for (const side of [-1,1]) {
      const shoulder=localPoint(cx,cy,0,side*.28,seatZ+.62,yaw);
      const elbow=localPoint(cx,cy,.14,side*.32,seatZ+.4,yaw);
      const hand=localPoint(cx,cy,.34,side*.14,seatZ+.29,yaw);
      addTaperedTube(solids,shoulder,elbow,.087,.064,CAST.pregnant);
      addJoint(elbow,.066,CAST.pregnant,yaw);
      addTaperedTube(solids,elbow,hand,.056,.043,CAST.skinDeep);
      addHand(hand,CAST.skinDeep,yaw,side,.92);
    }
  }

  return {
    point,
    vAdd, vSub, vScale, vCross, vLength, vNormal,
    localPoint, localNormal, figureMaterial, mixHex, surfaceTone,
    addRoundFrustum, addOrientedFrustum, addOrientedBox, addEllipsoid,
    addTube, addTaperedTube, addJoint, addHand, addContactShadow,
    addFaceDetails, addHead, addShoe, addWheel,
    addElder3D, addElderSeated3D, addAdult3D, addChild3D,
    addWheelchair3D, addPregnant3D, addPregnantSeated3D,
  };
}

/** I personaggi che si possono chiedere per nome, con l'altezza in metri e
 *  l'impronta a terra (semilati, in metri) che serve a chi deve buttare
 *  un'ombra sotto ai piedi. */
export const CAST_FIGURES = {
  elder:          { build: "addElder3D",         height: 2.15, footprint: [.30, .30] },
  elderSeated:    { build: "addElderSeated3D",   height: 1.76, footprint: [.42, .30] },
  adult:          { build: "addAdult3D",         height: 1.98, footprint: [.26, .26] },
  child:          { build: "addChild3D",         height: 1.42, footprint: [.19, .18] },
  wheelchair:     { build: "addWheelchair3D",    height: 1.84, footprint: [.62, .45] },
  pregnant:       { build: "addPregnant3D",      height: 1.93, footprint: [.32, .32] },
  pregnantSeated: { build: "addPregnantSeated3D",height: 1.63, footprint: [.44, .34] },
};
