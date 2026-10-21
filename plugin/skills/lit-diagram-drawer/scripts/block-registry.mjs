import path from 'node:path';

const fields=['parent','name','input','output','constraint','assumption','impl'];
const decode=(value)=>value.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'");

function buildBlockRegistry(svg, sourceName) {
  const blocks=[];
  for(const match of svg.matchAll(/<([\w:-]+)\b([^>]*)>/g)) {
    const raw=match[2];
    if(!/\bdata-block-id\s*=/.test(raw)) continue;
    const attrs=Object.fromEntries([...raw.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((item)=>[item[1],decode(item[2]??item[3]??'')]));
    const id=(attrs['data-block-id']||'').trim();
    if(!id) throw new Error('REGISTRY_ID_REQUIRED');
    const block={id};
    for(const field of fields) {
      const value=attrs['data-block-'+field];
      if(value!==undefined&&value!=='')block[field]=value;
    }
    blocks.push(block);
  }
  if(!blocks.length) throw new Error('REGISTRY_BLOCKS_MISSING');
  const ids=new Set();
  for(const block of blocks) {
    if(ids.has(block.id)) throw new Error('REGISTRY_DUPLICATE_ID '+block.id);
    ids.add(block.id);
  }
  for(const block of blocks) if(block.parent&&!ids.has(block.parent)) throw new Error('REGISTRY_PARENT_MISSING '+block.id+' -> '+block.parent);
  const byId=new Map(blocks.map((block)=>[block.id,block]));
  for(const block of blocks) {
    const seen=new Set([block.id]);
    let parent=block.parent;
    while(parent) {
      if(seen.has(parent)) throw new Error('REGISTRY_CYCLE '+block.id);
      seen.add(parent);
      parent=byId.get(parent)?.parent;
    }
  }
  const roots=blocks.filter((block)=>!block.parent);
  if(roots.length!==1) throw new Error('REGISTRY_ROOT_COUNT '+roots.length);
  return {schemaVersion:1,source:path.basename(sourceName),blocks};
}

export { buildBlockRegistry };
