# Verificação no computador Windows de destino

Esta verificação complementa os testes web executados em Linux. Os itens abaixo permanecem pendentes até execução em Windows real.

1. Extrair o ZIP, abrir `Playbook Studio.exe` sem administrador e confirmar que a interface abre.
2. Aguardar a opção Windows completo aparecer. Conferir a lista e as dimensões dos monitores.
3. Gravar 30 segundos em uma tela de teste, falar em português e clicar em três posições, inclusive com escala 125% ou 150% se aplicável.
4. Clicar no início e no fim de links e botões. Confirmar que a faixa de marca-texto segue a largura do elemento disponível, não o ícone do ponteiro. Testar um alvo sem acessibilidade, bordas e monitor com coordenadas negativas; deve haver marcador curto. Verificar que a etapa mostra a página anterior à navegação e que o original não recebeu marcação permanente.
5. Usar Ctrl + Alt + M, Ctrl + Alt + P e Ctrl + Alt + R com outra janela em foco. Confirmar que não conflitam com atalhos corporativos.
6. Confirmar áudio original reproduzível e duração sem o intervalo pausado.
7. Se houver SAPI pt-BR, selecionar Voz do Windows e verificar transcrição real. Sem o reconhecedor, confirmar mensagem de indisponibilidade e preservação do áudio.
8. Com uma API oficial habilitada, testar conexão, transcrição real e sugestões visuais; verificar custos e modelos no projeto do provedor.
9. Confirmar ausência dos botões de gerar GIF/clipe, reproduzir o vídeo integral abaixo do editor, desenhar um marca-texto, exportar PDF e Word, restaurar um backup e comparar os conteúdos.
10. Interromper um teste descartável fechando a aba após mais de cinco segundos; reabrir e verificar recuperação dos trechos persistidos.
11. Com projeto OAuth configurado, entrar no Drive, enviar backup, importar e desconectar. Verificar as políticas da conta da empresa.
12. Encerrar pelo botão nas configurações e confirmar que o serviço local e o capturador terminaram.

Se houver bloqueio corporativo, encaminhe o pacote e sua soma SHA-256 à TI para análise. Não desative controles do Windows nem políticas da empresa.
