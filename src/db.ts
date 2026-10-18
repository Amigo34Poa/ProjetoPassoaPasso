import { openDB, type DBSchema } from 'idb';
import type { Playbook, Asset } from './types';
interface StudioDB extends DBSchema {
  books: { key: string; value: Playbook };
  assets: { key: string; value: Asset; indexes: { 'by-book': string } };
}
const connection = () => openDB<StudioDB>('playbook-studio',1,{upgrade(db){
  db.createObjectStore('books',{keyPath:'id'});
  db.createObjectStore('assets',{keyPath:'id'}).createIndex('by-book','bookId');
}});
export async function listBooks(){return (await (await connection()).getAll('books')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function getBook(bookId:string){return (await connection()).get('books',bookId);}
export async function saveBook(book:Playbook){ await (await connection()).put('books',book); }
export async function saveAsset(asset:Asset){await (await connection()).put('assets',asset);}
export async function getAsset(assetId?:string){return assetId ? (await connection()).get('assets',assetId) : undefined;}
export async function bookAssets(bookId:string){return (await connection()).getAllFromIndex('assets','by-book',bookId);}
export async function deleteBook(bookId:string){
  const db=await connection();const tx=db.transaction(['books','assets'],'readwrite');
  await tx.objectStore('books').delete(bookId);
  for await (const cursor of tx.objectStore('assets').index('by-book').iterate(bookId)) await cursor.delete();
  await tx.done;
}
export async function importBook(book:Playbook,assets:Asset[]){
  const db=await connection();const tx=db.transaction(['books','assets'],'readwrite');
  await tx.objectStore('books').put(book);
  for(const asset of assets)await tx.objectStore('assets').put(asset);
  await tx.done;
}
export async function assembleChunks(book:Playbook,kind:'audio'|'video'){
  const ids=kind==='audio'?book.audioChunks:book.videoChunks;
  const parts=[] as Blob[];
  for(const chunkId of ids||[]){const a=await getAsset(chunkId);if(a)parts.push(a.blob);}
  if(!parts.length)return undefined;
  return new Blob(parts,{type:parts[0].type});
}
export async function finalizeRecording(book:Playbook){
  const next={...book,audioChunks:[],videoChunks:[]} as Playbook;
  const media:Asset[]=[];
  for(const kind of ['audio','video'] as const){
    const blob=await assembleChunks(book,kind);
    if(blob){const assetId=crypto.randomUUID();media.push({id:assetId,bookId:book.id,blob,kind,createdAt:Date.now()});if(kind==='audio')next.audioId=assetId;else next.videoId=assetId;}
  }
  const db=await connection();const tx=db.transaction(['books','assets'],'readwrite');
  // Media and metadata commit together; failure preserves the original recovery chunks.
  for(const chunkId of [...(book.audioChunks||[]),...(book.videoChunks||[])])await tx.objectStore('assets').delete(chunkId);
  for(const asset of media)await tx.objectStore('assets').put(asset);
  await tx.objectStore('books').put(next);await tx.done;return next;
}
let recovery:Promise<void>|undefined;
export function recoverInterrupted(){return recovery ||= (async()=>{
  for(const book of await listBooks())if(book.status==='recording'){
    book.status='interrupted';book.updatedAt=new Date().toISOString();
    try{await finalizeRecording(book);}catch{await saveBook(book).catch(()=>{});}
  }
})();}
export async function storageUsage(){const e=await navigator.storage?.estimate();return e||{};}
