#!/usr/bin/env node
import fs from 'node:fs';
const file=process.argv.slice(2).find((x)=>!x.startsWith('--'));
if(!file){console.error('Usage: node scripts/verify-motion.mjs <file.html|file.svg>');process.exit(2);}
const source=fs.readFileSync(file,'utf8');
const issues=[];
if(/<animate\b|<set\b/i.test(source)) issues.push('SVG_ANIMATION_NOT_STATIC');
if(/animation\s*:\s*(?!none\b)[^;}]+/i.test(source)&&!/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)[\s\S]*?animation\s*:\s*none/i.test(source)) issues.push('REDUCED_MOTION_RULE_MISSING');
if(/autoplay|infinite/i.test(source)) issues.push('UNBOUNDED_MOTION');
if(/<script\b/i.test(source)&&!/(prefers-reduced-motion|matchMedia)/i.test(source)) issues.push('MOTION_CONTROLLER_REDUCED_MOTION_MISSING');
if(issues.length){console.error('MOTION_FAIL '+file);for(const issue of issues)console.error('- '+issue);process.exitCode=1;}
else console.log('MOTION_PASS '+file+' static-first=reduced-motion-ready');
