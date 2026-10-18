import { backupZip } from './exports';
import type { Playbook } from './types';
let accessToken='';let expiresAt=0;let loaded:Promise<void>|undefined;
export function disconnectDrive(){if(accessToken)(window as any).google?.accounts.oauth2.revoke(accessToken,()=>{});accessToken='';expiresAt=0;}
export function driveConnected(){return Boolean(accessToken)&&Date.now()<expiresAt;}
export async function connectDrive(clientId:string){
  if(!clientId.trim())throw new Error('Configure o Client ID OAuth do Google nas configurações. A assinatura Gemini não fornece esse identificador.');
  if(!loaded)loaded=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>resolve();script.onerror=()=>{loaded=undefined;reject(new Error('Não foi possível carregar o login Google. Verifique a conexão.'));};document.head.append(script);});
  await loaded;
  await new Promise<void>((resolve,reject)=>{const client=(window as any).google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/drive.file',callback:(response:any)=>{if(response.error)return reject(new Error('O acesso ao Google Drive não foi autorizado.'));accessToken=response.access_token;expiresAt=Date.now()+(Number(response.expires_in)-60)*1000;resolve();},error_callback:()=>reject(new Error('Login cancelado ou janela bloqueada.'))});client.requestAccessToken({prompt:'consent'});});
}
async function request(path:string,options:RequestInit={}){
  if(!driveConnected())throw new Error('A conexão com o Drive expirou. Conecte sua conta novamente.');
  const res=await fetch(`https://www.googleapis.com${path}`,{...options,headers:{...options.headers,Authorization:`Bearer ${accessToken}`}});
  if(!res.ok){if(res.status===401){accessToken='';expiresAt=0;}throw new Error(res.status===403?'O Google recusou esta operação. Verifique permissões, cota e políticas da conta.':'Não foi possível acessar o Google Drive.');}
  return res.json();
}
export async function uploadDrive(book:Playbook){
  const q=encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='Playbook Studio' and trashed=false");
  const folders=await request(`/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=100`);
  const folder=folders.files[0]||await request('/drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Playbook Studio',mimeType:'application/vnd.google-apps.folder'})});
  const archive=await backupZip(book);const boundary=`playbook-${crypto.randomUUID()}`;
  const metadata={name:`${book.title}.playbook.zip`,mimeType:'application/zip',...(!book.driveId?{parents:[folder.id]}:{}),appProperties:{playbookId:book.id,version:String(book.version)}};
  const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,archive,`\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`});
  return request(`/upload/drive/v3/files${book.driveId?`/${encodeURIComponent(book.driveId)}`:''}?uploadType=multipart&fields=id,modifiedTime`,{method:book.driveId?'PATCH':'POST',body,headers:{'Content-Type':body.type}});
}
export async function listDrive(){const q=encodeURIComponent("mimeType='application/zip' and trashed=false");return (await request(`/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=100&orderBy=modifiedTime%20desc`)).files as {id:string;name:string;modifiedTime:string}[];}
export async function downloadDrive(fileId:string){
  if(!driveConnected())throw new Error('Reconecte o Google Drive.');
  const res=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{headers:{Authorization:`Bearer ${accessToken}`}});if(!res.ok)throw new Error('Não foi possível baixar o backup do Drive.');return res.blob();
}
