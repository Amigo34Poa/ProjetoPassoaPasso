# Automação local — versão 0.2

O núcleo de documentação pode organizar processos sem enviar texto ou imagem a uma API. A transcrição de voz é uma etapa separada: continua dependendo de um reconhecedor disponível ou de um serviço configurado.

## Durante e após a captura

- O capturador Windows registra a posição e o botão do clique e desenha o destaque correspondente. Uma coordenada não estabelece a função do botão nem o resultado da ação.
- Ao finalizar, cada trecho de narração é associado por maior sobreposição temporal com uma etapa. A frase é mantida inteira e não é duplicada entre etapas. Empates privilegiam o intervalo em que a fala começou.
- A ordem cronológica usada para associação é independente da ordem de apresentação do documento. Reordenar etapas não troca silenciosamente seus tempos.
- Títulos genéricos e instruções vazias recebem rascunhos com base na própria narração. Ações simples explicitamente faladas em primeira pessoa podem ser convertidas ao imperativo. Condições, negações e ações compostas são preservadas em texto, sem reinterpretação.
- Se houver somente um clique destacado, a sugestão se limita a indicar esse clique. O aplicativo não afirma que o cadastro foi salvo, que uma tela foi aberta ou que uma operação terminou com sucesso.
- Capturas sem fala nem ação explicável permanecem para revisão humana.

## No editor: Organizar sem API

### Sugestões locais

A tela mostra o título atual, a sugestão e sua origem. Por padrão, preserva títulos específicos e instruções já preenchidas. É possível solicitar sugestões também para esses campos e escolher quais etapas alterar. A narração literal, o áudio e a imagem original são mantidos.

### Vincular narração

Cada segmento exibe texto, horário e sua etapa sugerida. Quando há áudio original, é possível ouvi-lo a partir do trecho. Escolha outra etapa ou deixe Sem etapa, e aplique os vínculos.

Aplicar substitui a narração das etapas pelos segmentos selecionados, em ordem de tempo. Textos corrigidos manualmente nas etapas precisam de revisão antes dessa substituição. As instruções, os títulos e os intervalos das etapas não são modificados por esse comando.

Vínculos manuais são preservados em backups e remapeados para as novas identidades ao importar. Um segmento deixado explicitamente sem etapa não volta a ser associado automaticamente.

### Revisão

O aplicativo sinaliza títulos genéricos, falta de explicação, capturas ausentes e intervalos inconsistentes. Isso ajuda a localizar lacunas; não certifica a precisão comercial do conteúdo.

## Reconhecimento sem assinatura de API

- O reconhecedor Windows pt-BR pode trabalhar localmente quando já estiver instalado, usando o modo de captura Windows.
- O reconhecimento Web Speech pode funcionar sem chave própria, mas depende do navegador e pode usar serviços online dele.
- Gemini e OpenAI continuam opcionais. Assinaturas dos aplicativos de chat não equivalem a chaves ou créditos de API.

Whisper local foi avaliado nesta tarefa. O registro npm estava acessível, mas a obtenção de modelos no Hugging Face foi negada pela rede (HTTP 403). Não foi integrado um mecanismo incompleto nem declarada transcrição offline por Whisper sem teste. Essa opção exige obtenção confiável dos pesos, verificação dos artefatos e teste de desempenho/qualidade no computador de destino; não é necessária para usar as sugestões locais implementadas.
