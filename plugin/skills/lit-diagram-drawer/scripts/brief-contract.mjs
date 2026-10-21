import fs from 'node:fs';

const decode=(s)=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&#39;',"'");
const attrs=(s)=>Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m)=>[m[1],decode(m[2]??m[3]??'')]));
const textValue=(s)=>decode(s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());

function parseBrief(text){
  const lines=text.split(/\r?\n/).map((line)=>line.trim());
  const nodes=[],edges=[];
  for(const line of lines){
    const fact=line.match(/^[-*]\s*(.+?)\s+participates in the labeled relationships below\.$/);
    if(fact){nodes.push(fact[1]);continue;}
    const relation=line.match(/^[-*]\s*(.+?)\s+→\s+(.+?)\s+\((.+)\)$/);
    if(relation)edges.push({from:relation[1],to:relation[2],label:relation[3]});
  }
  const uniqueNodes=[...new Set(nodes)];
  const title=lines.find((line)=>line.startsWith('# '))?.replace(/^#\s+/, '').replace(/^(?:Diagram brief\s*[·:]\s*|T7 blind brief:\s*)/i,'')||'';
  const purpose=lines.find((line)=>/^[-*]\s*Purpose:/i.test(line))?.replace(/^[-*]\s*Purpose:\s*/i,'')||'';
  const content=[title,purpose,...uniqueNodes,...edges.flatMap((edge)=>[edge.from,edge.to,edge.label])].filter(Boolean).join(' ');
  const languageSample=[title,purpose,...uniqueNodes,...edges.flatMap((edge)=>[edge.from,edge.to,edge.label])].join(' ');
  const korean=(languageSample.match(/[\uac00-\ud7a3]/g)||[]).length,latin=(languageSample.match(/[A-Za-z]/g)||[]).length;
  const language=korean>latin?'ko':'en';
  const internalLine=lines.find((line)=>/^[-*]\s*Trust boundary internal nodes:/i.test(line));
  const externalLine=lines.find((line)=>/^[-*]\s*Trust boundary external nodes:/i.test(line));
  const membershipNames=(line)=>line?line.slice(line.indexOf(':')+1).split(';').map((name)=>name.trim()).filter(Boolean):[];
  const boundaryMembership={declarationPresent:Boolean(internalLine||externalLine),declared:Boolean(internalLine&&externalLine),internal:membershipNames(internalLine),external:membershipNames(externalLine)};
  const allowedEnglishTerms=new Set();
  const addTerms=(value)=>{for(const term of value.match(/[A-Za-z][A-Za-z0-9]*(?:[.+/#-][A-Za-z0-9]+)*/g)||[])allowedEnglishTerms.add(term.toLowerCase());};
  addTerms(content);
  for(const match of text.matchAll(/`([^`]+)`/g))addTerms(match[1]);
  for(const line of lines.filter((line)=>/^[-*]\s*Allowed (?:English )?terms:/i.test(line)))addTerms(line.replace(/^[-*]\s*Allowed (?:English )?terms:\s*/i,''));
  return {nodes:uniqueNodes,edges,language,allowedEnglishTerms:[...allowedEnglishTerms].sort(),boundaryMembership};
}
function checkBoundaryMembership(source,membership={}) {
  const svg=[...source.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)].map((m)=>m[0]).join('\n');
  const rectAttrs=[...svg.matchAll(/<rect\b([^>]*)\/?\s*>/gi)].map((match)=>attrs(match[1]));
  const boundaries=rectAttrs.filter((a)=>Object.hasOwn(a,'data-trust-boundary'));
  const issues=[];
  const declared=Boolean(membership.declared);
  const declarationPresent=Boolean(membership.declarationPresent||declared);
  if(!declarationPresent){
    if(boundaries.length)issues.push('BOUNDARY_MEMBERSHIP_DECLARATION_MISSING');
    return {declared:false,boundaryCount:boundaries.length,issues};
  }
  if(!declared)issues.push('BOUNDARY_MEMBERSHIP_DECLARATION_INCOMPLETE');
  const internal=membership.internal||[],external=membership.external||[];
  if(!internal.length)issues.push('BOUNDARY_INTERNAL_LIST_EMPTY');
  if(!external.length)issues.push('BOUNDARY_EXTERNAL_LIST_EMPTY');
  for(const names of [internal,external]){
    const seen=new Set();
    for(const name of names){if(seen.has(name))issues.push('BOUNDARY_MEMBERSHIP_DUPLICATE name='+name);seen.add(name);}
  }
  const externalNames=new Set(external);
  for(const name of internal)if(externalNames.has(name))issues.push('BOUNDARY_MEMBERSHIP_CONFLICT name='+name);
  if(boundaries.length!==1){
    issues.push('BOUNDARY_COUNT expected=1 actual='+boundaries.length);
    return {declared:true,boundaryCount:boundaries.length,internal,external,issues};
  }
  const boundary=boundaries[0],bx=Number(boundary.x),by=Number(boundary.y),bw=Number(boundary.width),bh=Number(boundary.height);
  if(![bx,by,bw,bh].every(Number.isFinite)||bw<=0||bh<=0){
    issues.push('BOUNDARY_GEOMETRY_INVALID');
    return {declared:true,boundaryCount:1,internal,external,issues};
  }
  const nodes=rectAttrs.filter((a)=>a['data-node-id']).map((a)=>({id:a['data-node-id'],x:Number(a.x),y:Number(a.y),w:Number(a.width),h:Number(a.height)}));
  const nodeNames=new Set(nodes.map((node)=>node.id)),expected=new Set([...internal,...external]);
  for(const name of expected)if(!nodeNames.has(name))issues.push('BOUNDARY_NODE_MISSING name='+name);
  for(const node of nodes){
    if(![node.x,node.y,node.w,node.h].every(Number.isFinite)||node.w<=0||node.h<=0){issues.push('BOUNDARY_NODE_GEOMETRY_INVALID name='+node.id);continue;}
    if(!expected.has(node.id)){issues.push('BOUNDARY_NODE_UNDECLARED name='+node.id);continue;}
    const inside=node.x>=bx&&node.y>=by&&node.x+node.w<=bx+bw&&node.y+node.h<=by+bh;
    const outside=node.x+node.w<=bx||node.x>=bx+bw||node.y+node.h<=by||node.y>=by+bh;
    if(internal.includes(node.id)&&!inside)issues.push('BOUNDARY_NODE_NOT_INTERNAL name='+node.id);
    if(externalNames.has(node.id)&&!outside)issues.push('BOUNDARY_NODE_NOT_EXTERNAL name='+node.id);
  }
  return {declared:true,boundaryCount:1,internal,external,issues};
}
function checkBrief(source,brief){
  const contract=typeof brief==='string'?parseBrief(brief):brief;
  const svg=[...source.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)].map((m)=>m[0]).join('\n');
  const texts=new Set([...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((m)=>textValue(m[1])).filter(Boolean));
  const allowed=new Set(contract.allowedEnglishTerms||[]);
  const languageMismatches=contract.language==='ko'?[...texts].map((label)=>({label,terms:(label.match(/[A-Za-z][A-Za-z0-9]*(?:[.+/#-][A-Za-z0-9]+)*/g)||[]).filter((term)=>!allowed.has(term.toLowerCase()))})).filter((item)=>item.terms.length):[];
  const routes=[...svg.matchAll(/<(?:path|line)\b([^>]*)>/gi)].map((m)=>attrs(m[1])).filter((a)=>a['data-from']&&a['data-to']);
  const missingNodes=contract.nodes.filter((name)=>!texts.has(name));
  const missingLabels=contract.edges.filter((edge)=>!texts.has(edge.label)).map((edge)=>edge.label);
  const missingEdges=contract.edges.filter((edge)=>!routes.some((route)=>route['data-from']===edge.from&&route['data-to']===edge.to&&route['data-label']===edge.label));
  const unpairedLabels=contract.edges.filter((edge)=>{
    const id=edge.from+'|'+edge.to;
    return ![...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)].some((m)=>{const a=attrs(m[1]);return a['data-edge-for']===id&&textValue(m[2])===edge.label;});
  });
  return {language:contract.language,nodes:contract.nodes.length,relationships:contract.edges.length,missingNodes,missingLabels,missingEdges,unpairedLabels,languageMismatches,boundaryMembership:checkBoundaryMembership(source,contract.boundaryMembership)};
}
function readBrief(file){return fs.readFileSync(file,'utf8');}
export { parseBrief, checkBrief, checkBoundaryMembership, readBrief };
