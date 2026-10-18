import type { Step, Transcript } from './types';
export function transcriptAssignments(steps:Step[],segments:Transcript[],duration:number):Map<string,string|null>{
  const ordered=steps.map((step,index)=>({step,index})).sort((a,b)=>a.step.time-b.step.time||a.index-b.index);
  const assignments=new Map<string,string|null>();
  for(const segment of segments){
    if(segment.stepId===null){assignments.set(segment.id,null);continue;}
    if(segment.stepId&&steps.some(s=>s.id===segment.stepId)){assignments.set(segment.id,segment.stepId);continue;}
    if(!segment.text.trim()||!Number.isFinite(segment.time)||!Number.isFinite(segment.endTime)||!ordered.length||segment.time>duration){assignments.set(segment.id,null);continue;}
    const start=Math.max(0,segment.time),end=Math.max(start,Math.min(duration,segment.endTime));
    let chosen:string|null=null;let largest=-1;
    for(let i=0;i<ordered.length;i++){
      const step=ordered[i].step;const from=i===0?0:step.time;const to=Math.max(from,ordered[i+1]?.step.time??duration);
      const overlap=Math.max(0,Math.min(to,end)-Math.max(from,start));
      const contains=start>=from&&(start<to||(i===ordered.length-1&&start===to));
      // A phrase stays whole. Ties prefer the interval containing its start.
      if(overlap>largest||(overlap===largest&&contains)){largest=overlap;chosen=step.id;}
    }
    assignments.set(segment.id,chosen);
  }
  return assignments;
}
export function attachTranscripts(steps:Step[],segments:Transcript[],duration:number):Step[]{
  const assignments=transcriptAssignments(steps,segments,duration);
  const chronological=[...steps].sort((a,b)=>a.time-b.time);
  return steps.map(step=>{
    const index=chronological.findIndex(s=>s.id===step.id);
    const matching=segments.filter(t=>assignments.get(t.id)===step.id).sort((a,b)=>a.time-b.time);
    return {...step,endTime:Math.max(step.time,chronological[index+1]?.time??duration),transcript:matching.map(t=>t.text.trim()).filter(Boolean).join(' '),transcriptIds:matching.map(t=>t.id)};
  });
}
export function boundedPoint(x:number,y:number){return {x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};}
export function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function pcm16Wav(samples:Float32Array,rate=16000){
  const bytes=new ArrayBuffer(44+samples.length*2);const view=new DataView(bytes);
  const str=(o:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
  str(0,'RIFF');view.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*(samples[i]<0?32768:32767),true);
  return new Blob([bytes],{type:'audio/wav'});
}
