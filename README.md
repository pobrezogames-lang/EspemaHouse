# Espema House Online

Versão online cooperativa do **Espema House**. O HTML original, o renderizador WebGL e os assets da casa foram mantidos.

## O que foi adicionado

- Salas públicas sem senha e salas privadas com senha.
- Código curto e link para convidar amigos.
- Nome próprio para cada jogador.
- Quatro personagens selecionáveis.
- Lobby com participantes, indicação do host e botão para iniciar.
- Até quatro jogadores por sala.
- Avatares 3D low-poly com olhos, cabeça, tronco, braços, antebraços, pernas e joelhos articulados.
- Animações dos braços e das pernas ao caminhar.
- Sincronização de posição, direção, caminhada/corrida, agachamento e esconderijos.
- Sincronização básica de itens coletados/soltos, portas de esconderijos e progresso das três travas da saída.
- Modo solo original preservado.

## Como publicar no Render

1. Extraia o arquivo ZIP.
2. Envie **todo o conteúdo da pasta `espema-house-online`** para a raiz de um repositório no GitHub. Não envie somente o HTML.
3. No Render, crie um **Web Service** e conecte esse repositório.
4. Runtime: `Node`.
5. Build Command: `npm install`.
6. Start Command: `npm start`.
7. Faça o deploy e abra a URL gerada pelo Render.

O arquivo `render.yaml` também está incluído para quem preferir criar o serviço usando um Blueprint.

## Como jogar

1. Abra a URL do Render e toque em **ONLINE CO-OP**.
2. Digite seu nome e escolha um dos quatro personagens.
3. Crie a sala. Deixe a senha vazia para criar uma sala pública; coloque uma senha para criar uma sala privada.
4. Compartilhe o código ou o link com os amigos. Para salas privadas, envie a senha separadamente.
5. Os outros jogadores entram pela lista pública ou pelo código e senha.
6. O host inicia quando todos estiverem prontos.

## Limitações desta primeira versão online

O servidor sincroniza os jogadores e retransmite as alterações cooperativas de itens, portas e travas. A IA e a perseguição do Espema ainda são simuladas separadamente em cada aparelho; por isso, a posição e o comportamento do inimigo podem divergir entre os jogadores. Ainda não é uma simulação autoritativa completa.

As salas são mantidas em memória e são apagadas se o processo do servidor reiniciar ou dormir. Para conservar salas e progresso entre reinicializações, seria necessário adicionar um banco de dados/armazenamento externo.
