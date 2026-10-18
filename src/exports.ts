import JSZip from 'jszip';
import { z } from 'zod';
import { assembleChunks, bookAssets, getAsset, importBook } from './db';
import { annotatedImage } from './images';
import { blobDataURL } from './api';
import { escapeHtml } from './timeline';
import { formatTime, id, ROLES, type Asset, type Playbook } from './types';

export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export function safeName(name:string){return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'').trim().slice(0,100)||'playbook';}
const ext=(mime:string)=>mime.includes('png')?'png':mime.includes('jpeg')?'jpg':mime.includes('gif')?'gif':mime.includes('mp4')?'mp4':mime.includes('wav')?'wav':mime.includes('ogg')?'ogg':'webm';
async function digest(blob:Blob){const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}

export async function backupZip(book:Playbook){
  const zip=new JSZip();const assets=await bookAssets(book.id);const manifest=[];
  // Completed backups retain final media, not duplicate recording chunks.
  const kept=assets.filter(a=>a.kind!=='chunk');
  const exported={...book,audioChunks:[],videoChunks:[]};
  for(const kind of ['audio','video'] as const){
    if(kind==='audio'?book.audioId:book.videoId)continue;
    const blob=await assembleChunks(book,kind);if(blob){const assetId=id();kept.push({id:assetId,bookId:book.id,blob,kind,createdAt:Date.now()});if(kind==='audio')exported.audioId=assetId;else exported.videoId=assetId;}
  }
  for(const asset of kept){const file=`media/${asset.id}.${ext(asset.blob.type)}`;zip.file(file,asset.blob);manifest.push({id:asset.id,kind:asset.kind,file,mime:asset.blob.type,sha256:await digest(asset.blob)});}
  zip.file('project.json',JSON.stringify({format:'playbook-studio',schemaVersion:1,book:exported,assets:manifest},null,2));
  return zip.generateAsync({type:'blob',compression:'STORE'});
}

