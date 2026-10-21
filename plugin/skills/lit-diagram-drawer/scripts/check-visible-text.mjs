#!/usr/bin/env node
import { analyzeFile } from './diagram-metrics.mjs';
const files=process.argv.slice(2).filter((x)=>!x.startsWith('--'));
if(!files.length){console.error('Usage: node scripts/check-visible-text.mjs <file...>');process.exit(2);}
let failed=false;
for(const file of files){
  try{
    const result=analyzeFile(file);
    const block=result.humanizer.summary?.block||0;
    const errors=result.humanizer.errors?.length||0;
    console.log(JSON.stringify({file,block,warn:result.humanizer.summary?.warn||0,errors,findings:result.humanizer.findings||[]}));
    if(block||errors) failed=true;
  }catch(e){console.error(file+': '+e.message);failed=true;}
}
if(failed)process.exitCode=1;
