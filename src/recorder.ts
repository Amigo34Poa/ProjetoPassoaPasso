import { api, blobDataURL, dataURLBlob, socket } from './api';
import { finalizeRecording, saveAsset, saveBook } from './db';
import { attachTranscripts, pcm16Wav } from './timeline';
import { fillLocalDrafts } from './local-assistant';
import { clickHighlight, type TargetBounds } from './highlights';
import { id, type Config, type Playbook, type Step } from './types';

type Callbacks = { update:(book:Playbook)=>void; state:(state:{seconds:number;paused:boolean;level:number;transcript:string})=>void; error:(message:string)=>void; stopped:(book:Playbook)=>void; hotkey:(action:string)=>void };
type Options = { source:'browser'|'windows'; display:number; autoCapture:boolean; video:boolean; config:Config };
const mime = (kind:'audio'|'video') => (kind==='audio'?['audio/webm;codecs=opus','audio/mp4','audio/webm']:['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4']).find(t=>MediaRecorder.isTypeSupported(t));

export class StudioRecorder {
  book:Playbook;
  canvas=document.createElement('canvas');
  private ctx=this.canvas.getContext('2d')!;
  private mic?:MediaStream;
  private screen?:MediaStream;
  private audio?:MediaRecorder;
  private videoRecorder?:MediaRecorder;
  private videoElement?:HTMLVideoElement;
  private audioContext?:AudioContext;
  private recognition?:any;
  private live?:WebSocket;
  private native?:WebSocket;
  private startAt=0;
  private pauseAt=0;
  private pausedTotal=0;
  private paused=false;
  private active=false;
  private stopping=false;
  private timer?:ReturnType<typeof setInterval>;
  private queue:Promise<void>=Promise.resolve();
  private speechQueue:Promise<void>=Promise.resolve();
  private lastMark=-99;
  private lastSave=0;
  private fingerprint?:Uint8ClampedArray;
  private diffCanvas=document.createElement('canvas');
  private pcm:Float32Array[]=[];
  private pcmSize=0;
  private pcmStart=0;
  private interim='';
  private level=0;
  private speechStart=0;
  private liveReady=false;
  private liveBuffer:{data:string;time:number}[]=[];
  private inflightSpeech=0;
  private lastSpeechEnd=0;
  private failedSpeech=false;
  private fatalStorage=false;
  private imageDrawing=false;
  private pendingImages=0;

