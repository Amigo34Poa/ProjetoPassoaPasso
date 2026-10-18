import type { Playbook, Step } from './types';

const speechActions:[RegExp,string][]=[
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:abrir|abro)\b/i,'Abra'],
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:clicar|clico)\b/i,'Clique'],
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:selecionar|seleciono)\b/i,'Selecione'],
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:preencher|preencho)\b/i,'Preencha'],
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:digitar|digito)\b/i,'Digite'],
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:pesquisar|pesquiso)\b/i,'Pesquise'],
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:acessar|acesso)\b/i,'Acesse'],
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:salvar|salvo)\b/i,'Salve'],
  [/^(?:(?:eu|a gente)\s+)?(?:vou\s+)?(?:confirmar|confirmo)\b/i,'Confirme'],
];
function compact(text:string){return text.replace(/\s+/g,' ').trim();}
function titleExcerpt(text:string){
  // Titles are short excerpts, rather than invented semantic summaries.
  const first=text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/u)[0];
  if(first.length<=100)return first.replace(/[.!?]+$/,'');
  const excerpt=first.slice(0,97).replace(/\s+\S*$/,'');return `${excerpt||first.slice(0,97)}…`;
}
export function isGenericTitle(title:string){return !title.trim()||/^Etapa\s+\d+$/i.test(title)||/^Ação em /i.test(title)||title==='Nova etapa';}
export function localSuggestion(step:Step):{title:string;instruction:string;basis:'narration'|'click'|'none'}{
  const literal=compact(step.transcript);
  if(literal){
    let instruction=literal;
    // Only change an explicit leading first-person action; preserve negation and the rest verbatim.
    const leading=literal.replace(/^(?:Agora|Então|Em seguida|Primeiramente),?\s+/i,'');
    const simpleAction=!/\b(?:e|mas|ou|quando|enquanto|porque)\b/i.test(leading);
    if(simpleAction&&/^(?:(?:eu|a gente)\s+|vou\s+)/i.test(leading))for(const [pattern,verb]of speechActions)if(pattern.test(leading)){instruction=leading.replace(pattern,verb);break;}
    instruction=instruction[0].toLocaleUpperCase('pt-BR')+instruction.slice(1);
    return {title:titleExcerpt(instruction),instruction,basis:'narration'};
  }
  if(step.source==='click'&&step.annotations.some(a=>a.type==='circle'||a.type==='box'||a.type==='arrow')){
    const right=step.action?.button==='right';
    return {title:right?'Clique com o botão direito':'Clique no ponto destacado',instruction:right?'Clique com o botão direito no ponto destacado.':'Clique no ponto destacado.',basis:'click'};
  }
  return {title:step.title,instruction:step.instruction,basis:'none'};
}
export function fillLocalDrafts(steps:Step[]):Step[]{
  return steps.map(step=>{
    const suggestion=localSuggestion(step);
    if(suggestion.basis==='none')return step;
    const title=isGenericTitle(step.title)?suggestion.title:step.title;
    const instruction=step.instruction.trim()?step.instruction:suggestion.instruction;
    return title!==step.title||instruction!==step.instruction?{...step,title,instruction,draftOrigin:'local-rules'}:step;
  });
}
export type ReviewIssue={stepId:string;index:number;message:string};
export function reviewIssues(book:Playbook):ReviewIssue[]{
  const issues:ReviewIssue[]=[];
  book.steps.forEach((step,index)=>{
    if(isGenericTitle(step.title))issues.push({stepId:step.id,index,message:'Dê um título que explique a ação.'});
    if(!step.transcript.trim()&&!step.instruction.trim())issues.push({stepId:step.id,index,message:'Inclua uma narração ou instrução para a equipe.'});
    if(!step.imageId)issues.push({stepId:step.id,index,message:'Esta etapa ainda não tem uma captura.'});
    if(step.time>step.endTime||step.time>book.duration&&book.duration>0)issues.push({stepId:step.id,index,message:'Confira o intervalo de tempo desta etapa.'});
  });return issues;
}
