import { build } from 'esbuild';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, cp, access, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const appVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
if(!/^\d+\.\d+\.\d+$/.test(appVersion))throw new Error('Versão inválida para empacotamento.');
const target=path.join(root,'release','Playbook Studio');
const version=process.env.PLAYBOOK_NODE_VERSION||'v24.19.0';
if(!/^v24\.\d+\.\d+$/.test(version))throw new Error('Use uma versão oficial Node.js 24.x.');
const native=path.join(root,'release','native','Playbook.Capture.exe');
await access(native,constants.R_OK);
await mkdir(target,{recursive:true});
await mkdir(path.join(root,'.cache'),{recursive:true});
const name=`node-${version}-win-x64.zip`;
const source=`https://nodejs.org/dist/${version}/`;
console.log('Obtendo identidade oficial do runtime Windows.');
const sums=await fetch(source+'SHASUMS256.txt');if(!sums.ok)throw new Error('Não foi possível obter os checksums oficiais.');
const expected=(await sums.text()).split('\n').find(l=>l.endsWith('  '+name))?.split(/\s+/)[0];
if(!expected)throw new Error('Runtime não listado nos checksums oficiais.');
const cache=path.join(root,'.cache',name);
let archive;
try{archive=await readFile(cache);}catch{
  const r=await fetch(source+name);if(!r.ok)throw new Error('Download do runtime falhou.');archive=Buffer.from(await r.arrayBuffer());await writeFile(cache,archive);
}
if(createHash('sha256').update(archive).digest('hex')!==expected){await rm(cache,{force:true});throw new Error('Checksum do runtime Windows não confere.');}
console.log('SHA256 do runtime confirmado.');
const nodeZip=await JSZip.loadAsync(archive);const prefix=`node-${version}-win-x64/`;
await mkdir(path.join(target,'runtime'),{recursive:true});
for(const file of ['node.exe','LICENSE']){const entry=nodeZip.file(prefix+file);if(!entry)throw new Error('Runtime incompleto.');await writeFile(path.join(target,'runtime',file),await entry.async('nodebuffer'));}
await cp(native,path.join(target,'Playbook Studio.exe'));
await cp(path.join(root,'dist'),path.join(target,'dist'),{recursive:true});
await build({entryPoints:[path.join(root,'server','index.mjs')],bundle:true,platform:'node',format:'cjs',outfile:path.join(target,'server.cjs'),external:['vite'],define:{'import.meta.url':'__playbookModuleUrl'},banner:{js:"const __playbookModuleUrl = require('node:url').pathToFileURL(__filename).href;"},minify:false});
const guide=await readFile(path.join(root,'docs','GUIA-WINDOWS.md'),'utf8');
await writeFile(path.join(target,'LEIA-ME.txt'),guide);
for(const name of ['VALIDACAO','TESTE-WINDOWS','AUTOMACAO-LOCAL'])await writeFile(path.join(target,`${name}.txt`),await readFile(path.join(root,'docs',`${name}.md`),'utf8'));
await writeFile(path.join(target,'Iniciar pelo terminal.cmd'),'@echo off\r\ncd /d "%~dp0"\r\n"%~dp0runtime\\node.exe" --use-env-proxy "%~dp0server.cjs" --production --open --portable\r\npause\r\n');
const dependencies=await import('./third-party.mjs');
await dependencies.writeNotices(root,path.join(target,'LICENCAS-TERCEIROS.txt'));
const zip=new JSZip();
const allowed=new Set(['Playbook Studio.exe','server.cjs','runtime/node.exe','runtime/LICENSE','LEIA-ME.txt','VALIDACAO.txt','TESTE-WINDOWS.txt','AUTOMACAO-LOCAL.txt','LICENCAS-TERCEIROS.txt','Iniciar pelo terminal.cmd']);
async function inventory(folder,prefix=''){
  const {readdir}=await import('node:fs/promises');
  for(const entry of await readdir(folder,{withFileTypes:true})){const relative=`${prefix}${entry.name}`;if(entry.isDirectory())await inventory(path.join(folder,entry.name),relative+'/');else if(!/(^|\/)\.env($|\.)/i.test(relative))allowed.add('dist/'+relative);}
}
await inventory(path.join(root,'dist'));
async function addDirectory(folder,base='Playbook Studio',relative=''){
  const { readdir }=await import('node:fs/promises');
  for(const entry of await readdir(folder,{withFileTypes:true})){const p=path.join(folder,entry.name);const rel=relative+entry.name;if(entry.isDirectory()){if(rel==='dist'||rel.startsWith('dist/')||rel==='runtime')await addDirectory(p,`${base}/${entry.name}`,rel+'/');}else if(allowed.has(rel))zip.file(`${base}/${entry.name}`,await readFile(p));}
}
await addDirectory(target);
const output=path.join(root,'release',`Playbook-Studio-${appVersion}-Windows-x64.zip`);
const { createWriteStream }=await import('node:fs');
await new Promise((resolve,reject)=>zip.generateNodeStream({streamFiles:true,compression:'DEFLATE',compressionOptions:{level:6}}).pipe(createWriteStream(output)).on('finish',resolve).on('error',reject));
const checksum=createHash('sha256').update(await readFile(output)).digest('hex');
await writeFile(output+'.sha256',`${checksum}  ${path.basename(output)}\n`);
console.log('Pacote portátil gerado:',output);