const annotation=z.object({id:z.string().max(100),type:z.enum(['circle','arrow','box','blur','label']),x:z.number().min(0).max(1),y:z.number().min(0).max(1),x2:z.number().min(0).max(1),y2:z.number().min(0).max(1),text:z.string().max(500)});
const stepSchema=z.object({id:z.string().max(100),title:z.string().max(1000),transcript:z.string().max(100000),instruction:z.string().max(100000),time:z.number().min(0),endTime:z.number().min(0),imageId:z.string().max(100).optional(),annotations:z.array(annotation).max(100),source:z.enum(['manual','click','automatic','demo']),transcriptIds:z.array(z.string().max(100)).max(50000).optional(),action:z.object({button:z.enum(['left','right']),x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).optional(),draftOrigin:z.literal('local-rules').optional(),window:z.string().max(1000).optional(),clipId:z.string().max(100).optional(),clipFormat:z.enum(['video','gif']).optional(),clipStart:z.number().min(0).optional(),clipEnd:z.number().min(0).optional()});
const importSchema=z.object({format:z.literal('playbook-studio'),schemaVersion:z.literal(1),book:z.object({
  id:z.string().max(100),title:z.string().max(1000),description:z.string().max(100000),role:z.enum(ROLES),status:z.enum(['draft','published','recording','interrupted']),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime(),duration:z.number().min(0),steps:z.array(stepSchema).max(2000),transcript:z.array(z.object({id:z.string().max(100),text:z.string().max(100000),time:z.number().min(0),endTime:z.number().min(0),source:z.string().max(100),stepId:z.string().max(100).nullable().optional()})).max(50000),version:z.number().int().positive(),audioId:z.string().max(100).optional(),videoId:z.string().max(100).optional(),recordingSource:z.enum(['browser','windows']).optional(),demo:z.boolean().optional(),
}),assets:z.array(z.object({id:z.string().max(100),kind:z.enum(['image','audio','video','chunk']),file:z.string().regex(/^media\/[a-zA-Z0-9-]+\.[a-z0-9]+$/),mime:z.string().regex(/^(image\/(png|jpeg|gif)|audio\/(webm|mp4|wav|ogg)|video\/(webm|mp4))(;.*)?$/),sha256:z.string().regex(/^[a-f0-9]{64}$/)})).max(5000)});
export async function restoreZip(file:Blob):Promise<Playbook>{
  if(file.size>768*1024*1024)throw new Error('Este backup supera o limite de importação de 768 MB do navegador. Use um projeto menor.');
  const zip=await JSZip.loadAsync(file);let uncompressed=0;
  for(const entry of Object.values(zip.files)){uncompressed+=(entry as any)._data?.uncompressedSize||0;if(uncompressed>1024*1024*1024)throw new Error('O conteúdo descompactado excede o limite de memória de 1 GB.');}
  const raw=zip.file('project.json');if(!raw)throw new Error('Este ZIP não é um backup do Playbook Studio.');
  const parsed=importSchema.safeParse(JSON.parse(await raw.async('string')));if(!parsed.success)throw new Error('Backup incompatível ou dados inválidos.');
  const {book:original,assets:manifest}=parsed.data;const book:Playbook={...original,id:id(),status:original.status==='recording'?'interrupted':original.status,updatedAt:new Date().toISOString()};
  const mapping=new Map<string,string>();const assets:Asset[]=[];
  for(const entry of manifest){
    if(mapping.has(entry.id))throw new Error('Backup contém mídias duplicadas.');
    const source=zip.file(entry.file);if(!source)throw new Error('Backup incompleto: mídia ausente.');
    const blob=new Blob([await source.async('arraybuffer')],{type:entry.mime});if(await digest(blob)!==entry.sha256)throw new Error('A integridade de uma mídia do backup não pôde ser confirmada.');
    const assetId=id();mapping.set(entry.id,assetId);assets.push({id:assetId,bookId:book.id,blob,kind:entry.kind,createdAt:Date.now()});
  }
  const mapped=(assetId?:string)=>{if(!assetId)return undefined;const value=mapping.get(assetId);if(!value)throw new Error('Backup incompleto: referência de mídia ausente.');return value;};
  const stepIds=new Map(book.steps.map(s=>[s.id,id()]));const transcriptIds=new Map(book.transcript.map(t=>[t.id,id()]));
  if(stepIds.size!==book.steps.length||transcriptIds.size!==book.transcript.length)throw new Error('Backup contém identificadores duplicados.');
  book.audioId=mapped(book.audioId);book.videoId=mapped(book.videoId);book.steps=book.steps.map(s=>({...s,id:stepIds.get(s.id)!,imageId:mapped(s.imageId),clipId:mapped(s.clipId),annotations:s.annotations.map(a=>({...a,id:id()})),...(s.transcriptIds?{transcriptIds:s.transcriptIds.map(value=>{const mapped=transcriptIds.get(value);if(!mapped)throw new Error('Backup contém vínculo de fala inexistente.');return mapped;})}:{})}));
  book.transcript=book.transcript.map(t=>{if(t.stepId&&!stepIds.has(t.stepId))throw new Error('Backup contém vínculo de etapa inexistente.');return {...t,id:transcriptIds.get(t.id)!,...(t.stepId?{stepId:stepIds.get(t.stepId)}:{})};});await importBook(book,assets);return book;
}

export async function printableHtml(book:Playbook,external=false){
  let body='';
  for(const [i,step] of book.steps.entries()){
    const image=step.imageId?await annotatedImage(step.imageId,step.annotations):undefined;
    const src=image?(external?`media/step-${i+1}.png`:await blobDataURL(image)):'';
    const clip=external?await getAsset(step.clipId):undefined;
    body+=`<section><div class="step-meta">ETAPA ${String(i+1).padStart(2,'0')} · ${formatTime(step.time)}</div><h2>${escapeHtml(step.title)}</h2>${step.instruction?`<p>${escapeHtml(step.instruction).replace(/\n/g,'<br>')}</p>`:''}${src?`<img alt="Captura da etapa ${i+1}" src="${src}">`:''}${step.transcript?`<blockquote><strong>Narração</strong><br>${escapeHtml(step.transcript).replace(/\n/g,'<br>')}</blockquote>`:''}${clip?(step.clipFormat==='gif'?`<img alt="Demonstração da etapa" src="media/clip-${i+1}.${ext(clip.blob.type)}">`:`<video controls src="media/clip-${i+1}.${ext(clip.blob.type)}"></video>`):''}${external&&book.audioId?`<button data-time="${step.time}">Ouvir a partir desta etapa</button>`:''}</section>`;
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(book.title)}</title><style>*{box-sizing:border-box}body{font:16px/1.65 system-ui,sans-serif;color:#17263c;background:#edf2f8;margin:0}main{max-width:960px;margin:auto;background:white;padding:64px}header{border-bottom:3px solid #2479ef;margin-bottom:40px;padding-bottom:32px}small,.step-meta{font-size:12px;color:#49709d;letter-spacing:1px}h1{font-size:36px;line-height:1.15}h2{font-size:24px}section{margin:40px 0;break-inside:avoid}img{max-width:100%;border:1px solid #dbe3ed;border-radius:8px}blockquote{background:#f2f6fc;border-left:3px solid #3289ff;padding:16px;margin:20px 0}button{padding:10px 16px;border:0;background:#1769d9;color:white;border-radius:6px;cursor:pointer}audio,video{width:100%;margin:16px 0}footer{font-size:12px;color:#6a7a8f;border-top:1px solid #ddd;padding-top:20px}@media print{body{background:white}main{padding:0;max-width:none}button,audio,video{display:none}h1{font-size:28px}section{break-inside:auto}img{max-height:170mm;object-fit:contain}blockquote{break-inside:avoid}@page{size:A4;margin:18mm}}</style></head><body><main><header><small>PLAYBOOK STUDIO · MANUAL DE PROCESSO</small><h1>${escapeHtml(book.title)}</h1><p>${escapeHtml(book.description)}</p><p>${escapeHtml(book.role)} · Versão ${book.version} · ${book.steps.length} etapas · ${formatTime(book.duration)}</p></header>${external&&book.audioId?`<h2>Áudio original</h2><audio id="narration" controls src="media/audio.${ext((await getAsset(book.audioId))?.blob.type||'audio/webm')}"></audio>`:''}${external&&book.videoId?`<h2>Gravação da tela</h2><video controls src="media/screen.${ext((await getAsset(book.videoId))?.blob.type||'video/webm')}"></video>`:''}${body}<footer>Playbook Studio · Revisado em ${new Date(book.updatedAt).toLocaleDateString('pt-BR')} · Os destaques são anotações sobre as capturas.</footer></main>${external?'<script>document.querySelectorAll("[data-time]").forEach(b=>b.addEventListener("click",()=>{const a=document.getElementById("narration");if(a){a.currentTime=Number(b.dataset.time);a.play();}}));</script>':''}</body></html>`;
}
export async function exportPdf(book:Playbook){
  const w=window.open('','_blank');if(!w)throw new Error('Permita a abertura da janela de impressão para exportar o PDF.');
  try{w.document.write('<p style="font:16px system-ui;padding:30px">Preparando documento…</p>');const html=await printableHtml(book);w.document.open();w.document.write(html);w.document.close();await Promise.all([...w.document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r;})));w.focus();w.print();}catch(e){w.close();throw e;}
}
export async function exportWord(book:Playbook){
  const {Document,Packer,Paragraph,TextRun,ImageRun,HeadingLevel}=await import('docx');
  const children:any[]=[new Paragraph({text:book.title,heading:HeadingLevel.TITLE}),new Paragraph({text:`${book.role} · Versão ${book.version} · ${book.steps.length} etapas`}),new Paragraph(book.description)];
  for(const [i,step] of book.steps.entries()){
    children.push(new Paragraph({text:`${i+1}. ${step.title}`,heading:HeadingLevel.HEADING_1}),new Paragraph(step.instruction));
    if(step.imageId){const blob=await annotatedImage(step.imageId,step.annotations);const bitmap=await createImageBitmap(blob);const scale=Math.min(580/bitmap.width,700/bitmap.height);const width=bitmap.width*scale,height=bitmap.height*scale;bitmap.close();children.push(new Paragraph({children:[new ImageRun({data:await blob.arrayBuffer(),type:'png',transformation:{width,height}})]}));}
    if(step.transcript)children.push(new Paragraph({children:[new TextRun({text:'Narração: ',bold:true}),new TextRun(step.transcript)]}));
    children.push(new Paragraph(`Tempo: ${formatTime(step.time)} a ${formatTime(step.endTime)}`));
  }
  children.push(new Paragraph('Áudio e vídeo disponíveis separadamente no pacote HTML multimídia.'));
  download(await Packer.toBlob(new Document({sections:[{children}]})),`${safeName(book.title)}.docx`);
}
export async function exportHtml(book:Playbook){
  const zip=new JSZip();zip.file('index.html',await printableHtml(book,true));
  for(const [i,step] of book.steps.entries()){if(step.imageId)zip.file(`media/step-${i+1}.png`,await annotatedImage(step.imageId,step.annotations));const clip=await getAsset(step.clipId);if(clip)zip.file(`media/clip-${i+1}.${ext(clip.blob.type)}`,clip.blob);}
  for(const [assetId,name] of [[book.audioId,'audio'],[book.videoId,'screen']] as const){const asset=await getAsset(assetId);if(asset)zip.file(`media/${name}.${ext(asset.blob.type)}`,asset.blob);}
  zip.file('LEIA-ME.txt','Extraia todos os arquivos e abra index.html no navegador. Este pacote inclui áudio e vídeo originais quando disponíveis. As imagens das etapas contêm as ocultações aplicadas no editor; o vídeo e o áudio originais precisam de revisão separada antes do compartilhamento.');
  download(await zip.generateAsync({type:'blob',compression:'STORE'}),`${safeName(book.title)} - tutorial.zip`);
}
