const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

// Configurações das variáveis de ambiente
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USER;
const GITHUB_REPO = 'samp-compiler-engine'; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot de Compilação de SA-MP atualizado com sucesso!");

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

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "👋 Salve! Para compilar sua Source Code sem erro de limite de tamanho, faça o seguinte:\n\n1️⃣ Faça o upload do seu arquivo `.zip` no **MediaFire**, **Google Drive** ou **Mega**.\n2️⃣ Copie o link de compartilhamento do arquivo.\n3️⃣ Cole o link aqui no chat para mim!");
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return bot.sendMessage(chatId, "❌ Por favor, envie um link válido (começando com http:// ou https://).");
    }

    bot.sendMessage(chatId, "⚙️ Link recebido! Acionando o motor do GitHub Actions para iniciar a compilação...");

    try {
        // Nome padrão para o APK caso não ache no link
        let apkName = "SAMP_Mobile_Mod";

        // Dispara a API do GitHub Actions passando o link que você colou
        const githubUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/workflows/engine.yml/dispatches`;
        
        await axios.post(githubUrl, {
            ref: 'main',
            inputs: {
                zip_url: text.trim(), // O link do MediaFire/Drive vai direto para o seu engine.yml
                apk_name: apkName
            }
        }, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        bot.sendMessage(chatId, "🏭 **A compilação começou lá no GitHub!**\n\n⏱️ Aguarde de 3 a 5 minutos. Assim que o Docker terminar de gerar o APK na nuvem, eu trago o link pronto para você!");

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, `❌ Erro ao disparar o GitHub: ${error.message}`);
    }
});
