const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

// Configurações das variáveis de ambiente
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USER;
const GITHUB_REPO = 'samp-compiler-engine'; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot de Compilação de SA-MP (Versão Link) iniciado!");

// --- SISTEMA ANTI-SONO ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Online 24h\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {});

setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        axios.get(process.env.RENDER_EXTERNAL_URL).catch(() => {});
    }
}, 300000);
// -------------------------

// Mensagem de Start atualizada
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "👋 Salve! Para compilar sua Source Code sem limites de tamanho (Erro de File Too Big), faça o seguinte:\n\n1️⃣ Faça o upload do seu arquivo `.zip` em um site como o **transfer.sh** ou **mediafire.com**.\n2️⃣ Copie o link direto de download do arquivo.\n3️⃣ Cole o link aqui no chat para mim!");
});

// Captura qualquer mensagem de texto que pareça um link
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignora o comando /start
    if (!text || text.startsWith('/start')) return;

    // Verifica se o usuário enviou um link válido
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return bot.sendMessage(chatId, "❌ Por favor, envie um link válido de download (começando com http:// ou https://).");
    }

    bot.sendMessage(chatId, "⚙️ Link recebido! Acionando o motor do GitHub Actions para baixar e compilar sua source...");

    try {
        // Tenta descobrir o nome do APK com base no final do link
        let apkName = "SAMP_Mobile";
        if (text.includes('.zip')) {
            const parts = text.split('/');
            apkName = parts[parts.length - 1].replace('.zip', '');
        }

        // Dispara a API do GitHub Actions passando o link que o usuário colou
        const githubUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/workflows/engine.yml/dispatches`;
        
        await axios.post(githubUrl, {
            ref: 'main',
            inputs: {
                zip_url: text.trim(), // Envia o link direto pro GitHub buscar
                apk_name: apkName
            }
        }, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        bot.sendMessage(chatId, "🏭 **A compilação começou!**\nComo o link vai direto para o GitHub, o limite de tamanho sumiu.\n\n⏱️ Aguarde de 3 a 5 minutos. Assim que o APK estiver pronto na nuvem, eu trago o link para você!");

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, `❌ Erro ao disparar o GitHub: ${error.message}`);
    }
});
