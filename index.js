const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');
const http = require('http');

// Configurações extraídas das variáveis de ambiente da nuvem (Segurança Máxima)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USER;
const GITHUB_REPO = 'samp-compiler-engine'; // Nome do repositório do motor

// Inicializa o Bot do Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot de Compilação de SA-MP iniciado com sucesso!");

// --- SISTEMA ANTI-SONO PARA MANTER O BOT 24H ON ---
// Cria um servidor web básico exigido pela Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Online 24h\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de monitoramento rodando na porta ${PORT}`);
});

// Ping automático a cada 5 minutos para o bot não dormir
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        axios.get(process.env.RENDER_EXTERNAL_URL)
            .then(() => console.log('Ping de atividade enviado! Mantendo o bot acordado...'))
            .catch((err) => console.error('Erro no ping anti-sono:', err.message));
    }
}, 300000); // 300.000 ms = 5 minutos
// --------------------------------------------------

// Quando o usuário manda uma mensagem de texto inicial
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "👋 Salve! Eu sou o Bot Compilador Oficial.\n\nPara gerar o seu APK de SA-MP Mobile modificado, basta me enviar o arquivo **.zip** da sua Source Code aqui no chat!");
});

// Quando o bot recebe qualquer documento/arquivo
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const doc = msg.document;

    // Verifica se é um arquivo .zip
    if (!doc.file_name.endsWith('.zip')) {
        return bot.sendMessage(chatId, "❌ Erro: Por favor, envie apenas arquivos compactados em formato `.zip`.");
    }

    bot.sendMessage(chatId, "📥 Arquivo recebido! Baixando e preparando o upload na nuvem...");

    try {
        // 1. Pega o link do arquivo nos servidores do Telegram
        const fileLink = await bot.getFileLink(doc.file_id);
        
        // Baixa o arquivo do Telegram para a memória
        const responseFile = await axios({ method: 'get', url: fileLink, responseType: 'stream' });

        bot.sendMessage(chatId, "🚀 Fazendo upload da Source para o servidor temporário (transfer.sh)...");

        // 2. Envia para o transfer.sh de forma automática
        const formData = new FormData();
        formData.append('file', responseFile.data, doc.file_name);

        const uploadRes = await axios.post(`https://transfer.sh/${doc.file_name}`, formData, {
            headers: { ...formData.getHeaders() }
        });

        const zipUrl = uploadRes.data.trim();
        bot.sendMessage(chatId, `✅ Upload concluído!\n🔗 Link da Source: ${zipUrl}\n\n⚙️ Acionando a fábrica do GitHub Actions agora...`);

        // 3. Dispara a API do GitHub Actions
        const githubUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/workflows/engine.yml/dispatches`;
        
        await axios.post(githubUrl, {
            ref: 'main', // ou 'master', dependendo da sua branch principal
            inputs: {
                zip_url: zipUrl,
                apk_name: doc.file_name.replace('.zip', '')
            }
        }, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        bot.sendMessage(chatId, "🏭 **A compilação começou!**\nO GitHub está montando o seu APK com o Docker agora.\n\n⏱️ Isso costuma levar de 3 a 5 minutos. Assim que terminar, eu te aviso aqui com o link de download direto!");

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, `❌ Ocorreu um erro no processo: ${error.message}`);
    }
});
