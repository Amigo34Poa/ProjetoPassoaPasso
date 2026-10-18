import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';

async function demo(page:any){await page.goto('/');await page.getByRole('button',{name:'Explorar um exemplo',exact:true}).click();await expect(page.getByRole('textbox',{name:'Título do procedimento'})).toHaveValue('Do primeiro contato à oportunidade');}
test('edits, annotates, publishes and restores an integrity-checked backup',async({page})=>{
  await demo(page);await page.getByRole('textbox',{name:'Narração literal'}).fill('Texto literal revisado, sem alterar o áudio.');
  await page.getByRole('button',{name:'Seta',exact:true}).click();const image=page.locator('.editor-image');const box=(await image.boundingBox())!;await page.mouse.move(box.x+box.width*.3,box.y+box.height*.25);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await page.mouse.up();
  await expect(page.locator('.annotation-layer line[marker-end]')).toHaveCount(1);await page.getByRole('button',{name:'Publicar',exact:true}).click();await expect(page.getByRole('button',{name:'Publicado',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Exportar',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Backup completo',exact:false}).click();const file=await downloaded;const contents=await readFile((await file.path())!);const zip=await JSZip.loadAsync(contents);const manifest=JSON.parse(await zip.file('project.json')!.async('string'));expect(manifest.book.steps[0].transcript).toBe('Texto literal revisado, sem alterar o áudio.');expect(manifest.book.steps[0].annotations).toHaveLength(2);expect(manifest.assets).toHaveLength(3);
  await page.getByRole('button',{name:'Voltar para a biblioteca'}).click();await page.locator('input[type=file][accept=".zip"]').setInputFiles({name:'backup.zip',mimeType:'application/zip',buffer:contents});await expect(page.getByRole('textbox',{name:'Título do procedimento'})).toHaveValue('Do primeiro contato à oportunidade');await expect(page.getByRole('textbox',{name:'Narração literal'})).toHaveValue('Texto literal revisado, sem alterar o áudio.');
  await page.reload();await page.getByRole('button',{name:'Minha biblioteca',exact:false}).click();await expect(page.locator('.book-card')).toHaveCount(2);
});
test('exports real Word and HTML documents and refuses missing API credentials',async({page})=>{
  await demo(page);await page.getByRole('button',{name:'Sugerir com IA'}).click();await expect(page.getByRole('status').filter({hasText:'Configure uma chave'})).toBeVisible();
  await page.getByRole('button',{name:'Exportar',exact:true}).click();const wordDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Word',exact:false}).click();const word=await wordDownload;const doc=await JSZip.loadAsync(await readFile((await word.path())!));expect(await doc.file('word/document.xml')!.async('string')).toContain('Abra a área de oportunidades');expect(Object.keys(doc.files).filter(p=>p.startsWith('word/media/')&&!doc.files[p].dir).length).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Exportar',exact:true}).click();const htmlDownload=page.waitForEvent('download');await page.getByRole('button',{name:'HTML multimídia',exact:false}).click();const html=await htmlDownload;const bundle=await JSZip.loadAsync(await readFile((await html.path())!));expect(await bundle.file('index.html')!.async('string')).toContain('lang="pt-BR"');expect(bundle.file('media/step-1.png')).toBeTruthy();
});
test('microphone and screen recording preserve the full video without clip generation controls',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d')!;let i=0;const paint=()=>{ctx.fillStyle=i++%2?'#164886':'#092243';ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.font='24px sans-serif';ctx.fillText('Tela sintética de teste '+i,40,100);};paint();const timer=setInterval(paint,200);const stream=canvas.captureStream(12);stream.getTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream;}});
    // The test exercises unavailable speech recognition, not a real transcription provider.
    (window as any).SpeechRecognition=undefined;(window as any).webkitSpeechRecognition=undefined;
  });
  await page.goto('/');await page.getByRole('button',{name:'Nova gravação',exact:true}).click();await page.getByRole('textbox',{name:'Nome do procedimento'}).fill('Teste de gravação');await page.getByRole('button',{name:'Iniciar gravação',exact:true}).click();await expect(page.getByText('GRAVAÇÃO EM ANDAMENTO',{exact:true})).toBeVisible();await page.waitForTimeout(1600);await page.getByRole('button',{name:'Pausar',exact:false}).click();await expect(page.getByText('EM PAUSA',{exact:true})).toBeVisible();await page.waitForTimeout(500);await page.getByRole('button',{name:'Continuar',exact:false}).click();await page.waitForTimeout(1000);await page.getByRole('button',{name:'Marcar etapa',exact:false}).click();await page.waitForTimeout(1200);await page.getByRole('button',{name:'Finalizar',exact:true}).click();await expect(page.getByRole('textbox',{name:'Título do procedimento'})).toHaveValue('Teste de gravação');await expect(page.locator('.original-audio audio')).toBeVisible();
  const media=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve)=>{const r=indexedDB.open('playbook-studio');r.onsuccess=()=>resolve(r.result);});const assets=await new Promise<any[]>(resolve=>{const r=db.transaction('assets').objectStore('assets').getAll();r.onsuccess=()=>resolve(r.result);});return assets.map(a=>({kind:a.kind,bytes:a.blob.size}));});expect(media.some(a=>a.kind==='audio'&&a.bytes>0)).toBe(true);expect(media.some(a=>a.kind==='video'&&a.bytes>0)).toBe(true);
  await expect(page.getByRole('button',{name:/Gerar (GIF|clipe|vídeo)/i})).toHaveCount(0);
  await page.locator('.original-video summary').click();await expect(page.locator('.original-video video')).toBeVisible();expect(await page.locator('.original-video video').evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(1);
});
test('protects the API against cross-origin writes and does not return credentials',async({request})=>{
  const health=await request.get('/api/health');expect(health.ok()).toBe(true);
  const denied=await request.post('/api/config',{data:{provider:'gemini',consent:true,apiKey:'not-a-real-key'}});expect(denied.status()).toBe(403);
  const crossed=await request.post('/api/config',{headers:{Origin:'https://example.com','X-Playbook-Request':'1'},data:{provider:'gemini',consent:true,apiKey:'not-a-real-key'}});expect(crossed.status()).toBe(403);
  const saved=await request.post('/api/config',{headers:{'X-Playbook-Request':'1'},data:{provider:'gemini',consent:false,apiKey:'not-a-real-key'}});expect(saved.ok()).toBe(true);const cfg=await (await request.get('/api/config')).json();expect(cfg.configured).toBe(true);expect(JSON.stringify(cfg)).not.toContain('not-a-real-key');
  const other=await request.post('/api/config',{headers:{'X-Playbook-Request':'1'},data:{provider:'openai',consent:false}});expect(other.ok()).toBe(true);expect((await (await request.get('/api/config')).json()).configured).toBe(false);
});
test('responsive dashboard remains within the mobile viewport',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'Boas ideias viram bons processos.'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Nova gravação',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();});

test('PDF export produces printable content with annotated captures',async({page,context})=>{
  await context.addInitScript(()=>{window.print=()=>{};});await demo(page);await page.getByRole('button',{name:'Exportar',exact:true}).click();const opened=page.waitForEvent('popup');await page.getByRole('button',{name:'PDF',exact:false}).click();const popup=await opened;await expect(popup.locator('h1')).toHaveText('Do primeiro contato à oportunidade');await expect(popup.locator('section img')).toHaveCount(3);const pdf=await popup.pdf({format:'A4'});expect(pdf.subarray(0,4).toString()).toBe('%PDF');await popup.close();
});

test('local suggestions prepare instructions without an AI request or changing literal narration',async({page})=>{
  let aiRequests=0;page.on('request',r=>{if(['/api/enhance','/api/transcribe'].some(p=>r.url().endsWith(p)))aiRequests++;});
  await demo(page);await page.getByRole('textbox',{name:'Título da etapa',exact:true}).fill('Etapa 1');await page.getByRole('textbox',{name:'Narração literal'}).fill('Eu abro o navegador.');await page.getByRole('textbox',{name:'Instrução para a equipe'}).fill('');
  await page.getByRole('button',{name:'Organizar sem API',exact:true}).click();await expect(page.getByRole('heading',{name:'Organize seu processo, sem API'})).toBeVisible();await expect(page.locator('.local-proposals')).toContainText('Abra o navegador');await page.getByRole('button',{name:/Aplicar 1 sugest/}).click();
  await expect(page.getByRole('textbox',{name:'Título da etapa',exact:true})).toHaveValue('Abra o navegador');await expect(page.getByRole('textbox',{name:'Instrução para a equipe'})).toHaveValue('Abra o navegador.');await expect(page.getByRole('textbox',{name:'Narração literal'})).toHaveValue('Eu abro o navegador.');expect(aiRequests).toBe(0);
  await page.reload();await page.getByRole('button',{name:'Minha biblioteca',exact:false}).click();await page.locator('.book-title').first().click();await expect(page.getByRole('textbox',{name:'Instrução para a equipe'})).toHaveValue('Abra o navegador.');
});

test('manual narration links survive backup import with remapped entity IDs',async({page})=>{
  await demo(page);await page.getByRole('button',{name:'Exportar',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Backup completo',exact:false}).click();const original=await pending;const zip=await JSZip.loadAsync(await readFile((await original.path())!));const project=JSON.parse(await zip.file('project.json')!.async('string'));
  project.book.title='Vínculos da narração';project.book.transcript=[{id:'spoken-1',text:'Eu confiro os dados antes de continuar.',time:29,endTime:40,source:'browser'}];project.book.steps.forEach((s:any)=>{s.transcript='';});zip.file('project.json',JSON.stringify(project));
  await page.locator('input[type=file][accept=".zip"]').setInputFiles({name:'spoken.playbook.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});await expect(page.getByRole('textbox',{name:'Título do procedimento'})).toHaveValue('Vínculos da narração');await page.getByRole('button',{name:'Organizar sem API',exact:true}).click();await page.getByRole('button',{name:'Vincular narração',exact:true}).click();
  const assigned=page.getByRole('combobox',{name:'Etapa da fala 1'});await expect(assigned.locator('option:checked')).toContainText('2.');const first=await assigned.locator('option').nth(1).getAttribute('value');await assigned.selectOption(first!);await page.getByRole('button',{name:'Aplicar vínculos da narração'}).click();await expect(page.getByRole('textbox',{name:'Narração literal'})).toHaveValue('Eu confiro os dados antes de continuar.');
  await page.getByRole('button',{name:'Exportar',exact:true}).click();const savedDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Backup completo',exact:false}).click();const saved=await savedDownload;const bytes=await readFile((await saved.path())!);const checked=await JSZip.loadAsync(bytes);const manifest=JSON.parse(await checked.file('project.json')!.async('string'));expect(manifest.book.transcript[0].stepId).toBe(manifest.book.steps[0].id);expect(manifest.book.steps[0].transcriptIds).toEqual([manifest.book.transcript[0].id]);
  await page.locator('input[type=file][accept=".zip"]').setInputFiles({name:'restored.playbook.zip',mimeType:'application/zip',buffer:bytes});await expect(page.getByRole('textbox',{name:'Narração literal'})).toHaveValue('Eu confiro os dados antes de continuar.');await page.getByRole('button',{name:'Organizar sem API',exact:true}).click();await page.getByRole('button',{name:'Vincular narração',exact:true}).click();await expect(page.getByRole('combobox',{name:'Etapa da fala 1'}).locator('option:checked')).toContainText('1.');
});

test('highlighter stays editable through backup and is rasterized transparently in exports',async({page})=>{
  await demo(page);
  await page.getByRole('button',{name:'Marca-texto',exact:true}).click();
  const image=page.locator('.editor-image');const box=(await image.boundingBox())!;
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.11);await page.mouse.down();await page.mouse.move(box.x+box.width*.72,box.y+box.height*.13);await page.mouse.up();
  await expect(page.locator('[data-highlight]')).toHaveCount(2);await expect(page.getByRole('button',{name:'Círculo',exact:true})).toHaveCount(0);
  const original=await page.locator('.editor-image img').evaluate((image:HTMLImageElement)=>{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const g=c.getContext('2d')!;g.drawImage(image,0,0);return [...g.getImageData(Math.round(c.width*.6),Math.round(c.height*.12),1,1).data];});
  await page.getByRole('button',{name:'Exportar',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'HTML multimídia',exact:false}).click();const bundle=await pending;const zip=await JSZip.loadAsync(await readFile((await bundle.path())!));
  const pixels=await page.evaluate(async(base64)=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const g=c.getContext('2d')!;g.drawImage(image,0,0);return [...g.getImageData(Math.round(c.width*.6),Math.round(c.height*.12),1,1).data];},await zip.file('media/step-1.png')!.async('base64'));
  expect(pixels[2]).toBeLessThan(original[2]-30);expect(pixels[2]).toBeGreaterThan(30);expect(pixels[3]).toBe(255);
  await page.getByRole('button',{name:'Exportar',exact:true}).click();const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Backup completo',exact:false}).click();const backup=await saved;const bytes=await readFile((await backup.path())!);
  await page.locator('input[type=file][accept=".zip"]').setInputFiles({name:'highlight.playbook.zip',mimeType:'application/zip',buffer:bytes});await expect(page.locator('[data-highlight]')).toHaveCount(2);
  await page.getByRole('button',{name:'Desfazer marcação',exact:true}).click();await expect(page.locator('[data-highlight]')).toHaveCount(1);
});

test('native click metadata underlines the accessible link on the pre-navigation screenshot',async({page})=>{
  await page.route('**/api/config',async route=>{
    const response=await route.fetch();const config=await response.json();config.native={...config.native,available:true,platform:'win32',mouseHook:true,displays:[{id:0,name:'Test',width:640,height:360,x:0,y:0,primary:true}]};await route.fulfill({json:config});
  });
  await page.route('**/api/native/start',route=>route.fulfill({json:{ok:true}}));await page.route('**/api/native/stop',route=>route.fulfill({json:{ok:true}}));
  await page.addInitScript(()=>{
    class NativeSocket extends EventTarget {
      static OPEN=1;readyState=1;bufferedAmount=0;onopen:any;onerror:any;onclose:any;onmessage:any;
      constructor(_url:string){super();((window as any).__nativeSockets??=[]).push(this);setTimeout(()=>this.onopen?.({}),0);}
      close(){this.readyState=3;this.onclose?.({});}send(){}
    }
    (window as any).WebSocket=NativeSocket;(window as any).SpeechRecognition=undefined;(window as any).webkitSpeechRecognition=undefined;
  });
  await page.goto('/');await page.getByRole('button',{name:'Nova gravação',exact:true}).click();await page.getByRole('textbox',{name:'Nome do procedimento'}).fill('Link acessível');await page.getByRole('checkbox',{name:'Sugerir capturas quando a tela mudar'}).uncheck();await page.getByRole('button',{name:'Iniciar gravação',exact:true}).click();await expect(page.getByText('GRAVAÇÃO EM ANDAMENTO',{exact:true})).toBeVisible();
  await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=640;c.height=360;const g=c.getContext('2d')!;g.fillStyle='#e8effa';g.fillRect(0,0,640,360);g.fillStyle='#1262d7';g.font='20px sans-serif';g.fillText('Consultar CNPJ',128,100);const before=c.toDataURL();
    g.fillStyle='#181818';g.fillRect(0,0,640,360);const after=c.toDataURL();
    for(const ws of (window as any).__nativeSockets){ws.onmessage?.({data:JSON.stringify({type:'click',x:.22,y:.25,target:{x:.2,y:.2,x2:.5,y2:.28},image:before,window:'Receita',button:'left'})});ws.onmessage?.({data:JSON.stringify({type:'frame',image:after})});}
  });
  await page.waitForTimeout(900);await page.getByRole('button',{name:'Finalizar',exact:true}).click();await expect(page.getByRole('textbox',{name:'Título do procedimento'})).toHaveValue('Link acessível');
  const marker=page.locator('[data-highlight]').first();await expect(marker).toHaveAttribute('x','200');await expect(marker).toHaveAttribute('width','300');await expect(page.locator('.annotation-layer ellipse')).toHaveCount(0);
  const pixel=await page.locator('.editor-image img').evaluate((image:HTMLImageElement)=>{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const g=c.getContext('2d')!;g.drawImage(image,0,0);return [...g.getImageData(0,0,1,1).data];});expect(pixel).toEqual([232,239,250,255]);
});
