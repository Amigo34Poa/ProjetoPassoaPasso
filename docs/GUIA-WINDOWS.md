# Playbook Studio — Windows portátil

1. Extraia TODO o ZIP para uma pasta com permissão de leitura e execução.
2. Abra `Playbook Studio.exe`. Não é preciso instalar Node.js ou .NET.
3. O aplicativo abre no navegador padrão e mantém um serviço somente no computador, na porta 4317.
4. Para diagnóstico, use `Iniciar pelo terminal.cmd`. Não execute os dois iniciadores simultaneamente.

O executável precisa permanecer junto das pastas `runtime` e `dist` e do arquivo `server.cjs`. O pacote é para Windows 11 x64. Não foi assinado digitalmente: políticas corporativas ou avisos de reputação podem impedir sua execução. Nesse caso, solicite a validação do aplicativo à TI; não altere as proteções da empresa.

Para atualizar uma versão anterior, finalize qualquer gravação, exporte um backup e use Encerrar aplicativo nas configurações. Depois extraia a nova versão em outra pasta e abra seu executável. O iniciador reutiliza um serviço já aberto na porta 4317; por isso é importante encerrar a versão anterior. A biblioteca permanece no mesmo perfil do navegador quando endereço e porta são mantidos.


## Avisos do Windows e computadores da empresa

O ZIP não é um instalador, mas contém executáveis. O manifesto solicita `asInvoker`, sem administrador. Não são criados serviço do Windows, tarefa de inicialização, regra de firewall ou instalação global; o runtime pode extrair arquivos temporários no perfil do usuário.

- **“O Windows protegeu o computador” / SmartScreen:** aviso de reputação de um executável não assinado; não é confirmação de instalação.
- **Controle de Conta de Usuário / “Deseja permitir que este aplicativo faça alterações…”:** é um pedido de elevação. O Playbook Studio não o solicita no manifesto. Registre qual arquivo e editor aparecem; a origem pode ser o modo de execução ou outra configuração. Não é preciso usar Executar como administrador para este aplicativo.
- **Windows Defender Firewall:** pode ser um aviso sobre o runtime Node.js. O aplicativo escuta apenas em `127.0.0.1:4317`; não precisa receber conexões da rede da empresa. Não inclui abertura automática de portas.
- **Microfone/compartilhamento de tela no navegador:** são permissões de captura, independentes de instalação.
- **AppLocker, WDAC, antivírus ou política corporativa:** podem bloquear executáveis portáteis, runtimes e captura, mesmo que outro aplicativo portátil já tenha funcionado.

Não há garantia de liberação no computador de trabalho. Encaminhe o pacote, a soma SHA-256 e o aviso exato para a TI avaliar. Uma assinatura digital pode ajudar com identidade e reputação, mas não substitui autorização corporativa.

## Gravar

Clique em Nova gravação, informe título e cargo e escolha a captura. Autorize o microfone. O microfone padrão do Windows é usado.

- Windows completo: captura o monitor selecionado, identifica cliques e adiciona marca-texto editável nas etapas. O realce transitório na tela é excluído das capturas quando o Windows oferece esse recurso. Até 4 quadros por segundo; indicado para processos e telas de sistemas.
- Compartilhar tela: captura uma tela, janela ou aba escolhida no navegador. Este modo não detecta cliques fora da página do aplicativo. Capturas automáticas se baseiam em mudanças visuais; marque etapas manualmente quando necessário.
- Marcar etapa: Ctrl + Alt + M.
- Pausar ou continuar: Ctrl + Alt + P.
- Abrir preparação ou finalizar: Ctrl + Alt + R. A captura precisa de autorização inicial; o atalho de início abre a preparação.

Atalhos globais exigem o companheiro Windows e podem entrar em conflito com outro programa. Não há registro de senhas ou de cada tecla digitada. O sistema registra cliques, imagens, narração e os comandos de controle do gravador. Conteúdo digitado pode aparecer nas imagens e no vídeo.

Se você fechar apenas a aba, o serviço local pode continuar ativo. Reabra o executável para voltar à interface. Para encerrá-lo use o comando Encerrar aplicativo nas configurações. Não encerre durante uma gravação.

## Voz e IA

- Voz do navegador: sem chave de API, depende do suporte e serviço de reconhecimento do navegador. Pode enviar áudio ao fornecedor do navegador e pode falhar mesmo com o microfone funcionando.
- Voz do Windows: usa SAPI/System.Speech e exige um reconhecedor pt-BR já instalado e captura Windows. Não instala pacotes de idioma.
- Gemini: usa Gemini API/Live com chave de um projeto Google AI Studio ou Cloud habilitado. Modelo configurável. A disponibilidade dos modelos depende do projeto. Para usar os recursos, autorize o envio na tela de configurações.
- OpenAI: usa API de transcrição em blocos de aproximadamente 8 segundos e API de imagens/texto para sugestões.

As assinaturas Gemini Pro e ChatGPT Pro NÃO equivalem a créditos ou credenciais de API para aplicativos próprios. Sem reconhecimento disponível, a captura e o áudio original continuam funcionando, mas não há promessa de transcrição. Você poderá preencher a narração manualmente.

