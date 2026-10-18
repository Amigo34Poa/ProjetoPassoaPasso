import { saveAsset, saveBook } from './db';
import { createBook, id, type Step } from './types';
export async function createDemo(){
  const book=createBook('Do primeiro contato à oportunidade','SDR');book.demo=true;book.description='Exemplo fictício para explorar o editor. Este conteúdo não foi gravado e não contém dados de clientes.';book.duration=94;
  const titles=['Abra a área de oportunidades','Preencha os dados do contato','Defina o próximo acompanhamento'];
  const transcripts=['No menu lateral, abra Oportunidades para consultar os contatos que estão em prospecção.','Selecione uma oportunidade e preencha o nome da empresa, o responsável e o canal de contato.','Antes de concluir, defina a próxima atividade para manter o acompanhamento organizado.'];
  const steps:Step[]=[];
  for(let i=0;i<3;i++){
    const c=document.createElement('canvas');c.width=1920;c.height=1080;const g=c.getContext('2d')!;
    g.fillStyle='#eff3f8';g.fillRect(0,0,1920,1080);g.fillStyle='#fff';g.fillRect(0,0,1920,85);g.fillStyle='#14283e';g.fillRect(0,85,285,995);
    g.font='bold 28px system-ui';g.fillStyle='#237bec';g.fillText('nexo',42,55);g.font='20px system-ui';g.fillStyle='#6c7c91';g.fillText('CRM demonstrativo • dados fictícios',320,53);
    ['Visão geral','Contatos','Oportunidades','Atividades','Relatórios'].forEach((t,j)=>{if(j===2){g.fillStyle='#234d79';g.fillRect(20,268,245,55);}g.fillStyle=j===2?'#a9d4ff':'#a7b6c8';g.fillText(t,48,175+j*65);});
    g.fillStyle='#172d45';g.font='bold 38px system-ui';g.fillText(i===0?'Suas oportunidades':'Nova oportunidade',335,175);g.fillStyle='#7c8b9e';g.font='21px system-ui';g.fillText('Organize as conversas que movem sua equipe.',335,220);
    if(i===0){['Prospecção','Em conversa','Qualificação'].forEach((t,j)=>{const x=335+j*505;g.fillStyle='#e4eaf3';g.fillRect(x,270,470,700);g.fillStyle='#445d79';g.font='bold 23px system-ui';g.fillText(t,x+22,315);['Empresa Horizonte','Empresa Aurora','Empresa Atlântico'].slice(0,j===1?2:3).forEach((n,k)=>{g.fillStyle='#fff';g.fillRect(x+15,350+k*170,440,145);g.fillStyle='#243a55';g.font='bold 24px system-ui';g.fillText(n,x+36,400+k*170);g.fillStyle='#8999ac';g.font='19px system-ui';g.fillText('Contato de demonstração',x+36,440+k*170);});});}
    else{g.fillStyle='#fff';g.fillRect(335,270,1220,700);['Empresa','Nome do contato','E-mail profissional','Canal de entrada','Próxima atividade'].forEach((t,j)=>{const y=325+j*115;g.fillStyle='#5b6f86';g.font='20px system-ui';g.fillText(t,375,y);g.strokeStyle='#dce4ef';g.strokeRect(375,y+15,1130,58);g.fillStyle='#233d59';g.font='22px system-ui';g.fillText(['Empresa Horizonte','Contato de exemplo','contato@example.com','Indicação','Agendar conversa de descoberta'][j],395,y+53);});g.fillStyle='#2276e5';g.fillRect(1295,980,260,60);g.fillStyle='white';g.fillText('Salvar oportunidade',1310,1019);}
    g.fillStyle='#647c98';g.font='18px system-ui';g.fillText('DEMONSTRAÇÃO · Nenhum dado real',1450,65);
    const blob=await new Promise<Blob>(r=>c.toBlob(b=>r(b!),'image/png'));const imageId=id();await saveAsset({id:imageId,bookId:book.id,blob,kind:'image',createdAt:Date.now()});
    steps.push({id:id(),title:titles[i],instruction:transcripts[i],transcript:transcripts[i],time:i*31,endTime:(i+1)*31,imageId,annotations:[{id:id(),type:i===0?'box':'circle',x:i===0?.01:.19,y:i===0?.25:i===1?.31:.77,x2:i===0?.14:.79,y2:i===0?.3:i===1?.37:.84,text:i===0?'Comece aqui':''}],source:'demo'});
  }
  book.steps=steps;await saveBook(book);return book;
}
