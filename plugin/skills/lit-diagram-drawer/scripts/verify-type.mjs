#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { analyzeFile, root } from './diagram-metrics.mjs';
import { buildBlockRegistry } from './block-registry.mjs';
import { sequenceQuality } from './visual-quality.mjs';

const args=process.argv.slice(2);
const typeArg=args.find((x)=>x.startsWith('--type='));
const type=typeArg?.slice('--type='.length);
const file=args.find((x)=>!x.startsWith('--'));
if(!type||!file){console.error('Usage: node scripts/verify-type.mjs --type=<catalog-id> <file.html|file.svg>');process.exit(2);}
const catalog=JSON.parse(fs.readFileSync(path.join(root,'references/type-catalog.json'),'utf8'));
const entry=catalog.entries.find((x)=>x.id===type);
if(!entry){console.error('TYPE_UNKNOWN '+type);process.exit(2);}
const source=fs.readFileSync(file,'utf8');
const result=analyzeFile(file);
const issues=[];
if(!source.includes('data-type="'+type+'"')&&!source.includes('id="diagram-'+type+'-')) issues.push('TYPE_ID_MISMATCH');
if(!fs.existsSync(path.join(root,'references',entry.reference))) issues.push('TYPE_GUIDE_MISSING');
if(!/data-variant\s*=\s*["'](?:light|dark|full)["']/i.test(source)&&!/id="diagram-[a-z0-9-]+-(?:light|dark|full)"/i.test(source)) issues.push('VARIANT_MISSING');
if(entry.family==='quantitative'&&result.textCount<3) issues.push('QUANTITATIVE_LABELS_MISSING');
if(type==='heatmap'&&(source.match(/<rect\b/gi)||[]).length<16) issues.push('HEATMAP_GRID_TOO_SMALL');
if(type==='treemap'&&(source.match(/<rect\b/gi)||[]).length<6) issues.push('TREEMAP_TILES_TOO_FEW');
if(type==='sankey'&&!/<path\b[^>]*stroke-width\s*=\s*["'][1-9]/i.test(source)) issues.push('SANKEY_RIBBON_WIDTH_MISSING');
if(type==='waterfall'&&(source.match(/<rect\b/gi)||[]).length<5) issues.push('WATERFALL_STEPS_TOO_FEW');
if(type==='beeswarm'&&(source.match(/<circle\b/gi)||[]).length<20) issues.push('BEESWARM_MARKS_TOO_FEW');
if(type==='bubble'&&(source.match(/<circle\b/gi)||[]).length<6) issues.push('BUBBLE_MARKS_TOO_FEW');
if(type==='polar'&&!/<polygon\b/i.test(source)) issues.push('POLAR_SHAPE_MISSING');
if(type==='radar'&&!/<polygon\b/i.test(source)) issues.push('RADAR_SHAPE_MISSING');
if(type==='sequence'||type==='sequence-oauth')issues.push(...sequenceQuality(source).map((issue)=>'SEQUENCE '+issue));
if(type==='tree-block-decomposition'){
  try{
    const svg=source.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/i)?.[0]||'';
    const registry=buildBlockRegistry(svg,path.basename(file));
    const visible=[...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((match)=>match[1].replace(/<[^>]*>/g,'').trim());
    for(const block of registry.blocks){
      for(const field of ['name','input','output','constraint','assumption','impl']) if(!block[field])issues.push('BLOCK_FIELD_MISSING '+block.id+'.'+field);
      if(!visible.includes(block.id))issues.push('BLOCK_BADGE_MISSING '+block.id);
      if(block.name&&!visible.includes(block.name))issues.push('BLOCK_NAME_MISSING '+block.id);
    }
  }catch(error){issues.push('BLOCK_REGISTRY_INVALID '+error.message);}
}
if(type==='policy-trace-animated'&&!/(rule|policy|allow|deny)/i.test(source)) issues.push('POLICY_TRACE_SEMANTIC_MISSING');
if(type==='queue-animated'&&!/(queue|buffer|drain|fan-in)/i.test(source)) issues.push('QUEUE_SEMANTIC_MISSING');
if(type==='paved-road-animated'&&!/(boundary|guardrail|secure|policy)/i.test(source)) issues.push('PAVED_ROAD_SEMANTIC_MISSING');
if(issues.length){console.error('TYPE_FAIL '+type+' '+file);for(const issue of issues)console.error('- '+issue);process.exitCode=1;}
else console.log('TYPE_PASS '+type+' family='+entry.family);