  constructor(book:Playbook,private options:Options,private callbacks:Callbacks){this.book=book;this.diffCanvas.width=32;this.diffCanvas.height=18;}
  get elapsed(){return Math.max(0,((this.paused?this.pauseAt:performance.now())-this.startAt-this.pausedTotal)/1000);}
  private emit(){this.callbacks.update({...this.book,steps:[...this.book.steps],transcript:[...this.book.transcript]});}
  private persist(){
    this.book.duration=this.elapsed;
    const snapshot=structuredClone(this.book);
    this.queue=this.queue.then(()=>saveBook(snapshot)).catch(()=>{this.fatalStorage=true;this.callbacks.error('O armazenamento local falhou. Pare a gravação e exporte o conteúdo disponível; verifique o espaço livre.');});
  }
  async start(){
    try {
      if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)throw new Error('Este navegador não oferece as APIs necessárias. Abra no Edge ou Chrome atualizado.');
      // getDisplayMedia must be invoked directly from the user gesture.
      if(this.options.source==='browser')this.screen=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:15,max:30}},audio:false});
      this.mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      this.book.status='recording';this.book.recordingSource=this.options.source;
      this.book.audioChunks=[];this.book.videoChunks=[];
      this.startAt=performance.now();this.active=true;
      await saveBook(this.book);
      void navigator.storage?.persist?.().catch(()=>{});
      if(this.options.source==='browser'){
        this.videoElement=document.createElement('video');this.videoElement.muted=true;this.videoElement.playsInline=true;this.videoElement.srcObject=this.screen!;await this.videoElement.play();
        this.canvas.width=this.videoElement.videoWidth;this.canvas.height=this.videoElement.videoHeight;
        this.drawBrowser();
        this.screen!.getVideoTracks()[0].addEventListener('ended',()=>{if(this.active&&!this.stopping)void this.stop();});
      }else{
        const display=this.options.config.native.displays.find(d=>d.id===this.options.display)!;
        this.canvas.width=display.width;this.canvas.height=display.height;
        if(this.options.config.native.mouseHook===false)this.callbacks.error('O Windows não habilitou o detector de cliques. A captura continua; marque as etapas manualmente.');
        this.native=socket('/native');
        await new Promise<void>((resolve,reject)=>{this.native!.onopen=()=>resolve();this.native!.onerror=()=>reject(new Error('Não foi possível conectar o capturador Windows.'));});
        this.native.onmessage=e=>this.nativeEvent(JSON.parse(e.data));
        await api('/api/native/start',{display:this.options.display,speech:this.options.config.provider==='windows'});
        this.native.onclose=()=>{if(this.active&&!this.stopping){this.callbacks.error('Capturador desconectado. A gravação foi finalizada para preservar o conteúdo.');void this.stop();}};
      }
      this.startAt=performance.now();
      this.audio=new MediaRecorder(this.mic,{mimeType:mime('audio')});this.watchChunks(this.audio,'audio');this.audio.start(2500);
      if(this.options.video && this.options.source==='browser')this.startVideo(new MediaStream(this.screen!.getVideoTracks()));
      if(this.options.video && this.options.source==='windows'){
        const d=this.options.config.native.displays.find(d=>d.id===this.options.display)!;
        this.canvas.width=d.width;this.canvas.height=d.height;this.startVideo(this.canvas.captureStream(4));
      }
      this.startTranscription();
      try{await this.startPCM();}catch{this.callbacks.error('Processamento de áudio ao vivo indisponível. O áudio original continua sendo gravado.');}
      this.timer=setInterval(()=>{
        if(!this.active)return;
        this.callbacks.state({seconds:this.elapsed,paused:this.paused,level:this.level,transcript:this.interim});
        if(!this.paused&&this.options.source==='browser')this.drawBrowser();
        if(!this.paused&&this.options.autoCapture)this.checkChange();
        if(performance.now()-this.lastSave>2500){this.lastSave=performance.now();this.persist();}
      },250);
      this.emit();
    }catch(e){this.active=false;this.cleanup();if(this.options.source==='windows')void api('/api/native/stop',{}).catch(()=>{});this.book.status='interrupted';await saveBook(this.book);throw e;}
  }
  private drawBrowser(){if(this.videoElement?.readyState!>=2)this.ctx.drawImage(this.videoElement!,0,0,this.canvas.width,this.canvas.height);}
  private startVideo(stream:MediaStream){this.videoRecorder=new MediaRecorder(stream,{mimeType:mime('video'),videoBitsPerSecond:4_000_000});this.watchChunks(this.videoRecorder,'video');this.videoRecorder.start(2500);}
  private watchChunks(recorder:MediaRecorder,kind:'audio'|'video'){
    recorder.ondataavailable=e=>{if(!e.data.size)return;const assetId=id();(kind==='audio'?this.book.audioChunks!:this.book.videoChunks!).push(assetId);
      const snapshot=structuredClone(this.book);
      this.queue=this.queue.then(async()=>{await saveAsset({id:assetId,bookId:this.book.id,blob:e.data,kind:'chunk',createdAt:Date.now()});await saveBook(snapshot);}).catch(()=>{this.fatalStorage=true;this.callbacks.error('Não foi possível salvar um trecho da gravação. Verifique o espaço disponível.');});
    };
    recorder.onerror=()=>{this.callbacks.error('O navegador interrompeu a gravação de mídia. Os trechos já salvos serão preservados.');if(!this.stopping)void this.stop();};
  }
  private nativeEvent(event:any){
    if(event.type==='hotkey'){this.callbacks.hotkey(event.action);return;}
    if(!this.active||this.paused||this.stopping)return;
    if(event.type==='error'){this.callbacks.error(event.message);return;}
    if(event.type==='frame'){
      if(this.imageDrawing)return;
      this.imageDrawing=true;
      const image=new Image();image.onload=()=>{if(this.active&&!this.paused){this.ctx.drawImage(image,0,0,this.canvas.width,this.canvas.height);if(!this.book.steps.length)void this.mark('automatic');}this.imageDrawing=false;};image.onerror=()=>{this.imageDrawing=false;};image.src=event.image;
    }
    if(event.type==='click' && this.elapsed-this.lastMark>0.9)void this.mark('click',{x:event.x,y:event.y,target:event.target,image:event.image,window:event.window,button:event.button==='right'?'right':'left'});
    if(event.type==='transcript')this.addTranscript(event.text,'windows');
  }
  private checkChange(){
    if(!this.canvas.width)return;
    if(!this.book.steps.length){void this.mark('automatic');return;}
    const ctx=this.diffCanvas.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(this.canvas,0,0,32,18);const next=ctx.getImageData(0,0,32,18).data;
    if(this.fingerprint&&this.elapsed-this.lastMark>6){let sum=0;for(let i=0;i<next.length;i+=4)sum+=Math.abs(next[i]-this.fingerprint[i])+Math.abs(next[i+1]-this.fingerprint[i+1])+Math.abs(next[i+2]-this.fingerprint[i+2]);if(sum/(32*18*3)>14)void this.mark('automatic');}
    if(!this.fingerprint||this.elapsed-this.lastMark<0.5)this.fingerprint=new Uint8ClampedArray(next);
  }
  async mark(source:Step['source']='manual',click?:{x:number;y:number;target?:TargetBounds;image?:string;window?:string;button?:'left'|'right'}){
    if(!this.active||this.paused||this.stopping||!this.canvas.width)return;
    const time=this.book.steps.length?this.elapsed:0;this.lastMark=time;
    const imageId=id();
    // Reserve order synchronously; asynchronous PNG encoding must not reorder clicks.
    const step:Step={id:id(),title:click?.window?`Ação em ${click.window.slice(0,75)}`:`Etapa ${this.book.steps.length+1}`,transcript:'',instruction:'',time,endTime:time,imageId,annotations:click?[clickHighlight(click,this.canvas.width,this.canvas.height)]:[],source,window:click?.window};
    if(click)step.action={button:click.button||'left',x:click.x,y:click.y};
    this.book.steps.push(step);this.emit();this.pendingImages++;
    try{
      const blob=click?.image?.startsWith('data:image/png;base64,')?await dataURLBlob(click.image):await new Promise<Blob>((resolve,reject)=>this.canvas.toBlob(b=>b?resolve(b):reject(new Error('Captura vazia.')),'image/png'));
      this.queue=this.queue.then(()=>saveAsset({id:imageId,bookId:this.book.id,blob,kind:'image',createdAt:Date.now()}));
      this.persist();
    }catch{this.callbacks.error('Uma captura não pôde ser salva. Marque a etapa novamente.');}finally{this.pendingImages--;}
  }
  async togglePause(){
    if(!this.active||this.stopping)return;
    if(!this.paused){this.pauseAt=performance.now();this.paused=true;this.audio?.pause();this.videoRecorder?.pause();this.recognition?.stop();this.flushPCM();}
    else{this.pausedTotal+=performance.now()-this.pauseAt;this.paused=false;this.audio?.resume();this.videoRecorder?.resume();if(this.options.config.provider==='browser')this.startBrowserSpeech();}
    if(this.options.source==='windows')await api('/api/native/pause',{paused:this.paused});
    this.callbacks.state({seconds:this.elapsed,paused:this.paused,level:0,transcript:this.interim});
  }
  private addTranscript(text:string,source:string,start?:number,end?:number){
    if(!text.trim())return;
    const endTime=end??this.elapsed;
    const time=start??Math.max(this.lastSpeechEnd,endTime-Math.max(1,text.split(/\s+/).length/2.5));
    this.book.transcript.push({id:id(),text:text.trim(),time:Math.max(0,time),endTime:Math.max(time,endTime),source});this.lastSpeechEnd=endTime;
    this.interim='';this.emit();this.persist();
  }
  private startTranscription(){
    if(this.options.config.provider==='browser')this.startBrowserSpeech();
    if(this.options.config.provider==='gemini'&&this.options.config.configured&&this.options.config.consent){
      this.live=socket('/live');
      this.live.onmessage=e=>{const event=JSON.parse(e.data);
        if(event.type==='ready'){this.liveReady=true;for(const chunk of this.liveBuffer)this.live!.send(JSON.stringify({type:'audio',...chunk}));this.liveBuffer=[];}
        if(event.type==='transcript'){
          this.interim+=event.text||'';
          if(!this.speechStart)this.speechStart=Math.max(0,this.elapsed-2);
          if(event.finished){this.addTranscript(this.interim,'gemini-live',this.speechStart,this.elapsed);this.speechStart=0;}
        }
        if(event.type==='error'){this.failedSpeech=true;this.callbacks.error(event.message);}
      };
      this.live.onclose=()=>{this.liveReady=false;if(this.active&&!this.stopping&&!this.failedSpeech){this.failedSpeech=true;this.callbacks.error('Transcrição Live desconectada. O áudio original continua sendo gravado.');}};
    }
  }
  private startBrowserSpeech(){
    const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!Recognition){this.callbacks.error('Este navegador não oferece reconhecimento de voz. O áudio será preservado. Use Chrome compatível, o reconhecedor Windows ou uma API.');return;}
    const rec=new Recognition();this.recognition=rec;rec.lang='pt-BR';rec.continuous=true;rec.interimResults=true;
    rec.onresult=(event:any)=>{let interim='';for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)this.addTranscript(event.results[i][0].transcript,'browser');else interim+=event.results[i][0].transcript;this.interim=interim;};
    rec.onerror=(event:any)=>{if(!['no-speech','aborted'].includes(event.error)){this.failedSpeech=true;this.callbacks.error('O reconhecimento do navegador não ficou disponível. Sua gravação de áudio continua. Você pode configurar uma API ou editar a transcrição depois.');}};
    rec.onend=()=>{if(this.active&&!this.paused&&!this.stopping&&!this.failedSpeech)setTimeout(()=>{try{rec.start();}catch{}},350);};
    try{rec.start();}catch{this.callbacks.error('Não foi possível iniciar a transcrição do navegador. O áudio original continua.');}
  }
  private async startPCM(){
    this.audioContext=new AudioContext({sampleRate:16000});await this.audioContext.audioWorklet.addModule('/pcm-worklet.js');await this.audioContext.resume();
    const source=this.audioContext.createMediaStreamSource(this.mic!);const worklet=new AudioWorkletNode(this.audioContext,'playbook-pcm');
    const mute=this.audioContext.createGain();mute.gain.value=0;source.connect(worklet);worklet.connect(mute);mute.connect(this.audioContext.destination);
    worklet.port.onmessage=e=>{
      if(!this.active||this.paused||this.stopping)return;
      const samples=e.data as Float32Array;let energy=0;for(const x of samples)energy+=x*x;this.level=Math.min(1,Math.sqrt(energy/samples.length)*5);
      if(this.options.config.provider==='gemini'){
        const bytes=new Uint8Array(samples.length*2);const view=new DataView(bytes.buffer);for(let i=0;i<samples.length;i++)view.setInt16(i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);
        let s='';for(const n of bytes)s+=String.fromCharCode(n);const chunk={data:btoa(s),time:this.elapsed};
        if(this.liveReady&&this.live?.readyState===WebSocket.OPEN&&this.live.bufferedAmount<200000)this.live.send(JSON.stringify({type:'audio',...chunk}));
        else if(!this.failedSpeech&&this.liveBuffer.length<100)this.liveBuffer.push(chunk);
      }
      if(this.options.config.provider==='openai'&&this.options.config.configured&&this.options.config.consent&&!this.failedSpeech){
        if(!this.pcm.length)this.pcmStart=this.elapsed;this.pcm.push(samples);this.pcmSize+=samples.length;
        if(this.pcmSize>=16000*8)this.flushPCM();
      }
    };
  }
  private flushPCM(){
    if(!this.pcmSize)return;
    const samples=new Float32Array(this.pcmSize);let offset=0;for(const part of this.pcm){samples.set(part,offset);offset+=part.length;}
    const start=this.pcmStart,end=start+samples.length/16000;this.pcm=[];this.pcmSize=0;
    if(this.inflightSpeech>=4){this.failedSpeech=true;this.callbacks.error('Transcrição atrasada; o áudio original foi preservado para transcrever depois.');return;}
    this.inflightSpeech++;
    this.speechQueue=this.speechQueue.then(async()=>{
      try{const audio=(await blobDataURL(pcm16Wav(samples))).split(',')[1];const result=await api<{text:string}>('/api/transcribe',{audio,mimeType:'audio/wav'});this.addTranscript(result.text,'openai',start,end);}
      catch(e){this.failedSpeech=true;this.callbacks.error((e as Error).message);}finally{this.inflightSpeech--;}
    });
  }
  async stop(){
    if(this.stopping||!this.active)return this.book;
    this.stopping=true;const duration=this.elapsed;clearInterval(this.timer);this.recognition?.stop();this.flushPCM();
    const mediaStopped=Promise.all([this.audio,this.videoRecorder].map(r=>new Promise<void>(resolve=>{if(!r||r.state==='inactive')return resolve();r.addEventListener('stop',()=>resolve(),{once:true});r.stop();})));
    if(this.live?.readyState===WebSocket.OPEN){this.live.send(JSON.stringify({type:'stop'}));await Promise.race([new Promise(r=>this.live!.addEventListener('close',r,{once:true})),new Promise(r=>setTimeout(r,2300))]);}
    if(this.interim.trim())this.addTranscript(this.interim,this.options.config.provider==='gemini'?'gemini-live':'browser');
    await mediaStopped;
    this.active=false;
    if(this.options.source==='windows')await api('/api/native/stop',{}).catch(()=>{});
    this.cleanup();
    while(this.pendingImages)await new Promise(r=>setTimeout(r,25));
    await this.speechQueue;await this.queue;
    this.book.duration=duration;this.book.status=this.fatalStorage?'interrupted':'draft';this.book.steps=fillLocalDrafts(attachTranscripts(this.book.steps,this.book.transcript,duration));this.book.updatedAt=new Date().toISOString();
    try{this.book=await finalizeRecording(this.book);}catch{this.book.status='interrupted';await saveBook(this.book).catch(()=>{});this.callbacks.error('Não foi possível consolidar as mídias. Os trechos salvos foram preservados para recuperação ou backup.');}
    this.callbacks.stopped(this.book);return this.book;
  }
  private cleanup(){clearInterval(this.timer);this.mic?.getTracks().forEach(t=>t.stop());this.screen?.getTracks().forEach(t=>t.stop());this.videoRecorder?.stream.getTracks().forEach(t=>t.stop());this.recognition?.abort();this.live?.close();this.native?.close();void this.audioContext?.close();if(this.videoElement){this.videoElement.pause();this.videoElement.srcObject=null;}}
}
