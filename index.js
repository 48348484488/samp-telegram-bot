const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USER;
const GITHUB_REPO = 'samp-compiler-engine'; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot Premium UI ativo!");

// --- SISTEMA ANTI-SONO ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Online\n');
});
server.listen(process.env.PORT || 3000);
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) axios.get(process.env.RENDER_EXTERNAL_URL).catch(() => {});
}, 300000);

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "👔 **SISTEMA DE COMPILAÇÃO SA-MP**\n\nEnvie o link de download direto da sua Source Code (`.zip`) para iniciar os motores de compilação.", {parse_mode: 'Markdown'});
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return bot.sendMessage(chatId, "❌ Link inválido. Envie um URL que comece com http ou https.");
    }

    const painelBase = 
        `💻 **SISTEMA DE COMPILAÇÃO SA-MP**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `**Status:** 📡 Conectando aos servidores...\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;

    const statusMsg = await bot.sendMessage(chatId, painelBase, {parse_mode: 'Markdown'});

    try {
        const githubUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/workflows/engine.yml/dispatches`;
        
        await axios.post(githubUrl, {
            ref: 'main',
            inputs: { zip_url: text.trim(), apk_name: "SAMP_Client" }
        }, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });

        checkRunStatus(chatId, statusMsg.message_id);

    } catch (error) {
        bot.editMessageText(`❌ **Erro no sistema:** ${error.message}`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' });
    }
});

async function checkRunStatus(chatId, messageId) {
    const runsUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/runs?per_page=1`;
    let tentativas = 0;
    const maxTentativas = 40; 

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

            const jobsResponse = await axios.get(ultimaRun.jobs_url, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });
            
            const steps = jobsResponse.data.jobs[0]?.steps || [];
            
            // Lógica para mostrar apenas a etapa atual
            let etapaAtualText = "🔍 Analisando motor de compilação...";

            for (const step of steps) {
                if (step.status === "in_progress") {
                    if (step.name.includes("Baixar a Source")) {
                        etapaAtualText = "📥 Baixando e extraindo a Source Code...";
                    } else if (step.name.includes("Configurar Java") || step.name.includes("Configurar Android")) {
                        etapaAtualText = "⚙️ Preparando o ambiente (Java e SDK)...";
                    } else if (step.name.includes("Compilar o APK")) {
                        etapaAtualText = "🔨 Compilando o código-fonte (Isso leva alguns minutos)...";
                    } else if (step.name.includes("Criar Link")) {
                        etapaAtualText = "📦 Subindo o APK final para os servidores...";
                    } else {
                        etapaAtualText = `🔄 Processando: ${step.name}`;
                    }
                    break; // Pega apenas a primeira etapa que está em progresso e para
                }
            }

            if (status !== "completed") {
                const painelDinamico = 
                    `💻 **SISTEMA DE COMPILAÇÃO SA-MP**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `**Status:** ${etapaAtualText}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `_Aguarde, a mensagem será atualizada automaticamente._`;

                await bot.editMessageText(painelDinamico, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
            } 
            else if (status === "completed" && conclusion === "success") {
                clearInterval(interval);
                
                const logsResponse = await axios.get(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/jobs/${jobsResponse.data.jobs[0].id}/logs`, {
                    headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
                });
                
                const logTexto = logsResponse.data;
                const match = logTexto.match(/DOWNLOAD_URL:\s*(https?:\/\/[^\s]+)/);
                const linkFinal = match ? match[1].trim() : null;

                if (linkFinal) {
                    const painelSucesso = 
                        `✅ **OPERAÇÃO FINALIZADA**\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `**APK GERADO COM SUCESSO!**\n\n` +
                        `🔗 **Link de Download Direto:**\n${linkFinal}\n\n` +
                        `_Nota: O arquivo fica disponível por 24 horas nos nossos servidores._\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━`;
                    await bot.editMessageText(painelSucesso, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
                }
            } 
            else if (status === "completed" && conclusion !== "success") {
                clearInterval(interval);
                await bot.editMessageText(`❌ **FALHA CRÍTICA NA COMPILAÇÃO**\n━━━━━━━━━━━━━━━━━━━━━━\nO motor interrompeu a operação. Verifique a aba Actions do seu GitHub para corrigir os erros do código.`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
            }

        } catch (err) {}

        if (tentativas >= maxTentativas) clearInterval(interval);
    }, 15000); 
}
