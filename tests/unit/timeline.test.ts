import { describe,it,expect } from 'vitest';
import { attachTranscripts,pcm16Wav,escapeHtml } from '../../src/timeline';
import { createBook,formatTime,type Step } from '../../src/types';
describe('recording timeline',()=>{
  const step=(time:number):Step=>({id:String(time),title:'Etapa',time,endTime:time,transcript:'',instruction:'',annotations:[],source:'manual'});
  it('associates each transcript once, with the next boundary exclusive',()=>{
    const segments=[{id:'1',text:'Abra o sistema.',time:0,endTime:3,source:'browser'},{id:'2',text:'Agora clique.',time:5,endTime:8,source:'browser'},{id:'3',text:'Conclua.',time:8,endTime:9,source:'browser'}];
    const result=attachTranscripts([step(0),step(5)],segments,12);
    expect(result.map(s=>s.transcript)).toEqual(['Abra o sistema.','Agora clique. Conclua.']);expect(result.map(s=>s.endTime)).toEqual([5,12]);
  });
  it('encodes signed little-endian PCM audio with a valid WAV header',async()=>{
    const data=await pcm16Wav(new Float32Array([-1,0,1]),16000).arrayBuffer();const v=new DataView(data);
    expect(new TextDecoder().decode(data.slice(0,4))).toBe('RIFF');expect(v.getUint32(24,true)).toBe(16000);expect(v.getUint32(40,true)).toBe(6);expect(v.getInt16(44,true)).toBe(-32768);expect(v.getInt16(48,true)).toBe(32767);
  });
  it('escapes untrusted document content in exported HTML',()=>expect(escapeHtml('<script>"x" & \'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;'));
  it('keeps initial documents local drafts with the selected business role',()=>{const b=createBook('  Cadastro  ','Pós-Vendas');expect(b.title).toBe('Cadastro');expect(b.role).toBe('Pós-Vendas');expect(b.status).toBe('draft');expect(b.steps).toEqual([]);});
  it('formats recording durations past one hour without losing minutes',()=>expect(formatTime(3661)).toBe('61:01'));
});
