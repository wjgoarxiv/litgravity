import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const humanizer = path.resolve(root, '../lit-humanizer/scripts/detect.mjs');
const decode = (s) => s.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&#39;', "'");
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|' + "'([^']*)'" + ')/g)].map((m) => [m[1], decode(m[3] ?? m[4] ?? '')]));
const strip = (s) => decode(s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const escText = (s) => s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ');
function glyphWidth(text, fontSize) {
  let units = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) units += 0.28;
    else if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(ch)) units += 0.98;
    else if (/[ilI.,:;!|]/.test(ch)) units += 0.32;
    else if (/[MW@#%]/.test(ch)) units += 0.82;
    else units += 0.56;
  }
  return units * fontSize;
}
function boxesFromSvg(svg) {
  const boxes = [];
  const texts = [];
  for (const m of svg.matchAll(/<rect\b([^>]*)\/?\s*>/gi)) {
    const a = attrs(m[1]);
    const x = Number(a.x || 0), y = Number(a.y || 0), w = Number(a.width || 0), h = Number(a.height || 0);
    if (w > 2 && h > 2) boxes.push({ kind: 'rect', x, y, w, h, fill: a.fill || '' });
  }
  for (const m of svg.matchAll(/<circle\b([^>]*)\/?\s*>/gi)) {
    const a = attrs(m[1]), r = Number(a.r || 0), cx = Number(a.cx || 0), cy = Number(a.cy || 0);
    if (r > 0) boxes.push({ kind: 'circle', x: cx-r, y: cy-r, w: 2*r, h: 2*r });
  }
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)) {
    const a = attrs(m[1]);
    const label = strip(m[2]);
    if (!label) continue;
    const size = Number(a['font-size'] || 16);
    const width = glyphWidth(label, size);
    const anchor = a['text-anchor'] || 'start';
    const x = Number(a.x || 0) - (anchor === 'middle' ? width/2 : anchor === 'end' ? width : 0);
    const y = Number(a.y || 0) - size*0.82;
    texts.push({ kind:'text', label, x, y, w:width, h:size*1.22, fill:a.fill || '#000000', fontSize:size });
  }
  return { boxes, texts };
}
function intersects(a,b) {
  return a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
}
function contains(a,b) {
  return a.x <= b.x+1 && a.y <= b.y+1 && a.x+a.w >= b.x+b.w-1 && a.y+a.h >= b.y+b.h-1;
}
function contrastRatio(fg, bg) {
  const hex = (s) => {
    if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s)) return null;
    let v=s.slice(1); if(v.length===3) v=[...v].map((x)=>x+x).join('');
    return [0,2,4].map((i)=>parseInt(v.slice(i,i+2),16)/255).map((x)=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  };
  const f=hex(fg), b=hex(bg);
  if(!f||!b) return null;
  const lum=(v)=>0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
  const l1=lum(f), l2=lum(b);
  return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
}
function lineCrossings(svg) {
  const routes=[];
  for(const m of svg.matchAll(/<line\b([^>]*)\/?\s*>/gi)) {
    const a=attrs(m[1]);
    if(a['data-lifeline-for'])continue;
    const values=['x1','y1','x2','y2'].map((k)=>Number(a[k]));
    if(values.every(Number.isFinite)) routes.push([[values[0],values[1],values[2],values[3]]]);
  }
  const tokens=(d)=>d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?|[a-zA-Z]/gi)||[];
  const pathSegments=(d)=>{
    const parts=tokens(d),segments=[];let i=0,cmd='',x=0,y=0,sx=0,sy=0;
    const number=()=>Number(parts[i++]);
    const point=(relative)=>{const px=number(),py=number();return relative?[x+px,y+py]:[px,py];};
    while(i<parts.length){
      if(/^[a-z]$/i.test(parts[i]))cmd=parts[i++];
      if(!cmd)break;
      const relative=cmd===cmd.toLowerCase(),upper=cmd.toUpperCase();
      if(upper==='Z'){if(x!==sx||y!==sy)segments.push([x,y,sx,sy]);x=sx;y=sy;cmd='';continue;}
      if(upper==='M'||upper==='L'){
        if(i+1>=parts.length||/^[a-z]$/i.test(parts[i])){cmd='';continue;}
        const [nx,ny]=point(relative);
        if(upper==='M'){x=nx;y=ny;sx=x;sy=y;cmd=relative?'l':'L';}
        else {segments.push([x,y,nx,ny]);x=nx;y=ny;}
      }else if(upper==='H'){
        if(i>=parts.length||/^[a-z]$/i.test(parts[i])){cmd='';continue;}
        const nx=number()+(relative?x:0);segments.push([x,y,nx,y]);x=nx;
      }else if(upper==='V'){
        if(i>=parts.length||/^[a-z]$/i.test(parts[i])){cmd='';continue;}
        const ny=number()+(relative?y:0);segments.push([x,y,x,ny]);y=ny;
      }else if(upper==='C'){
        if(i+5>=parts.length||/^[a-z]$/i.test(parts[i])){cmd='';continue;}
        const c1=point(relative),c2=point(relative),end=point(relative),start=[x,y];let previous=start;
        for(let step=1;step<=12;step++){
          const t=step/12,u=1-t;
          const next=[u*u*u*start[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*end[0],u*u*u*start[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*end[1]];
          segments.push([previous[0],previous[1],next[0],next[1]]);previous=next;
        }
        x=end[0];y=end[1];
      }else{
        while(i<parts.length&&!/^[a-z]$/i.test(parts[i]))i++;
        cmd='';
      }
    }
    return segments;
  };
  const pathsOnly=svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/gi,'');
  for(const m of pathsOnly.matchAll(/<path\b([^>]*)>/gi)){
    const a=attrs(m[1]);
    if(!a.d||(!a['marker-end']&&!a['marker-start']&&a.fill!=='none'))continue;
    const segments=pathSegments(a.d);
    if(segments.length)routes.push(segments);
  }
  let count=0;
  const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<routes.length;i++) for(let j=i+1;j<routes.length;j++) {
    let crossing=false;
    for(const first of routes[i]) for(const second of routes[j]){
      const a=[first[0],first[1]],b=[first[2],first[3]],c=[second[0],second[1]],d=[second[2],second[3]];
      const shared=[a,b].some(p=>[c,d].some(q=>Math.abs(p[0]-q[0])<2&&Math.abs(p[1]-q[1])<2));
      if(!shared&&orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0){crossing=true;break;}
    }
    if(crossing)count++;
  }
  return count;
}
function sourceMetrics(source, sourcePath='<stdin>') {
  const svgMatches=[...source.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi)];
  const svg=svgMatches.map((m)=>m[0]).join('\n');
  const svgAttrs=svgMatches[0] ? attrs(svgMatches[0][1]) : {};
  const viewBox=(svgAttrs.viewBox||'').trim().split(/[\s,]+/).map(Number);
  const view=viewBox.length===4 ? {x:viewBox[0],y:viewBox[1],w:viewBox[2],h:viewBox[3]} : null;
  const {boxes,texts}=boxesFromSvg(svg);
  const overflow=[];
  if(view) {
    for(const b of [...boxes,...texts]) if(b.x<view.x-1||b.y<view.y-1||b.x+b.w>view.x+view.w+1||b.y+b.h>view.y+view.h+1) overflow.push(b.label||b.kind);
  }
  let textOverlaps=0;
  for(let i=0;i<texts.length;i++) for(let j=i+1;j<texts.length;j++) if(intersects(texts[i],texts[j])) textOverlaps++;
  let objectOverlaps=0;
  const visibleBoxes=boxes.filter((b)=>!(view && b.w>=view.w-2 && b.h>=view.h-2));
  for(let i=0;i<visibleBoxes.length;i++) for(let j=i+1;j<visibleBoxes.length;j++) {
    const a=visibleBoxes[i],b=visibleBoxes[j];
    const vennPair=/diagram-venn-(?:light|dark|full)/.test(svgAttrs.id||'')&&a.kind==='circle'&&b.kind==='circle';
    if(!vennPair&&intersects(a,b)&&!contains(a,b)&&!contains(b,a)) objectOverlaps++;
  }
  const paper=([...svg.matchAll(/<rect\b([^>]*)\/?\s*>/gi)].map((m)=>{
    const a=attrs(m[1]);
    const fill=a.fill||'#ffffff';
    const x=Number(a.x||0),y=Number(a.y||0),w=Number(a.width||0),h=Number(a.height||0);
    return {fill,area:w*h,visible:fill.toLowerCase()!=='none'&&fill.toLowerCase()!=='transparent',canvas:!!view&&x<=view.x+1&&y<=view.y+1&&w>=view.w-2&&h>=view.h-2};
  }).filter((rect)=>rect.visible).sort((a,b)=>Number(b.canvas)-Number(a.canvas)||b.area-a.area)[0]?.fill)||'#ffffff';
  const contrastFailures=[];
  for(const t of texts) {
    const ratio=contrastRatio(t.fill,paper);
    if(ratio!==null && ratio<4.5) contrastFailures.push({text:t.label,ratio:Number(ratio.toFixed(2))});
  }
  const fills=new Set([...svg.matchAll(/\b(?:fill|stroke)\s*=\s*["'](#[0-9a-f]{3,8})["']/gi)].map((m)=>m[1].toLowerCase()));
  const textContent=[...svg.matchAll(/<(?:text|title|desc)\b[^>]*>([\s\S]*?)<\/(?:text|title|desc)>/gi)].map((m)=>strip(m[1])).filter(Boolean).join('\n');
  const documentText=escText(source).replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]*>/g,' ');
  const htmlText=strip(documentText);
  const visibleText=[textContent,htmlText].filter(Boolean).join('\n');
  const fontFamilyPresent=/Pretendard/i.test(svg) && /Pretendard/i.test(source);
  const fontUrls=[...source.matchAll(/@font-face\b[\s\S]{0,250}?url\(\s*["']?([^"')]+)["']?\)/gi)].map((match)=>decode(match[1].trim()));
  const localFont=fontUrls.some((url)=>/^data:font\//i.test(url)||(!/^https?:\/\//i.test(url)&&/\.(?:woff2?|ttf|otf)(?:[?#].*)?$/i.test(url)));
  const fontFileValid=fontUrls.some((url)=>{
    if(/^data:font\//i.test(url))return true;
    if(/^https?:\/\//i.test(url)||sourcePath==='<stdin>')return false;
    const local=url.split(/[?#]/,1)[0];
    return fs.existsSync(path.resolve(path.dirname(path.resolve(sourcePath)),local));
  });
  const radiusLarge=[...svg.matchAll(/<rect\b([^>]*)\/?\s*>/gi)].filter((m)=>Number(attrs(m[1]).rx||0)>8).length;
  const hasShadow=/\bbox-shadow\s*:|filter\s*=\s*["']url\(#/i.test(source);
  return {
    source:sourcePath,
    hasSvg:svgMatches.length>0,
    viewBox:view,
    title: /<title\b[^>]*>[\s\S]*?<\/title>/i.test(svg),
    desc: /<desc\b[^>]*>[\s\S]*?<\/desc>/i.test(svg),
    roleImage:/\brole\s*=\s*["']img["']/i.test(svg),
    ariaLinked:!!svgAttrs['aria-labelledby'],
    textCount:texts.length,
    textOverlaps,
    objectOverlaps,
    offCanvas:overflow.length,
    offCanvasLabels:overflow.slice(0,12),
    arrowCrossings:lineCrossings(svg),
    contrastFailures,
    colors:fills.size,
    largeRadius:radiusLarge,
    hasShadow,
    fontFamilyPresent,
    localFont,
    fontFileValid,
    visibleText,
    type:svgAttrs.id||'',
    sourceBytes:Buffer.byteLength(source)
  };
}
function detectorFindings(visibleText) {
  const result=spawnSync(process.execPath,[humanizer,'--json','-'],{input:visibleText,encoding:'utf8',maxBuffer:1024*1024});
  if(result.error) throw result.error;
  let parsed;
  try { parsed=JSON.parse(result.stdout); } catch { throw new Error('Humanizer returned invalid JSON: '+result.stdout+' '+result.stderr); }
  return {exitCode:result.status,summary:parsed.summary||{},findings:parsed.findings||[],errors:parsed.errors||[]};
}
function analyzeSource(source, sourcePath) {
  const metrics=sourceMetrics(source,sourcePath);
  const humanizer=detectorFindings(metrics.visibleText);
  return {...metrics,humanizer};
}
function analyzeFile(file) {
  return analyzeSource(fs.readFileSync(file,'utf8'),file);
}
export { root, analyzeFile, analyzeSource, sourceMetrics, detectorFindings, contrastRatio };
