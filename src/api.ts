export async function api<T=any>(url:string,data?:unknown):Promise<T>{
  const r=await fetch(url,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json','X-Playbook-Request':'1'},body:data===undefined?undefined:JSON.stringify(data)});
  const body=await r.json();if(!r.ok)throw new Error(body.error||'Não foi possível concluir a operação.');return body;
}
export function socket(path:string){return new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}${path}`);}
export function blobDataURL(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.onerror=reject;r.readAsDataURL(blob);});}
export async function dataURLBlob(data:string){return (await fetch(data)).blob();}
