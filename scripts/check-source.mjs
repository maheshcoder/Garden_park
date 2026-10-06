import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const files=[...walk('src'),...walk('scripts'),...walk('tests'),'vite.config.js','script.js'].filter(f=>/\.(m?js)$/.test(f));
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});if(result.status){console.error(result.stderr);process.exit(1);}}
console.log(files.length+' JavaScript files passed syntax checks. TypeScript is checked separately.');
