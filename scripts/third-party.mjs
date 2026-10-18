import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function writeNotices(root,target){
  const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
  let result='PLAYBOOK STUDIO — LICENÇAS DE COMPONENTES\n\nRuntime Node.js: ver runtime/LICENSE.\n.NET e Windows Forms: MIT, Copyright .NET Foundation and Contributors.\nSystem.Speech: MIT, Copyright .NET Foundation and Contributors.\nCódigo-fonte .NET: https://github.com/dotnet/runtime e https://github.com/dotnet/winforms\n\n';
  for(const [relative,pkg] of Object.entries(lock.packages)){
    if(!relative.startsWith('node_modules/')||pkg.dev)continue;
    const folder=path.join(root,relative);let names=[];try{names=await readdir(folder);}catch{}
    result+=`\n===== ${relative.slice('node_modules/'.length)} ${pkg.version} (${pkg.license||'ver licença abaixo'}) =====\n`;
    for(const name of names.filter(n=>/^(license|licence|copying|notice)(\.|$)/i.test(n))){try{result+=await readFile(path.join(folder,name),'utf8')+'\n';}catch{}}
  }
  const assets=JSON.parse(await readFile(path.join(root,'native','obj','project.assets.json'),'utf8'));
  for(const folder of Object.keys(assets.packageFolders||{})){
    for(const pkg of ['microsoft.netcore.app.runtime.win-x64','microsoft.windowsdesktop.app.runtime.win-x64','system.speech']){
      let versions=[];try{versions=await readdir(path.join(folder,pkg));}catch{continue;}
      for(const version of versions)for(const name of ['LICENSE','LICENSE.TXT','THIRD-PARTY-NOTICES.TXT']){
        try{result+=`\n===== ${pkg} ${version}: ${name} =====\n`+await readFile(path.join(folder,pkg,version,name),'utf8')+'\n';}catch{}
      }
    }
  }
  await writeFile(target,result);
}
