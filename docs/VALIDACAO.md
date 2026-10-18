# Evidência de validação da entrega

Executado no ambiente Linux desta tarefa:

| Verificação | Resultado |
| --- | --- |
| Instalação com `npm ci` e lockfile | Concluída |
| TypeScript e build de produção | Concluídos |
| Testes unitários Vitest | 27 passaram |
| Testes de navegador Playwright sobre produção | 10 passaram |
| Compilação self-contained Windows x64, .NET 10 | Concluída |
| Runtime Windows Node.js | Download oficial e SHA-256 verificado |
| Backend empacotado CJS | Executado; health, interface, editor demonstrativo e PDF conferidos |
| ZIP portátil | Estrutura e CRC conferidos; SHA-256 fornecido |

Na versão 0.2, também foram validados sugestões locais sem requisição a APIs de IA, preservação da narração literal, associação por sobreposição temporal e remapeamento de vínculos ao restaurar backups.

Os testes de navegador exercitaram edição, marcações, publicação local, exportação Word/HTML/PDF, restauração de backup, proteção de origem, isolamento de credenciais por provedor, layout móvel, gravação, pausa, persistência de áudio/vídeo e reprodução integral sem botões de gerar GIF/clipe. O marca-texto é verificado na interface, em backup restaurado e nos pixels das imagens exportadas.

A gravação automatizada usa tela sintética e microfone de teste do Chromium. Ela não estabelece que a captura Windows, SAPI, hooks ou reconhecimento de voz real funcionam em um computador de usuário. Não foram usadas chaves reais nem login Google nos testes.

Na versão 0.2.1, um teste simula eventos do capturador para verificar os limites do link e a imagem anterior à navegação. Isso não substitui a validação do Windows UI Automation, exclusão do realce transitório da captura e escala DPI em Windows real. O manifesto do executável permanece `asInvoker`, sem solicitação de administrador.

Pendente de validação externa:

- Execução do pacote e captura global em Windows 11 da empresa.
- Políticas corporativas de execução, microfone, captura e atalhos.
- Reconhecedor Windows pt-BR, quando instalado.
- Transcrição real Gemini/OpenAI, disponibilidade dos modelos e cotas.
- Consentimento OAuth e operações reais de Drive com projeto configurado.

Consulte `TESTE-WINDOWS.md`. Não há publicação pública, aprovação de TI ou validação de restauração em uma nova tarefa de nuvem implícitas nesta entrega.
