#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { diagramRuntimeStatus } from './diagram-runtime.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const report=[];
function check(name,ok,detail){report.push({name,status:ok?'pass':'fail',detail});}
const runtime=diagramRuntimeStatus();
check('renderer agent-browser >= 0.38.1 (pinned '+runtime.pinned+')',runtime.renderer.ready,runtime.renderer.ready?runtime.renderer.version+' ('+runtime.renderer.source+')':'not installed; first PNG export installs it, or run: npx @litfamily/litgravity runtime install diagram');
check('browser (system Chrome, else Chrome for Testing 154 in the LitGravity cache)',runtime.chrome.ok,runtime.chrome.detail);
const font=path.join(root,'assets/fonts/PretendardVariable.woff2');
const license=path.join(root,'assets/fonts/OFL.txt');
const humanizer=path.resolve(root,'../lit-humanizer/scripts/detect.mjs');
check('sibling lit-humanizer detector',fs.existsSync(humanizer),fs.existsSync(humanizer)?path.relative(root,humanizer):'missing');
for(const file of [font,license]) check(path.relative(root,file),fs.existsSync(file),fs.existsSync(file)?String(fs.statSync(file).size)+' bytes':'missing');
if(fs.existsSync(font)) check('font SHA-256 manifest',(()=>{try{const m=JSON.parse(fs.readFileSync(path.join(root,'assets/fonts/provenance.json'),'utf8'));return m.files?.some((f)=>f.file==='PretendardVariable.woff2'&&f.sha256===crypto.createHash('sha256').update(fs.readFileSync(font)).digest('hex'));}catch{return false;}})(),'matches bundled provenance record');
const temp=path.resolve('.doctor-write-probe-'+process.pid);
try{fs.writeFileSync(temp,'ok');fs.unlinkSync(temp);check('workspace write access (cwd)',true,'temporary probe removed');}catch(e){check('workspace write access (cwd)',false,e.message);}
const failures=report.filter((x)=>x.status==='fail');
console.log(JSON.stringify({ok:failures.length===0,checks:report},null,2));
if(failures.length)process.exitCode=1;
