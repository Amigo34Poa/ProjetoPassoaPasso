import { describe,expect,it } from 'vitest';
import { fillLocalDrafts,localSuggestion,reviewIssues } from '../../src/local-assistant';
import { attachTranscripts,transcriptAssignments } from '../../src/timeline';
import { createBook,type Step,type Transcript } from '../../src/types';
const step=(patch:Partial<Step>={}):Step=>({id:'step-1',title:'Etapa 1',transcript:'',instruction:'',time:0,endTime:10,annotations:[],source:'manual',...patch});
describe('local documentation assistant',()=>{
  it('turns an explicit spoken action into an instruction while preserving literal narration',()=>{
    const original=step({transcript:'Eu abro o navegador.'});const [result]=fillLocalDrafts([original]);
    expect(result.title).toBe('Abra o navegador');expect(result.instruction).toBe('Abra o navegador.');expect(result.transcript).toBe(original.transcript);expect(original.instruction).toBe('');
  });
  it.each(['Eu não clico em Salvar.','Salvo se o cliente confirmar, não conclua.','Antes de clicar, confira o cadastro.','Eu abro o navegador e pesquiso pelo CNPJ.'])('preserves compound actions, conditions and negation: %s',text=>expect(localSuggestion(step({transcript:text})).instruction).toBe(text));
  it('preserves authored titles and instructions by default',()=>{const original=step({title:'Cadastro validado',instruction:'Confira o CNPJ antes de continuar.',transcript:'Eu clico em Salvar.'});expect(fillLocalDrafts([original])[0]).toEqual(original);});
  it('does not infer a button function or successful result from a click',()=>{
    const result=localSuggestion(step({source:'click',window:'Cadastro',action:{button:'right',x:.4,y:.5},annotations:[{id:'a',type:'circle',x:.3,y:.4,x2:.5,y2:.6,text:''}]}));expect(result.instruction).toBe('Clique com o botão direito no ponto destacado.');expect(result.instruction).not.toContain('salv');expect(result.title).not.toContain('menu');
  });
  it('leaves an unexplained screenshot for human review instead of inventing instructions',()=>{
    const original=step({source:'automatic',imageId:'img'});expect(fillLocalDrafts([original])[0]).toEqual(original);const b={...createBook('Teste','SDR'),steps:[original]};expect(reviewIssues(b).map(i=>i.message)).toContain('Inclua uma narração ou instrução para a equipe.');
  });
});
describe('phrase alignment and user-selected links',()=>{
  const steps=[step({id:'one',time:0}),step({id:'two',time:5})];
  const segment=(patch:Partial<Transcript>={}):Transcript=>({id:'spoken',text:'Preencha o cadastro.',time:4,endTime:9,source:'browser',...patch});
  it('chooses the greatest temporal overlap and does not duplicate or split the phrase',()=>{const aligned=attachTranscripts(steps,[segment()],10);expect(aligned.map(s=>s.transcript)).toEqual(['','Preencha o cadastro.']);expect(aligned[1].transcriptIds).toEqual(['spoken']);});
  it('respects an explicit manual link even when time suggests a different step',()=>expect(attachTranscripts(steps,[segment({stepId:'one'})],10)[0].transcript).toBe('Preencha o cadastro.'));
  it('keeps intentionally unlinked narration in the original ledger',()=>{const original=segment({stepId:null});expect(attachTranscripts(steps,[original],10).every(s=>s.transcript==='')).toBe(true);expect(original.text).toBe('Preencha o cadastro.');});
  it('aligns by chronological time while preserving document order after a reorder',()=>{const aligned=attachTranscripts([...steps].reverse(),[segment()],10);expect(aligned.map(s=>s.id)).toEqual(['two','one']);expect(aligned[0].transcript).toBe('Preencha o cadastro.');expect(aligned[0].endTime).toBe(10);expect(aligned[1].endTime).toBe(5);});
  it('keeps a phrase spoken before the first screenshot and prefers the start interval on ties',()=>{const a=transcriptAssignments([step({id:'first',time:2}),step({id:'next',time:5})],[segment({time:0,endTime:1})],10);expect(a.get('spoken')).toBe('first');expect(transcriptAssignments(steps,[segment({time:3,endTime:7})],10).get('spoken')).toBe('one');});
});
