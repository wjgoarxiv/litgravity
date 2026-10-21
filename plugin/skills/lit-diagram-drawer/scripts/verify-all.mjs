#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeFile, root } from './diagram-metrics.mjs';
import { visualQuality } from './visual-quality.mjs';

const catalog=JSON.parse(fs.readFileSync(path.join(root,'references/type-catalog.json'),'utf8'));
const paths=[];
for(const entry of catalog.entries) for(const variant of catalog.variants) paths.push({file:path.join(root,'assets/examples/type-'+entry.id+'-'+variant+'.html'),type:entry.id,variant,kind:'template'});
for(const entry of fs.readdirSync(path.join(root,'examples'),{withFileTypes:true}).filter((x)=>x.isDirectory())) {
  const file=path.join(root,'examples',entry.name,'after.html');
  if(fs.existsSync(file)) {
    const source=fs.readFileSync(file,'utf8');
    const type=source.match(/data-type="([a-z0-9-]+)"/)?.[1];
    paths.push({file,type,variant:'full',kind:'after'});
  }
}
const issues=[];
const advisories=[];
const foilResults=[];
function add(file,code){issues.push({file:path.relative(root,file),code});}
for(const item of paths){
  if(!fs.existsSync(item.file)){add(item.file,'MISSING');continue;}
  let source,result;
  try{source=fs.readFileSync(item.file,'utf8');result=analyzeFile(item.file);}catch(e){add(item.file,'ANALYSIS '+e.message);continue;}
  const visual=visualQuality(source,{enforceCanvas:item.kind==='after'});
  for(const issue of visual.issues){
    if(item.kind==='template'&&issue.startsWith('OF-')) advisories.push({file:path.relative(root,item.file),code:issue,template:item.type+'-'+item.variant});
    else add(item.file,'VISUAL '+issue);
  }
  for(const advisory of visual.advisories)advisories.push({file:path.relative(root,item.file),code:advisory,template:item.kind==='template'?item.type+'-'+item.variant:null});
  if(!result.hasSvg||!result.viewBox||result.viewBox.w<=0||result.viewBox.h<=0)add(item.file,'SVG_OR_VIEWBOX');
  if(!result.title||!result.desc||!result.roleImage||!result.ariaLinked)add(item.file,'A11Y');
  if(!result.textCount)add(item.file,'NO_TEXT');
  if(result.offCanvas)add(item.file,'OFF_CANVAS '+result.offCanvas);
  if(result.textOverlaps)add(item.file,'TEXT_OVERLAP '+result.textOverlaps);
  if(result.objectOverlaps)add(item.file,'SHAPE_OVERLAP '+result.objectOverlaps);
  if(result.contrastFailures.length)add(item.file,'CONTRAST '+result.contrastFailures.length);
  if(!result.fontFamilyPresent||!result.localFont||!result.fontFileValid)add(item.file,'PRETENDARD_FONT_ASSET');
  if(result.humanizer.summary?.block)add(item.file,'HUMANIZER_BLOCK '+result.humanizer.summary.block);
  if(result.humanizer.errors?.length)add(item.file,'HUMANIZER_ERROR');
  const entry=catalog.entries.find((x)=>x.id===item.type);
  if(!entry)add(item.file,'UNKNOWN_TYPE');
  if(entry&&!source.includes('data-type="'+item.type+'"')&&!source.includes('id="diagram-'+item.type+'-'))add(item.file,'TYPE_ID_MISMATCH');
  if(entry&&entry.family==='quantitative'&&result.textCount<3)add(item.file,'QUANTITATIVE_LABELS');
  if(item.type==='heatmap'&&(source.match(/<rect\b/gi)||[]).length<16)add(item.file,'HEATMAP_GRID');
  if(item.type==='treemap'&&(source.match(/<rect\b/gi)||[]).length<6)add(item.file,'TREEMAP_TILES');
  if(item.type==='sankey'&&!/<path\b[^>]*stroke-width\s*=\s*["'][1-9]/i.test(source))add(item.file,'SANKEY_WIDTH');
  if(item.type==='waterfall'&&(source.match(/<rect\b/gi)||[]).length<5)add(item.file,'WATERFALL_STEPS');
  if(item.type==='beeswarm'&&(source.match(/<circle\b/gi)||[]).length<20)add(item.file,'BEESWARM_MARKS');
  if(item.type==='bubble'&&(source.match(/<circle\b/gi)||[]).length<6)add(item.file,'BUBBLE_MARKS');
  if((item.type==='polar'||item.type==='radar')&&!/<polygon\b/i.test(source))add(item.file,'POLAR_OR_RADAR_SHAPE');
  if(item.type==='tree-block-decomposition'&&!/data-block-id\s*=/.test(source))add(item.file,'BLOCK_ID');
  if(item.type==='policy-trace-animated'&&!/(rule|policy|allow|deny)/i.test(source))add(item.file,'POLICY_SEMANTIC');
  if(item.type==='queue-animated'&&!/(queue|buffer|drain|fan-in)/i.test(source))add(item.file,'QUEUE_SEMANTIC');
  if(item.type==='paved-road-animated'&&!/(boundary|guardrail|secure|policy)/i.test(source))add(item.file,'PAVED_ROAD_SEMANTIC');
  if(/<animate\b|<set\b|autoplay|infinite/i.test(source))add(item.file,'NON_STATIC_MOTION');
  if(/<script\b|\bon[a-z]+\s*=|https?:\/\//i.test(result.visibleText))add(item.file,'UNSAFE_TEXT');
}
const foilFiles=[];
for(const dir of fs.readdirSync(path.join(root,'examples'),{withFileTypes:true}).filter((x)=>x.isDirectory())){
  const file=path.join(root,'examples',dir.name,'constructed-naive-foil.html');
  if(fs.existsSync(file)){
    foilFiles.push(file);
    try{
      const r=analyzeFile(file);
      const visual=visualQuality(fs.readFileSync(file,'utf8'));
      const fails=!r.title||!r.desc||r.textOverlaps>0||r.contrastFailures.length>0||r.humanizer.summary?.block>0;
      if(!fails)add(file,'FOIL_NOT_FLAGGED');
      const hasMethodFooter=visual.issues.includes('PROCESS_TEXT I hope this helps · Source: internal notes');
      const hasHumanizerBlock=(r.humanizer.summary?.block||0)>0;
      const matched=hasMethodFooter&&hasHumanizerBlock;
      if(!matched)add(file,'FOIL_EXPECTED_REASON method-metadata-footer');
      foilResults.push({example:dir.name,expectedReason:'method-metadata-footer',matched,signals:{processText:hasMethodFooter,humanizerBlock:hasHumanizerBlock}});
    }catch(e){add(file,'FOIL_ANALYSIS '+e.message);}
  }
}
if(paths.filter((x)=>x.kind==='template').length!==183)add(root,'TEMPLATE_COUNT');
if(paths.filter((x)=>x.kind==='after').length!==8)add(root,'AFTER_COUNT');
if(foilFiles.length!==8)add(root,'FOIL_COUNT');
const out={templates:paths.filter((x)=>x.kind==='template').length,afterExamples:paths.filter((x)=>x.kind==='after').length,foilsChecked:foilFiles.length,foilResults,advisories,failures:issues};
console.log(JSON.stringify(out,null,2));
if(issues.length)process.exitCode=1;
