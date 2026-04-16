# 🌐 Guia de Acesso Remoto ao Cérebro

Este documento explica como conectar agentes externos (Perplexity, Firebase, etc.) ao teu **NeuroForge Digital Brain**.

## 🔑 Credenciais Atuais

> [!IMPORTANT]
> **URL**: Gerada dinamicamente ao iniciar o túnel.
> **Token Fixo**: `8c962e648b424e922593d5fa8281c117`

---

## 🏎️ Como Iniciar a "Unicidade Total"

Para abrir o cérebro para o mundo, executa o seguinte comando num terminal:

```powershell
./scripts/start-brain-remote.ps1
```

O terminal irá mostrar um URL da Cloudflare (ex: `https://something-random.trycloudflare.com`). **Copia esse URL.**

---

## 🦉 Conectar ao Perplexity Pro

1. Abre a **App do Perplexity no Mac** (ou as definições no Browser).
2. Vai a **Settings > Connectors**.
3. Clica em **Add Connector**.
    - **Name**: `NeuroForge Brain`
    - **URL**: Cola o URL gerado pelo túnel.
    - **Header**: Adiciona o header `Authorization` com o valor `Bearer 8c962e648b424e922593d5fa8281c117`.
4. Salva e ativa. O Perplexity agora consegue ler todos os teus ficheiros de notas e o grafo do Graphify!

---

## 🔥 Conectar ao Firebase / Custom Backend

Para consultar o cérebro via código, faz um pedido POST para o URL do túnel:

```bash
curl -X POST https://teu-url.trycloudflare.com/tools/brain_search \
     -H "Authorization: Bearer 8c962e648b424e922593d5fa8281c117" \
     -H "Content-Type: application/json" \
     -d '{"query": "definicao do motor de passos"}'
```

---

## 🛡️ Segurança

- O túnel é **temporário**. Se fechares o script, o acesso é cortado.
- O **Token** é obrigatório para qualquer acesso. Nunca partilhes este token publicamente.
- Podes mudar o token editando o ficheiro `.env` na raiz do projeto.