A chave informada na interface fica somente na memória do serviço local e não é exportada. Opcionalmente crie um arquivo `.env` junto de `server.cjs`, com GEMINI_API_KEY ou OPENAI_API_KEY. Esse arquivo contém credenciais: mantenha-o privado. Não o inclua ao compartilhar o pacote.

## Revisão e exportação

Na versão 0.2, use **Organizar sem API** no editor. A aba Sugestões locais preenche títulos genéricos e instruções vazias com base na narração ou no clique destacado, com prévia antes de aplicar. A aba Vincular narração permite ouvir os trechos e escolher a imagem/etapa correspondente. A aba Revisão aponta campos faltantes. Esses recursos não enviam dados a uma API e não exigem assinatura de IA.

Ao finalizar uma gravação, o aplicativo também prepara rascunhos locais nos campos ainda vazios. Os vínculos automáticos usam a maior sobreposição de tempo; são aproximações e precisam de revisão. Vínculos definidos por você são preservados no backup.

Revise a associação entre fala e imagens. Os tempos da fala do navegador, Gemini Live e Windows são estimados por segmento, não alinhamento garantido palavra a palavra. A transcrição pode conter erros. A narração literal e a instrução organizada são campos separados.

Adicione marca-texto, setas, caixas e textos arrastando sobre a imagem. Ocultar dados aplica uma tarja opaca nas imagens exportadas; o original é preservado no backup completo. Sugestões por IA usam a imagem já coberta pelas tarjas existentes, mas a narração enviada também precisa de revisão.

Na versão 0.2.1, os botões de gerar GIF e clipe foram removidos. Expanda **Gravação original da tela**, abaixo do editor, para assistir ao vídeo integral. A opção de preservá-lo continua ativada por padrão na preparação. Clipes de versões anteriores continuam reproduzíveis e exportáveis.

Os novos cliques recebem uma faixa amarela translúcida na base do link, texto ou botão, usando os limites de acessibilidade fornecidos pelo Windows UI Automation. Esse detector funciona localmente e não depende de IA externa. Se o programa não expuser um alvo confiável, a faixa será curta, próxima ao clique; use Marca-texto no editor para ajustar. Teste links em diferentes programas e escalas de tela, pois o suporte varia.

A imagem recente anterior ao clique é preservada para evitar destacar uma posição na página aberta depois. Os círculos automáticos editáveis antigos são convertidos ao abrir o procedimento; círculos desenhados manualmente são preservados. Marcas já gravadas nos pixels de imagens antigas não podem ser removidas automaticamente. Áudio, vídeo e originais permanecem intactos.

- PDF: abre impressão do navegador. Escolha Salvar como PDF. É estático.
- Word: gera um arquivo .docx com texto e imagens anotadas. É estático.
- HTML multimídia: extraia o ZIP e abra index.html; contém imagens anotadas, clipes, áudio e vídeo originais.
- Backup completo: .playbook.zip, importável no aplicativo; mantém originais e anotações editáveis. Contém hashes SHA-256 para validar a importação.

Antes de compartilhar, revise áudio, vídeos, GIFs e backups completos: ocultações nas imagens NÃO removem informações dessas outras mídias. Os arquivos de áudio são os fluxos originais capturados pelo navegador, normalmente WebM/Opus ou MP4 conforme o suporte.

## Armazenamento

A biblioteca usa IndexedDB do perfil do navegador neste endereço. Ela não é automaticamente uma pasta em Documentos. Exporte backups para uma pasta de sua escolha. Não altere a porta/endereço nem limpe dados do site sem guardar backups: cada origem tem seu próprio armazenamento.

O aplicativo grava trechos de mídia a cada 2,5 segundos. Ao reabrir, tenta recuperar gravações interrompidas. O último trecho não persistido pode ser perdido. O espaço disponível e as permissões do navegador limitam a duração. Após a consolidação bem-sucedida, o áudio e o vídeo finais substituem atomicamente os trechos de recuperação, evitando duplicação permanente. Se houver falha, os trechos existentes são preservados.

## Google Drive

É necessário um projeto Google Cloud com Drive API e cliente OAuth do tipo Aplicativo da Web. Cadastre como origem autorizada `http://127.0.0.1:4317` e informe seu Client ID público em Configurações → Google Drive. Se o aplicativo OAuth estiver em teste, inclua a conta nos usuários de teste. A administração da empresa pode precisar autorizar esse acesso.

O login solicita drive.file, mantém o token apenas na memória e usa uma pasta chamada Playbook Studio. O comando Drive do editor envia um BACKUP COMPLETO; não há publicação pública nem permissão automática para outras pessoas. Na área de conexões é possível listar/importar backups acessíveis ao aplicativo. A sincronização é manual, em primeiro plano; não há edição simultânea, gestão central de equipe ou resolução automática de conflitos nesta versão.

## Validação e limites da entrega

O executável foi compilado para Windows x64 a partir de um ambiente Linux. Captura de tela, hooks, atalhos, SAPI, execução em computadores corporativos e o iniciador precisam de um teste real no Windows de destino. Não se afirma validação nativa sem esse teste. O fluxo web, persistência e exportações possuem testes próprios; integrações de IA e login Google precisam de credenciais reais para validação completa.

No navegador a versão é utilizável para gravar/editar e consultar procedimentos. Esta versão não é um servidor multiusuário de produção. O serviço fica ligado somente à interface local por padrão.
