import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const delay = ms => new Promise(r => setTimeout(r, ms));
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!existsSync(chrome)) throw new Error('Set CHROME_PATH to a Chromium executable.');
const preview = process.argv.includes('--preview');
const baseline = process.argv.includes('--baseline');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', '4175', '--strictPort'], {windowsHide:true, stdio:'pipe'});
let serverLog = ''; server.stderr.on('data', d => serverLog += d);
let browser, socket;
const pending = new Map(); let seq = 0; const errors = [];
async function waitFor(fn, label, attempts=100) { for(let i=0;i<attempts;i++){try{const v=await fn();if(v)return v;}catch{} await delay(150);}throw new Error('Timeout: '+label+' '+serverLog); }
try {
 await waitFor(async()=> (await fetch('http://127.0.0.1:4175')).ok, 'server');
 browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9227', '--user-data-dir='+mkdtempSync(join(tmpdir(),'garden-chrome-')), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,1000', 'about:blank'], {windowsHide:true, stdio:'ignore'});
 const tabs = await waitFor(async()=>await (await fetch('http://127.0.0.1:9227/json')).json(), 'Chrome');
 socket = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage = event => { const m=JSON.parse(event.data); if(m.id){const p=pending.get(m.id); if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}} if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error') errors.push(m.params.args.map(a=>a.value||a.description||'').join(' ')); if(m.method==='Log.entryAdded' && m.params.entry.level==='error') errors.push(m.params.entry.text); };
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},45000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const navigate=async path=>{await evaluate('window.__gardenApp = null; window.garden = null');await send('Page.navigate',{url:'http://127.0.0.1:4175/'+path});await waitFor(()=>evaluate('!!window.garden && !!window.__gardenApp?.birds'),path);};
 await navigate(''); await delay(1800);
 mkdirSync('artifacts',{recursive:true});
 const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});writeFileSync('artifacts/'+name+'.png',Buffer.from(s.data,'base64'));};
 await shot(baseline?'before':'garden-desktop');
 console.log(JSON.stringify(await evaluate('({errors:window.__err, flowers:window.garden.flowers.length, render:window.__gardenApp.scene3d.renderer.info.render, memory:window.__gardenApp.scene3d.renderer.info.memory})')));
 if (!baseline) {
   const { runChecks } = await import('./runtime-checks.mjs');
   await runChecks({send,evaluate,navigate,shot,delay,preview});
 }
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Browser checks passed');
} finally {
 socket?.close(); browser?.kill(); server.kill();
}
