#!/usr/bin/env node
import { analyzeFile } from './diagram-metrics.mjs';
import { readFileSync } from 'node:fs';
import { visualQuality } from './visual-quality.mjs';

const file=process.argv.slice(2).find((x)=>!x.startsWith('--'));
if(!file){console.error('Usage: node scripts/verify-diagram.mjs <file.html|file.svg>');process.exit(2);}
let result;
try{result=analyzeFile(file);}catch(e){console.error('VERIFY_ERROR '+e.message);process.exit(2);}
const craft=visualQuality(readFileSync(file,'utf8'));
const failures=[];
failures.push(...craft.issues.filter((issue)=>issue.startsWith('OF-')));
if(!result.hasSvg) failures.push('SVG_MISSING');
if(!result.viewBox||result.viewBox.w<=0||result.viewBox.h<=0) failures.push('VIEWBOX_INVALID');
if(!result.title||!result.desc||!result.roleImage||!result.ariaLinked) failures.push('A11Y_TITLE_DESC_ROLE_LINK');
if(result.textCount===0) failures.push('TEXT_MISSING');
if(result.offCanvas) failures.push('OFF_CANVAS '+result.offCanvas);
if(result.textOverlaps) failures.push('TEXT_OVERLAP '+result.textOverlaps);
if(result.objectOverlaps) failures.push('SHAPE_OVERLAP '+result.objectOverlaps);
if(result.contrastFailures.length) failures.push('CONTRAST '+result.contrastFailures.length);
if(result.humanizer.summary?.block) failures.push('HUMANIZER_BLOCK '+result.humanizer.summary.block);
if(result.humanizer.errors?.length) failures.push('HUMANIZER_ERROR');
if(!result.fontFamilyPresent||!result.localFont||!result.fontFileValid) failures.push('PRETENDARD_FONT_NOT_LOADED_FROM_LOCAL_ASSET');
if(/<script\b|\bon[a-z]+\s*=|https?:\/\//i.test(result.visibleText)) failures.push('UNSAFE_VISIBLE_TEXT');
if(failures.length){console.error('DIAGRAM_FAIL '+file);for(const f of failures)console.error('- '+f);process.exitCode=1;}
else console.log('DIAGRAM_PASS '+file+' text='+result.textCount+' overlap=0 contrast=pass humanizer-block=0');
for(const advisory of craft.advisories) console.log('DIAGRAM_ADVISORY '+advisory);
