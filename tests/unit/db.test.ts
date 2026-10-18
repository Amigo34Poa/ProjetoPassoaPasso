import 'fake-indexeddb/auto';
import { describe,it,expect } from 'vitest';
import {createBook,id} from '../../src/types';
import {deleteBook,getAsset,getBook,saveAsset,saveBook,recoverInterrupted,assembleChunks} from '../../src/db';
describe('local evidence persistence',()=>{
  it('recovers saved audio chunks after an interrupted recording',async()=>{
    const b=createBook('Gravação interrompida','SDR');const c1=id(),c2=id();b.status='recording';b.audioChunks=[c1,c2];await saveBook(b);
    for(const [key,text] of [[c1,'part-one'],[c2,'part-two']])await saveAsset({id:key,bookId:b.id,blob:new Blob([text],{type:'audio/webm'}),kind:'chunk',createdAt:Date.now()});
    expect(await (await assembleChunks(b,'audio'))?.text()).toBe('part-onepart-two');await recoverInterrupted();const recovered=await getBook(b.id);expect(recovered?.status).toBe('interrupted');expect(recovered?.audioId).toBeTruthy();expect(await (await getAsset(recovered?.audioId))?.blob.text()).toBe('part-onepart-two');await deleteBook(b.id);
  });
  it('deletes one project and its assets without removing another project',async()=>{
    const a=createBook('A','Assistente'),b=createBook('B','Gerente de Vendas');await saveBook(a);await saveBook(b);const image=id();await saveAsset({id:image,bookId:a.id,blob:new Blob(['img']),kind:'image',createdAt:Date.now()});await deleteBook(a.id);expect(await getBook(a.id)).toBeUndefined();expect(await getAsset(image)).toBeUndefined();expect((await getBook(b.id))?.title).toBe('B');await deleteBook(b.id);
  });
});
