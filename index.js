const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USER;
const GITHUB_REPO = 'samp-compiler-engine'; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot de Compilação com Feedback Universal ativo!");

// --- SISTEMA ANTI-SONO PARA MANTER O BOT 24H ON ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Online 24h\n');
});
server.listen(process.env.PORT || 3000);

setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        axios.get(process.env.RENDER_EXTERNAL_URL).catch(() => {});
    }
}, 300000); // Ping a cada 5 minutos
// --------------------------------------------------

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "👋 Salve! Envie o link do **MediaFire** ou **Google Drive** com a sua Source em `.zip` para começar a compilação.");
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return bot.sendMessage(chatId, "❌ Por favor, envie um link válido (começando com http ou https).");
    }

    // 1. Cria a mensagem fixa que vai ser editada com o progresso
    const statusMsg = await bot.sendMessage(chatId, 
        "⏳ **Iniciando processo...**\n" +
        "🔄 Conectando ao motor do GitHub... [Aguarde]"
    );

    try {
        const githubUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/workflows/engine.yml/dispatches`;
        
        await axios.post(githubUrl, {
            ref: 'main',
            inputs: { zip_url: text.trim(), apk_name: "SAMP_Client" }
        }, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });

        // Alerta inicial de progresso
        await bot.editMessageText(
            "🚀 **Motor acionado com sucesso!**\n\n" +
            "Progresso da Compilação:\n" +
            "⏳ 1. Baixando e extraindo a source\n" +
            "⏳ 2. Configurando ambiente (Java/Android SDK)\n" +
            "⏳ 3. Compilando o APK com Gradle (Essa parte demora)\n" +
            "⏳ 4. Gerando link de download", 
            { chat_id: chatId, message_id: statusMsg.message_id }
        );

        // Começa a monitorar os passos no GitHub
        checkRunStatus(chatId, statusMsg.message_id);

    } catch (error) {
        bot.editMessageText(`❌ Erro ao ligar o motor do GitHub: ${error.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
    }
});

// Função que vigia o GitHub de 15 em 15 segundos
async function checkRunStatus(chatId, messageId) {
    const runsUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/runs?per_page=1`;
    let tentativas = 0;
    const maxTentativas = 40; // 40 * 15 segundos = ~10 minutos de limite máximo

    const interval = setInterval(async () => {
        tentativas++;
        try {
            const response = await axios.get(runsUrl, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });

            const ultimaRun = response.data.workflow_runs[0];
            if (!ultimaRun) return;

            const status = ultimaRun.status;       
            const conclusion = ultimaRun.conclusion; 

            // Pega os detalhes das sub-etapas (jobs/steps)
            const jobsResponse = await axios.get(ultimaRun.jobs_url, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });
            
            const steps = jobsResponse.data.jobs[0]?.steps || [];
            
            // Emojis de controle visual
            let p1 = "⏳", p2 = "⏳", p3 = "⏳", p4 = "⏳";

            steps.forEach(step => {
                if (step.name.includes("Baixar a Source")) {
                    p1 = step.status === "completed" ? "✅" : "🔄";
                }
                if (step.name.includes("Configurar Java") || step.name.includes("Configurar Android")) {
                    if (p1 === "✅") p2 = step.status === "completed" ? "✅" : "🔄";
                }
                if (step.name.includes("Compilar o APK")) {
                    if (p2 === "✅") p3 = step.status === "completed" ? "✅" : "🔄";
                }
                if (step.name.includes("Criar Link de Download")) {
                    if (p3 === "✅") p4 = step.status === "completed" ? "✅" : "🔄";
                }
            });

            // Se o processo no GitHub ainda estiver rodando (In_progress / Queued)
            if (status !== "completed") {
                await bot.editMessageText(
                    `🛠️ **Compilando sua Source Code...**\n\n` +
                    `${p1} 1. Baixando e extraindo a source\n` +
                    `${p2} 2. Configurando ambiente (Java/Android SDK)\n` +
                    `${p3} 3. Compilando o APK com Gradle (Essa parte demora)\n` +
                    `${p4} 4. Gerando link de download`,
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
                );
            } 
            // Se terminou com SUCESSO
            else if (status === "completed" && conclusion === "success") {
                clearInterval(interval);
                
                // Baixa o texto completo dos logs para extrair o link final do APK
                const logsResponse = await axios.get(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/jobs/${jobsResponse.data.jobs[0].id}/logs`, {
                    headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
                });
                
                const logTexto = logsResponse.data;
                
                // Captura universal: acha a palavra DOWNLOAD_URL e puxa o link independente do site
                const match = logTexto.match(/DOWNLOAD_URL:\s*(https?:\/\/[^\s]+)/);
                const linkFinal = match ? match[1].trim() : null;

                if (linkFinal) {
                    await bot.editMessageText(
                        `✅ **COMPILAÇÃO CONCLUÍDA COM SUCESSO!**\n\n` +
                        `📦 **Seu APK foi gerado e já está pronto para baixar:**\n` +
                        `🔗 ${linkFinal}\n\n` +
                        `*Clique no link acima para instalar no seu celular!*`,
                        { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
                    );
                } else {
                    await bot.editMessageText(`⚠️ A compilação terminou com sucesso no GitHub, mas o robô não encontrou a linha 'DOWNLOAD_URL' nos logs para extrair o link do APK.`, { chat_id: chatId, message_id: messageId });
                }
            } 
            // Se terminou com FALHA
            else if (status === "completed" && conclusion !== "success") {
                clearInterval(interval);
                await bot.editMessageText(`❌ **A compilação falhou lá no GitHub Actions!**\n\nO motor parou o processo. Possíveis causas:\n- Erros nos arquivos C++/.java da sua source.\n- Você esqueceu de colocar o arquivo \`gradlew\` na raiz do arquivo .zip.\n\nAbra o seu GitHub na aba *Actions* para ler a linha vermelha do erro.`, { chat_id: chatId, message_id: messageId });
            }

        } catch (err) {
            console.error("Erro no loop de monitoramento:", err.message);
        }

        // Caso o processo trave no GitHub por mais de 10 minutos
        if (tentativas >= maxTentativas) {
            clearInterval(interval);
            bot.sendMessage(chatId, "⚠️ O tempo limite da operação terminou. A compilação está demorando mais do que o normal, cheque direto na aba Actions do seu GitHub.");
        }
    }, 15000); // Consulta o GitHub a cada 15 segundos
}
