#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { root } from './diagram-metrics.mjs';
import { checkBrief, readBrief } from './brief-contract.mjs';

const folders=fs.readdirSync(path.join(root,'examples'),{withFileTypes:true}).filter((entry)=>entry.isDirectory()).map((entry)=>entry.name).sort();
const results=[];
for(const folder of folders){
  const brief=path.join(root,'examples',folder,'brief.md'),after=path.join(root,'examples',folder,'after.html');
  if(!fs.existsSync(brief)||!fs.existsSync(after)){results.push({example:folder,missingFiles:[!fs.existsSync(brief)?'brief.md':null,!fs.existsSync(after)?'after.html':null].filter(Boolean)});continue;}
  results.push({example:folder,...checkBrief(fs.readFileSync(after,'utf8'),readBrief(brief))});
}
const failures=results.filter((result)=>result.missingFiles||result.missingNodes?.length||result.missingLabels?.length||result.missingEdges?.length||result.unpairedLabels?.length||result.languageMismatches?.length||result.boundaryMembership?.issues?.length);
console.log(JSON.stringify({checked:results.length,failures,results},null,2));
if(failures.length)process.exitCode=1;
