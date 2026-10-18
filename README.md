# Playbook Studio

Aplicativo próprio para documentar processos comerciais com tela, narração, capturas e etapas editáveis. Interface escura em azul, preto e cinza, organizada pelos seis cargos da equipe.

## Entrega Windows sem instalador

O arquivo `release/Playbook-Studio-0.2.0-Windows-x64.zip` contém o aplicativo portátil, o runtime Node.js e a interface compilada. Extraia tudo e execute `Playbook Studio.exe`. Não é necessário instalar Node.js ou .NET. Consulte [o guia completo](docs/GUIA-WINDOWS.md).

O executável é para Windows 11 x64 e não foi assinado digitalmente. A execução está sujeita às políticas corporativas. O capturador Windows foi compilado nesta entrega, mas precisa de validação em Windows real; o ambiente de desenvolvimento atual é Linux.

## O que está implementado

- Biblioteca local por cargo, pesquisa em títulos/narração, filtros, rascunhos e publicação local.
- Gravação do microfone e da tela no navegador; PNGs, vídeo original, pausa e marcação de etapas.
- Companheiro Windows com captura do monitor, ponteiro, realces de cliques e atalhos globais. Não grava todas as teclas digitadas.
- Reconhecimento Web Speech quando oferecido pelo navegador; reconhecimento Windows pt-BR quando instalado.
- Integrações oficiais: Gemini Live para voz, Gemini para sugestões visuais e texto; OpenAI para transcrição em blocos e sugestões visuais.
- Editor de narração e instrução separadas, ordem das etapas, intervalos de áudio, setas, caixas, círculos, rótulos e ocultação opaca.
- Clipes WebM/MP4 e GIFs com até 1080p quando a fonte permitir.
- Exportação Word, PDF pela impressão do navegador, tutorial HTML multimídia e backup ZIP importável com verificação SHA-256.
- Login Google OAuth/Drive com `drive.file`, upload manual de backups e importação de arquivos acessíveis ao aplicativo.
- Persistência de trechos durante gravação e recuperação de sessões interrompidas.
- Assistente local sem API: rascunhos de títulos/instruções, revisão de lacunas e vinculação manual da narração às etapas. Consulte [automação local](docs/AUTOMACAO-LOCAL.md).

## Limites explícitos

- Gemini Pro/ChatGPT Pro não substituem credenciais de API. A interface não simula login nessas assinaturas. Sem reconhecedor funcional/API configurada, há gravação de áudio, mas não há transcrição garantida.
- Gemini/OpenAI e Drive precisam de projetos/credenciais próprios; chamadas reais e consentimento OAuth não foram validados sem essas credenciais. Os modelos Gemini são configuráveis e podem depender da disponibilidade do projeto.
- Um navegador comum não identifica cliques em outras janelas. O modo Windows usa o companheiro nativo para isso.
- A captura Windows em PNG é limitada a até 4 fps. Não é um gravador de vídeo de alta taxa de quadros. Outras telas e janelas protegidas não estão implicitamente incluídas no monitor selecionado.
- Os tempos da transcrição são aproximações por segmento. A associação fala/imagem é sugerida por limites de etapa e exige revisão; não há alinhamento certificado palavra a palavra.
- Publicar significa marcar como publicado na biblioteca local. Não cria um site público, não distribui permissões ao time e não estabelece um backend multiusuário.
- A biblioteca usa IndexedDB do navegador. Não equivale a uma pasta automaticamente sincronizada. Exporte backups para uma pasta ou para o Drive.
- Ocultar dados afeta as imagens renderizadas. Originais, áudio, vídeos e GIFs precisam de revisão separada antes de compartilhamento.
- Não há edição simultânea, compartilhamento automático, monitoramento de todas as teclas, recuperação de páginas de servidor ou sincronização em segundo plano.

## Desenvolvimento

Requisitos: Node.js 24.x (versão testada em `.nvmrc`) e npm. O projeto está em `/workspace/ProjetoPassoaPasso` no ambiente em nuvem. Cada tarefa já é isolada; use o checkout existente.

```bash
npm ci
npm run dev
```

O serviço escuta somente na interface local, porta 4317. Para compilar e executar a interface de produção:

```bash
npm run build
npm start
```

Não exponha o serviço na rede como servidor corporativo multiusuário. Uma hospedagem web exige HTTPS para as APIs de captura e microfone. Hosts adicionais precisam ser declarados em `PLAYBOOK_ALLOWED_HOSTS`; o padrão aceita somente loopback.

As variáveis opcionais estão em `.env.example`. Um `.env` local pode fornecer chaves, mas não deve entrar em Git, pacotes ou backups. Chaves informadas pela interface ficam apenas na memória da sessão do serviço. O Client ID OAuth do Drive é público e pode ficar no navegador; tokens de acesso não são persistidos.

### Testes

```bash
npm test
PLAYBOOK_TEST_PRODUCTION=1 npm run test:e2e
```

O segundo comando exige uma compilação atualizada e a porta 4317 livre. O Chromium padrão é `/usr/bin/chromium`; use `CHROMIUM_PATH` para outro executável compatível. Os testes de gravação usam tela sintética e microfone de teste do Chromium, sem afirmar captura Windows nem transcrição real. Os testes verificam exportações reais e a persistência das mídias.

### Gerar o pacote portátil

Requer SDK .NET 10, restore NuGet, target Windows x64 e rede para o runtime oficial Node.js. O pacote incorpora o runtime; não instala componentes no computador do usuário.

```bash
dotnet publish native/Playbook.Capture.csproj -c Release -r win-x64 -o release/native
npm run build
npm run package:portable
```

No ambiente em nuvem, o SDK verificado está em `/workspace/.tools/dotnet/dotnet`; configure `DOTNET_CLI_HOME=/workspace/.cache/dotnet`, `NUGET_PACKAGES=/workspace/.cache/nuget` e desative telemetria com `DOTNET_CLI_TELEMETRY_OPTOUT=1`. O sandbox deste ambiente pode exigir aprovação técnica para o mutex temporário de compilação. Isso não altera a exigência de executar o programa sem elevação no Windows de destino.

O empacotador valida o SHA-256 do runtime Windows contra os checksums oficiais obtidos via TLS, gera o backend e inclui as licenças dos componentes. Não inclua `.env`, arquivos de usuários, credenciais ou dados de gravações no pacote distribuído.

## Estrutura

```text
src/                  Interface React/TypeScript, editor e biblioteca
  recorder.ts         Captura, cronologia, voz e persistência em trechos
  db.ts               IndexedDB e consolidação atômica de gravações
  exports.ts          Word, PDF, HTML e backups verificáveis
  images.ts           Anotações e rasterização das ocultações
  clips.ts            Clipes de vídeo e geração de GIF
  gif.worker.ts       Codificação de GIF fora da thread da interface
  drive.ts            OAuth e operações de Drive
server/               Serviço local, proteção de origem e integrações de IA
native/               Capturador/launcher Windows C#/.NET
scripts/              Empacotamento e licenças de terceiros
tests/                Testes de persistência, cronologia, segurança e navegador
docs/                 Instruções de uso e validação
```

O conteúdo demonstrativo é fictício e está identificado como demonstração. Nenhuma parte do código do Playbook Studio original foi extraída ou reutilizada.
