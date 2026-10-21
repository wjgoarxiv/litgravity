const BOUNDARY_EDGE_PADDING=4;
const BOUNDARY_EDGE_MIN_OVERLAP=12;
const ARROWHEAD_TARGET_TOLERANCE=2;

const decode=(s)=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&#39;',"'");
const attributes=(s)=>Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m)=>[m[1],decode(m[2]??m[3]??'')]));
const clean=(s)=>decode(s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
const widthOf=(text,size)=>[...text].reduce((n,c)=>n+(/\s/.test(c)?.28:/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(c)?.98:/[ilI.,:;!|]/.test(c)?.32:/[MW@#%]/.test(c)?.82:.56),0)*size;


function visibleSvgText(svg){
  return [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)].map((m)=>{
    const a=attributes(m[1]),label=clean(m[2]),size=Number(a['font-size']||16),textAnchor=a['text-anchor']||'start',anchor={x:Number(a.x||0),y:Number(a.y||0)},w=widthOf(label,size),x=anchor.x-(textAnchor==='middle'?w/2:textAnchor==='end'?w:0),y=anchor.y-size*.82;
    return {label,size,role:a['data-role']||'',anchor,edgeFor:a['data-edge-for']||'',boundaryFor:a['data-boundary-for']||a['data-group-for']||'',nodeFor:a['data-node-id']||'',x,y,w,h:size*1.22};
  }).filter((t)=>t.label);
}
function svgContent(source){return [...source.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)].map((m)=>m[0]).join('\n');}
function parseRoutes(svg){
  const routes=[];
  for(const m of svg.matchAll(/<(line|path)\b([^>]*)>/gi)){
    const a=attributes(m[2]); if(!a['data-from']||!a['data-to'])continue;
    let segments=[];
    if(m[1].toLowerCase()==='line'){
      const v=['x1','y1','x2','y2'].map((k)=>Number(a[k])); if(v.every(Number.isFinite))segments=[[v[0],v[1],v[2],v[3]]];
    }else if(a.d){
      const parts=a.d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];let i=0,cmd='',x=0,y=0,px=0,py=0;
      while(i<parts.length){if(/^[a-z]$/i.test(parts[i]))cmd=parts[i++];if(!cmd)break;const rel=cmd===cmd.toLowerCase(),up=cmd.toUpperCase();
        if(up==='M'||up==='L'){if(i+1>=parts.length||/^[a-z]$/i.test(parts[i])){cmd='';continue;}const nx=Number(parts[i++])+(rel?x:0),ny=Number(parts[i++])+(rel?y:0);if(up==='L')segments.push([x,y,nx,ny]);x=nx;y=ny;}
        else if(up==='H'){if(i>=parts.length||/^[a-z]$/i.test(parts[i])){cmd='';continue;}const nx=Number(parts[i++])+(rel?x:0);segments.push([x,y,nx,y]);x=nx;}
        else if(up==='V'){if(i>=parts.length||/^[a-z]$/i.test(parts[i])){cmd='';continue;}const ny=Number(parts[i++])+(rel?y:0);segments.push([x,y,x,ny]);y=ny;}
        else if(up==='C'){if(i+5>=parts.length||/^[a-z]$/i.test(parts[i])){cmd='';continue;}const p=(n)=>[Number(parts[n])+(rel?x:0),Number(parts[n+1])+(rel?y:0)],start=[x,y],c1=p(i),c2=p(i+2),end=p(i+4);i+=6;let previous=start;for(let step=1;step<=16;step++){const t=step/16,u=1-t,next=[u*u*u*start[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*end[0],u*u*u*start[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*end[1]];segments.push([previous[0],previous[1],next[0],next[1]]);previous=next;}x=end[0];y=end[1];}
        else {cmd='';while(i<parts.length&&!/^[a-z]$/i.test(parts[i]))i++;}
      }
    }
    if(segments.length)routes.push({from:a['data-from'],to:a['data-to'],label:a['data-label']||'',segments,markerStart:a['marker-start']||'',markerEnd:a['marker-end']||'',strokeWidth:Number(a['stroke-width']||1)});
  }
  return routes;
}
function rectangles(svg){
  const nodes=[];
  for(const m of svg.matchAll(/<rect\b([^>]*)\/?\s*>/gi)){
    const a=attributes(m[1]);if(!a['data-node-id'])continue;
    const box={id:a['data-node-id'],type:a['data-node-type']||'',outcomes:(a['data-outcomes']||'').split('|').map((value)=>value.trim()).filter(Boolean),fill:a.fill||'',display:a.display||'',x:Number(a.x||0),y:Number(a.y||0),w:Number(a.width||0),h:Number(a.height||0)};
    if(box.w>0&&box.h>0)nodes.push(box);
  }
  return nodes;
}
function segmentHitsBox(s,b,pad=0){
  const [x1,y1,x2,y2]=s,loX=Math.min(x1,x2),hiX=Math.max(x1,x2),loY=Math.min(y1,y2),hiY=Math.max(y1,y2),left=b.x-pad,right=b.x+b.w+pad,top=b.y-pad,bottom=b.y+b.h+pad;
  if(x1===x2)return x1>=left&&x1<=right&&hiY>=top&&loY<=bottom;
  if(y1===y2)return y1>=top&&y1<=bottom&&hiX>=left&&loX<=right;
  const steps=24;for(let i=0;i<=steps;i++){const t=i/steps,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;if(x>=left&&x<=right&&y>=top&&y<=bottom)return true;}return false;
}
function segmentHitsText(s,t,pad=1){
  const b={x:t.x-pad,y:t.y-pad,w:t.w+pad*2,h:t.h+pad*2};return segmentHitsBox(s,b,0);
}
function textOverlapsNode(text,node,pad=1){return text.x<node.x+node.w+pad&&text.x+text.w>node.x-pad&&text.y<node.y+node.h+pad&&text.y+text.h>node.y-pad;}
function gap(a,b){const dx=Math.max(0,a.x-(b.x+b.w),b.x-(a.x+a.w)),dy=Math.max(0,a.y-(b.y+b.h),b.y-(a.y+a.h));return Math.hypot(dx,dy);}

function boundaryOutlines(svg){
  const outlines=[];
  const add=(a)=>{
    const markers=['data-trust-boundary','data-boundary','data-boundary-name','data-group-boundary','data-group-name','data-group-label','data-group-id'];
    const classMarker=/\b(?:boundary|group)(?:[-_][\w-]+)?\b/i.test(a.class||'');
    if(!markers.some((key)=>Object.hasOwn(a,key))&&!classMarker)return;
    const labels=[a['data-trust-boundary'],a['data-boundary-name'],a['data-group-boundary'],a['data-group-name'],a['data-group-label']].filter((value)=>value&&value!=='true');
    const x=Number(a.x||0),y=Number(a.y||0),w=Number(a.width||0),h=Number(a.height||0);
    if(w>0&&h>0)outlines.push({id:a['data-group-id']||a.id||(a['data-boundary']!=='true'&&a['data-boundary'])||labels[0]||'outline',labels,x,y,w,h,strokeWidth:Number(a['stroke-width']||1)});
  };
  for(const match of svg.matchAll(/<rect\b([^>]*)\/?\s*>/gi))add(attributes(match[1]));
  for(const match of svg.matchAll(/<g\b([^>]*)>([\s\S]*?)<\/g>/gi)){
    const group=attributes(match[1]);
    if(!['data-trust-boundary','data-boundary','data-boundary-name','data-group-boundary','data-group-name','data-group-label','data-group-id'].some((key)=>Object.hasOwn(group,key)))continue;
    const rect=match[2].match(/<rect\b([^>]*)\/?\s*>/i);
    if(rect)add({...attributes(rect[1]),...group});
  }
  return outlines;
}

function pointSegmentDistance(point,segment){
  const [x1,y1,x2,y2]=segment,dx=x2-x1,dy=y2-y1,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((point.x-x1)*dx+(point.y-y1)*dy)/length)):0;
  return Math.hypot(point.x-(x1+t*dx),point.y-(y1+t*dy));
}
function routeDistance(point,route){return Math.min(...route.segments.map((segment)=>pointSegmentDistance(point,segment)));}
function isBoundaryLabel(text,outlines){return text.role==='boundary'||text.boundaryFor||outlines.some((outline)=>outline.labels.includes(text.label)||outline.id===text.boundaryFor);}
function outlineEdges(outline){return [[outline.x,outline.y,outline.x+outline.w,outline.y],[outline.x+outline.w,outline.y,outline.x+outline.w,outline.y+outline.h],[outline.x+outline.w,outline.y+outline.h,outline.x,outline.y+outline.h],[outline.x,outline.y+outline.h,outline.x,outline.y]];}
function textHitsOutline(text,outline){return outlineEdges(outline).some((edge)=>segmentHitsText(edge,text,outline.strokeWidth/2+.5));}
function segmentAlongOutline(segment,outline){
  const [x1,y1,x2,y2]=segment,loX=Math.min(x1,x2),hiX=Math.max(x1,x2),loY=Math.min(y1,y2),hiY=Math.max(y1,y2),right=outline.x+outline.w,bottom=outline.y+outline.h;
  if(Math.abs(y1-y2)<=1){const overlap=Math.min(hiX,right)-Math.max(loX,outline.x);return overlap>BOUNDARY_EDGE_MIN_OVERLAP&&(Math.abs(y1-outline.y)<=BOUNDARY_EDGE_PADDING||Math.abs(y1-bottom)<=BOUNDARY_EDGE_PADDING);}
  if(Math.abs(x1-x2)<=1){const overlap=Math.min(hiY,bottom)-Math.max(loY,outline.y);return overlap>BOUNDARY_EDGE_MIN_OVERLAP&&(Math.abs(x1-outline.x)<=BOUNDARY_EDGE_PADDING||Math.abs(x1-right)<=BOUNDARY_EDGE_PADDING);}
  return false;
}
function markerPathPoints(d){
  const parts=d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[],points=[];let i=0,cmd='',x=0,y=0;
  while(i<parts.length){if(/^[a-z]$/i.test(parts[i]))cmd=parts[i++];if(!cmd)break;const upper=cmd.toUpperCase(),relative=cmd===cmd.toLowerCase();
    if(upper==='M'||upper==='L'){if(i+1>=parts.length||/^[a-z]$/i.test(parts[i]))break;let nx=Number(parts[i++]),ny=Number(parts[i++]);if(relative){nx+=x;ny+=y;}x=nx;y=ny;points.push([x,y]);}
    else if(upper==='H'){if(i>=parts.length||/^[a-z]$/i.test(parts[i]))break;x=Number(parts[i++])+(relative?x:0);points.push([x,y]);}
    else if(upper==='V'){if(i>=parts.length||/^[a-z]$/i.test(parts[i]))break;y=Number(parts[i++])+(relative?y:0);points.push([x,y]);}
    else if(upper==='Z')cmd='';
    else {while(i<parts.length&&!/^[a-z]$/i.test(parts[i]))i++;cmd='';}
  }
  return points;
}
function markerDefinitions(svg){
  const markers=new Map();
  for(const match of svg.matchAll(/<marker\b([^>]*)>([\s\S]*?)<\/marker>/gi)){
    const a=attributes(match[1]),id=a.id;if(!id)continue;
    const points=[];
    for(const shape of match[2].matchAll(/<(path|polygon)\b([^>]*)>/gi)){
      const attrsForShape=attributes(shape[2]);
      if(shape[1].toLowerCase()==='polygon'){
        const values=(attrsForShape.points||'').match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];
        for(let i=0;i+1<values.length;i+=2)points.push([Number(values[i]),Number(values[i+1])]);
      }else if(attrsForShape.d){
        points.push(...markerPathPoints(attrsForShape.d));
      }
    }
    markers.set(id,{refX:Number(a.refX||0),refY:Number(a.refY||0),units:a.markerUnits||'strokeWidth',width:Number(a.markerWidth||0),height:Number(a.markerHeight||0),points,closed:/\bz\b/i.test(match[2])||/<polygon\b/i.test(match[2])});
  }
  return markers;
}
function markerOverlapsTarget(route,target,markers){
  const match=route.markerEnd.match(/url\(\s*["']?#([^\s)'"`]+)["']?\s*\)/i),marker=match&&markers.get(match[1]),segment=route.segments.at(-1);
  if(!segment)return false;
  const [x1,y1,x2,y2]=segment,length=Math.hypot(x2-x1,y2-y1)||1,ux=(x2-x1)/length,uy=(y2-y1)/length,nx=-uy,ny=ux;
  if(!marker?.points.length){const reach=route.strokeWidth;return segmentHitsBox([x2+ux*reach,y2+uy*reach,x2+ux*reach,y2+uy*reach],target,-1);}
  const scale=marker.units==='userSpaceOnUse'?1:route.strokeWidth;
  const points=marker.points.map(([x,y])=>[x2+ux*(x-marker.refX)*scale+nx*(y-marker.refY)*scale,y2+uy*(x-marker.refX)*scale+ny*(y-marker.refY)*scale]);
  if(points.some(([x,y])=>x>target.x+1&&x<target.x+target.w-1&&y>target.y+1&&y<target.y+target.h-1))return true;
  const segments=points.slice(1).map((point,index)=>[points[index][0],points[index][1],point[0],point[1]]);
  if(marker.closed&&points.length>2)segments.push([points.at(-1)[0],points.at(-1)[1],points[0][0],points[0][1]]);
  return segments.some((line)=>segmentHitsBox(line,target,-1));
}
function markerFor(route,edge,markers){
  const value=edge==='end'?route.markerEnd:route.markerStart,match=value.match(/url\(\s*["']?#([^\s)'"`]+)["']?\s*\)/i);
  return match?markers.get(match[1]):null;
}
function markerScale(marker,route){return marker.units==='userSpaceOnUse'?1:route.strokeWidth;}
function markerHeadLength(marker){
  if(!marker?.points.length)return 0;
  const xs=marker.points.map(([x])=>x);
  return Math.max(...xs)-Math.min(...xs);
}
function markerTip(route,marker,edge){
  const segment=edge==='end'?route.segments.at(-1):route.segments[0];
  if(!segment)return null;
  const [x1,y1,x2,y2]=segment,dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
  const anchor=edge==='end'?[x2,y2]:[x1,y1],direction=edge==='end'?1:-1;
  const forward=marker?.points.length?Math.max(...marker.points.map(([x])=>direction*(x-marker.refX)))*markerScale(marker,route):0;
  return [anchor[0]+direction*ux*forward,anchor[1]+direction*uy*forward];
}
function distanceToBoxBoundary(point,box){
  const [x,y]=point,candidates=[];
  if(y>=box.y-ARROWHEAD_TARGET_TOLERANCE&&y<=box.y+box.h+ARROWHEAD_TARGET_TOLERANCE)candidates.push(Math.abs(x-box.x),Math.abs(x-(box.x+box.w)));
  if(x>=box.x-ARROWHEAD_TARGET_TOLERANCE&&x<=box.x+box.w+ARROWHEAD_TARGET_TOLERANCE)candidates.push(Math.abs(y-box.y),Math.abs(y-(box.y+box.h)));
  if(candidates.length)return Math.min(...candidates);
  return Math.hypot(Math.max(box.x-x,0,x-(box.x+box.w)),Math.max(box.y-y,0,y-(box.y+box.h)));
}
function decisionBranchQuality(nodes,routes){
  const issues=[];
  for(const node of nodes.filter((item)=>item.type==='decision')){
    if(node.outcomes.length<2){issues.push('DECISION_OUTCOMES_MISSING '+node.id+' must name at least two outcomes');continue;}
    const labels=new Set(routes.filter((route)=>route.from===node.id).map((route)=>route.label).filter(Boolean));
    for(const outcome of node.outcomes)if(!labels.has(outcome))issues.push('DECISION_OUTCOME_MISSING '+node.id+' '+outcome);
    for(const label of labels)if(!node.outcomes.includes(label))issues.push('DECISION_OUTCOME_UNDECLARED '+node.id+' '+label);
  }
  return issues;
}

function routeLength(route){return route.segments.reduce((sum,[x1,y1,x2,y2])=>sum+Math.hypot(x2-x1,y2-y1),0);}
function routeBends(route){
  const directions=route.segments.map(([x1,y1,x2,y2])=>{const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);return length?{x:dx/length,y:dy/length}:null;}).filter(Boolean);
  let bends=0;
  for(let i=1;i<directions.length;i++)if(directions[i-1].x*directions[i].x+directions[i-1].y*directions[i].y<Math.SQRT1_2)bends++;
  return bends;
}
function routeManhattanDistance(route){
  const start=route.segments[0]?.slice(0,2),end=route.segments.at(-1)?.slice(2,4);
  return start&&end?Math.abs(start[0]-end[0])+Math.abs(start[1]-end[1])||null:null;
}
function alignedRouteKind(route,nodes){
  const from=nodes.find((node)=>node.id===route.from),to=nodes.find((node)=>node.id===route.to);
  if(!from||!to)return null;
  const sameRow=Math.abs(from.y+from.h/2-(to.y+to.h/2))<=1,sameColumn=Math.abs(from.x+from.w/2-(to.x+to.w/2))<=1;
  const horizontal=route.segments.every(([x1,y1,x2,y2])=>Math.abs(y1-y2)<=1),vertical=route.segments.every(([x1,y1,x2,y2])=>Math.abs(x1-x2)<=1);
  if(sameRow&&nodes.every((node)=>node===from||node===to||Math.abs(node.y+node.h/2-(from.y+from.h/2))>1||node.x+node.w/2<=Math.min(from.x+from.w/2,to.x+to.w/2)||node.x+node.w/2>=Math.max(from.x+from.w/2,to.x+to.w/2))&&!horizontal)return 'same-row';
  if(sameColumn&&nodes.every((node)=>node===from||node===to||Math.abs(node.x+node.w/2-(from.x+from.w/2))>1||node.y+node.h/2<=Math.min(from.y+from.h/2,to.y+to.h/2)||node.y+node.h/2>=Math.max(from.y+from.h/2,to.y+to.h/2))&&!vertical)return 'same-column';
  return null;
}
function routeCrossesBoundary(route,outline){
  const points=route.segments.flatMap(([x1,y1,x2,y2])=>[[x1,y1],[x2,y2],[(x1+x2)/2,(y1+y2)/2]]);
  const inside=points.some(([x,y])=>x>outline.x&&x<outline.x+outline.w&&y>outline.y&&y<outline.y+outline.h);
  const outside=points.some(([x,y])=>x<outline.x||x>outline.x+outline.w||y<outline.y||y>outline.y+outline.h);
  return inside&&outside;
}
function collinearOverlap(a,b){
  for(const [ax1,ay1,ax2,ay2] of a.segments)for(const [bx1,by1,bx2,by2] of b.segments){
    if(Math.abs(ay1-ay2)<=.5&&Math.abs(by1-by2)<=.5&&Math.abs(ay1-by1)<12){if(Math.min(Math.max(ax1,ax2),Math.max(bx1,bx2))-Math.max(Math.min(ax1,ax2),Math.min(bx1,bx2))>=12)return true;}
    if(Math.abs(ax1-ax2)<=.5&&Math.abs(bx1-bx2)<=.5&&Math.abs(ax1-bx1)<12){if(Math.min(Math.max(ay1,ay2),Math.max(by1,by2))-Math.max(Math.min(ay1,ay2),Math.min(by1,by2))>=12)return true;}
  }
  return false;
}
function segmentIntersectionPoint(a,b){
  const rx=a[2]-a[0],ry=a[3]-a[1],sx=b[2]-b[0],sy=b[3]-b[1],denominator=rx*sy-ry*sx;
  if(Math.abs(denominator)<1e-8)return null;
  const qx=b[0]-a[0],qy=b[1]-a[1],t=(qx*sy-qy*sx)/denominator,u=(qx*ry-qy*rx)/denominator;
  if(t< -1e-8||t>1+1e-8||u< -1e-8||u>1+1e-8)return null;
  return [a[0]+t*rx,a[1]+t*ry];
}
function routeEndpoints(route){
  return [{id:route.from,point:route.segments[0].slice(0,2)},{id:route.to,point:route.segments.at(-1).slice(2,4)}];
}
function routeCrossingPoints(a,b){
  const aEnds=routeEndpoints(a),bEnds=routeEndpoints(b),points=[];
  for(const first of a.segments)for(const second of b.segments){
    const point=segmentIntersectionPoint(first,second);
    if(!point)continue;
    const sharedNodeEndpoint=aEnds.some((left)=>bEnds.some((right)=>left.id===right.id&&Math.hypot(left.point[0]-right.point[0],left.point[1]-right.point[1])<=.5&&Math.hypot(left.point[0]-point[0],left.point[1]-point[1])<=.5));
    if(sharedNodeEndpoint||points.some((prior)=>Math.hypot(prior[0]-point[0],prior[1]-point[1])<=.5))continue;
    points.push(point);
  }
  return points;
}
export { BOUNDARY_EDGE_PADDING, ARROWHEAD_TARGET_TOLERANCE, attributes, widthOf, visibleSvgText, svgContent, parseRoutes, rectangles, boundaryOutlines, segmentHitsBox, segmentHitsText, textOverlapsNode, gap, routeDistance, isBoundaryLabel, textHitsOutline, segmentAlongOutline, markerDefinitions, markerOverlapsTarget, markerFor, markerScale, markerHeadLength, markerTip, distanceToBoxBoundary, decisionBranchQuality, routeLength, routeBends, routeManhattanDistance, alignedRouteKind, routeCrossesBoundary, collinearOverlap, routeCrossingPoints };
