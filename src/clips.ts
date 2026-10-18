import { getAsset, saveAsset } from './db';
import { id } from './types';
export async function createGif(videoId:string,bookId:string,start:number,end:number){
  const asset=await getAsset(videoId);if(!asset)throw new Error('A gravação da tela não está disponível.');
  if(end<=start||end-start>6)throw new Error('Selecione um trecho de até 6 segundos para o GIF.');
  const worker=new Worker(new URL('./gif.worker.ts',import.meta.url),{type:'module'});
  const url=URL.createObjectURL(asset.blob);const video=document.createElement('video');video.src=url;video.muted=true;
  const message=(value:unknown,transfer:Transferable[]=[])=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('O processamento do GIF demorou demais. Tente um trecho menor.')),60000);worker.onmessage=e=>{clearTimeout(timer);e.data.type==='error'?reject(new Error('Falha ao codificar o GIF.')):resolve(e.data);};worker.onerror=()=>{clearTimeout(timer);reject(new Error('Codificador de GIF indisponível.'));};worker.postMessage(value,transfer);});
  try{
    await new Promise<void>((resolve,reject)=>{video.onloadeddata=()=>resolve();video.onerror=()=>reject(new Error('Vídeo não suportado.'));});
    const scale=Math.min(1,1920/video.videoWidth,1080/video.videoHeight);const canvas=document.createElement('canvas');canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    await message({type:'start'});
    for(let t=start;t<end;t+=.25){
      if(Math.abs(video.currentTime-t)>.02){video.currentTime=t;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Não foi possível acessar este trecho do vídeo.')),10000);video.onseeked=()=>{clearTimeout(timer);resolve();};});}
      ctx.drawImage(video,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      await message({type:'frame',rgba:pixels.buffer,width:canvas.width,height:canvas.height},[pixels.buffer]);
    }
    const result=await message({type:'finish'});const blob=new Blob([result.bytes],{type:'image/gif'});const clipId=id();await saveAsset({id:clipId,bookId,blob,kind:'image',createdAt:Date.now()});return clipId;
  }finally{worker.terminate();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
export async function createClip(videoId:string,bookId:string,start:number,end:number){
  const asset=await getAsset(videoId);if(!asset)throw new Error('A gravação da tela não está disponível.');
  if(end<=start||end-start>15)throw new Error('Selecione um trecho entre 1 e 15 segundos.');
  const url=URL.createObjectURL(asset.blob);const video=document.createElement('video');video.src=url;video.muted=true;video.playsInline=true;
  let animation=0;let stream:MediaStream|undefined;
  try{
    await new Promise<void>((resolve,reject)=>{video.onloadedmetadata=()=>resolve();video.onerror=()=>reject(new Error('Formato de vídeo não suportado.'));});
    video.currentTime=start;await new Promise<void>(resolve=>{video.onseeked=()=>resolve();if(start===0&&video.readyState>=2)resolve();});
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d')!;ctx.drawImage(video,0,0);
    stream=canvas.captureStream(12);const mime=['video/webm;codecs=vp8','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4_000_000});const chunks:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const finished=new Promise<Blob>((resolve,reject)=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));recorder.onerror=()=>reject(new Error('Não foi possível gerar o clipe.'));});
    const draw=()=>{ctx.drawImage(video,0,0);if(video.currentTime>=end||video.ended){video.pause();if(recorder.state!=='inactive')recorder.stop();return;}animation=requestAnimationFrame(draw);};
    recorder.start();await video.play();animation=requestAnimationFrame(draw);
    const timeout=setTimeout(()=>{video.pause();if(recorder.state!=='inactive')recorder.stop();},(end-start+5)*1000);
    const blob=await finished;clearTimeout(timeout);const clipId=id();await saveAsset({id:clipId,bookId,blob,kind:'video',createdAt:Date.now()});return clipId;
  }finally{cancelAnimationFrame(animation);video.pause();video.removeAttribute('src');video.load();stream?.getTracks().forEach(t=>t.stop());URL.revokeObjectURL(url);}
}
