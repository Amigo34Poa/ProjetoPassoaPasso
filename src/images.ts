import type { Annotation } from './types';
import { getAsset } from './db';
import { HIGHLIGHT_COLOR, HIGHLIGHT_OPACITY } from './highlights';
export function loadImage(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Não foi possível abrir a imagem.'));image.src=src;});}
export function paintAnnotation(ctx:CanvasRenderingContext2D,a:Annotation,width:number,height:number,original?:CanvasImageSource){
  const x=a.x*width,y=a.y*height,x2=a.x2*width,y2=a.y2*height;
  ctx.save();ctx.strokeStyle='#2d8cff';ctx.fillStyle='#2d8cff';ctx.lineWidth=Math.max(3,width/380);ctx.lineJoin='round';
  if(a.type==='highlight'){
    ctx.fillStyle=HIGHLIGHT_COLOR;ctx.globalAlpha=HIGHLIGHT_OPACITY;
    ctx.fillRect(Math.min(x,x2),Math.min(y,y2),Math.abs(x2-x),Math.abs(y2-y));
    ctx.strokeStyle=HIGHLIGHT_COLOR;ctx.globalAlpha=.8;ctx.lineWidth=Math.max(1,width/960);
    ctx.beginPath();ctx.moveTo(Math.min(x,x2),Math.max(y,y2));ctx.lineTo(Math.max(x,x2),Math.max(y,y2));ctx.stroke();ctx.globalAlpha=1;
  }
  if(a.type==='circle'){ctx.beginPath();ctx.ellipse((x+x2)/2,(y+y2)/2,Math.max(4,Math.abs(x2-x)/2),Math.max(4,Math.abs(y2-y)/2),0,0,Math.PI*2);ctx.stroke();}
  if(a.type==='box')ctx.strokeRect(Math.min(x,x2),Math.min(y,y2),Math.abs(x2-x),Math.abs(y2-y));
  if(a.type==='arrow'){
    const angle=Math.atan2(y2-y,x2-x),head=Math.max(14,width/65);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(angle-.45),y2-head*Math.sin(angle-.45));ctx.lineTo(x2-head*Math.cos(angle+.45),y2-head*Math.sin(angle+.45));ctx.closePath();ctx.fill();
  }
  if(a.type==='blur'){
    // Opaque redaction rather than a reversible blur. Export rasterization excludes hidden pixels.
    ctx.fillStyle='#111827';ctx.fillRect(Math.min(x,x2),Math.min(y,y2),Math.abs(x2-x),Math.abs(y2-y));
  }
  if(a.text){const size=Math.max(15,width/65);ctx.font=`600 ${size}px sans-serif`;const metrics=ctx.measureText(a.text);const tx=Math.min(x,width-metrics.width-24),ty=Math.max(size+12,y-8);ctx.fillStyle='#1262d7';ctx.fillRect(Math.max(0,tx),ty-size-8,metrics.width+20,size+16);ctx.fillStyle='white';ctx.fillText(a.text,Math.max(0,tx)+10,ty);}
  ctx.restore();
}
export async function annotatedImage(imageId:string,annotations:Annotation[]):Promise<Blob>{
  const asset=await getAsset(imageId);if(!asset)throw new Error('Captura não encontrada.');
  const url=URL.createObjectURL(asset.blob);
  try{const image=await loadImage(url);const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);for(const a of annotations)paintAnnotation(ctx,a,canvas.width,canvas.height,image);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao renderizar imagem.')),'image/png'));}
  finally{URL.revokeObjectURL(url);}
}
