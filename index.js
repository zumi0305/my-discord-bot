const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// ================= 設定部分 =================
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1515109697680576684";
// ===========================================

// --- Webサイト用のサーバー設定 (Express) ---
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server is listening on port ${PORT}`);
});
// ---------------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "ja-JP,ja;q=0.9",
};

// ディス速からサーバー一覧を取得
async function getDissokuServers() {
    const url = "https://dissoku.net/ja/servers";
    try {
        const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        if (response.status !== 200) return [];

        const $ = cheerio.load(response.data);
        const servers = [];

        $("a[href]").each((i, el) => {
            let href = $(el).attr("href");
            if (href && href.includes("/servers/") && !href.endsWith("/servers")) {
                const title = $(el).text().trim();
                if (title) {
                    if (!href.startsWith("http")) href = "https://dissoku.net" + href;
                    servers.push({ title, detail_link: href });
                }
            }
        });

        const uniqueServers = [];
        const seen = new Set();
        for (const s of servers) {
            if (!seen.has(s.detail_link)) {
                seen.add(s.detail_link);
                uniqueServers.push(s);
            }
        }
        return uniqueServers;
    } catch (e) {
        console.log("一覧取得エラー:", e.message);
        return [];
    }
}

// 詳細ページから招待リンクを抽出
async function getDirectInviteLink(detailUrl) {
    try {
        const response = await axios.get(detailUrl, { headers: HEADERS, timeout: 15000 });
        if (response.status !== 200) return null;

        const $ = cheerio.load(response.data);
        let inviteLink = null;

        $("a[href]").each((i, el) => {
            const href = $(el).attr("href");
            if (href && (href.includes("discord.gg/") || href.includes("discord.com/invite/"))) {
                inviteLink = href;
                return false;
            }
        });
        return inviteLink;
    } catch (e) {
        console.log("詳細ページ解析エラー:", e.message);
        return null;
    }
}

// メインの取得・送信処理（共通化）
async function fetchAndSendInvite(targetChannel) {
    console.log("ディス速から最新のサーバー情報を取得しています...");
    const servers = await getDissokuServers();

    if (!servers || servers.length === 0) {
        console.log("データが空のためスキップします。");
        return "サーバーデータの取得に失敗したか、データが空でした。";
    }

    // シャッフル
    for (let i = servers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [servers[i], servers[j]] = [servers[j], servers[i]];
    }

    let directLink = null;
    const targetServers = servers.slice(0, 5);
    for (const server of targetServers) {
        console.log(`「${server.title}」から直接招待URLを抽出中...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        const inviteUrl = await getDirectInviteLink(server.detail_link);
        if (inviteUrl) {
            directLink = inviteUrl;
            break;
        }
    }

    if (directLink) {
        await targetChannel.send(directLink);
        console.log(`【送信完了】投稿しました ➔ ${directLink}`);
        return `成功しました！招待リンクを投稿しました。`;
    } else {
        console.log("直接招待リンクが取得できませんでした。");
        return "直接招待リンクが見つかりませんでした。";
    }
}

// 定期実行用（30分おき）
async function sendRandomServerAutomated() {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.log(`【自動実行エラー】チャンネルが見つかりません。`);
        return;
    }
    await fetchAndSendInvite(channel);
}

// スラッシュコマンドの設定登録
const commands = [
    new SlashCommandBuilder()
        .setName('自動依頼')
        .setDescription('ディス速からランダムに招待リンクを1つ取得してこのチャンネルに送信します')
].map(command => command.toJSON());

// ログイン完了時の処理
client.once('ready', async () => {
    console.log(`成功: ${client.user.tag} としてログインしました！`);
    
    // スラッシュコマンドをDiscordに登録する
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('スラッシュコマンドを登録中...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('スラッシュコマンドの登録に成功しました！');
    } catch (error) {
        console.error('コマンド登録エラー:', error);
    }
    
    // 30分（1800000ミリ秒）ごとの定期実行も起動
    setInterval(sendRandomServerAutomated, 1800000);
});

// コマンドが実行されたときの処理
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === '自動依頼') {
        // 返信が遅れるとエラーになるのを防ぐため、一旦「考え中...」にする
        await interaction.deferReply({ ephemeral: true });

        // コマンドが打たれたチャンネルに送信する
        const resultMessage = await fetchAndSendInvite(interaction.channel);
        
        // 結果を本人にだけ通知
        await interaction.editReply({ content: resultMessage });
    }
});

// ログイン実行
if (TOKEN) {
    client.login(TOKEN).catch(err => {
        console.error("ログインエラー:", err.message);
    });
} else {
    console.log("【致命的なエラー】シークレットに 'DISCORD_TOKEN' が設定されていません。");
}
