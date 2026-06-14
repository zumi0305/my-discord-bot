const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// ================= 設定部分 =================
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1515109697680576684";
// ===========================================

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server is listening on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ja-JP,ja;q=0.9",
};

// ディスココードからサーバー一覧を取得
async function getDiscocordServers() {
    const url = "https://discocord.com/servers";
    try {
        const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        if (response.status !== 200) {
            console.log(`[一覧取得エラー] ステータス: ${response.status}`);
            return [];
        }

        const $ = cheerio.load(response.data);
        const servers = [];

        // ディスココードのサーバー詳細リンクを抽出
        $("a").each((i, el) => {
            let href = $(el).attr("href");
            if (href && href.includes("/servers/") && !href.endsWith("/servers")) {
                const title = $(el).text().trim();
                if (title) {
                    if (!href.startsWith("http")) href = "https://discocord.com" + href;
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
        console.log(`[ログ] ディスココードから ${uniqueServers.length} 件のサーバーを取得しました。`);
        return uniqueServers;
    } catch (e) {
        console.log("[一覧取得エラー] 詳細:", e.message);
        return [];
    }
}

// 詳細ページから直接の招待リンクを抽出
async function getDirectInviteLink(detailUrl) {
    try {
        const response = await axios.get(detailUrl, { headers: HEADERS, timeout: 15000 });
        if (response.status !== 200) return null;

        const $ = cheerio.load(response.data);
        let inviteLink = null;

        $("a").each((i, el) => {
            const href = $(el).attr("href");
            if (href && (href.includes("discord.gg/") || href.includes("discord.com/invite/"))) {
                inviteLink = href;
                return false;
            }
        });
        return inviteLink;
    } catch (e) {
        console.log(`[詳細ページエラー] ${detailUrl} ➔`, e.message);
        return null;
    }
}

// メイン処理
async function fetchAndSendInvite(targetChannel) {
    console.log("ディスココードからサーバー情報を取得しています...");
    const servers = await getDiscocordServers();

    if (!servers || servers.length === 0) {
        return "サーバーデータの取得に失敗しました。時間をおいて試してください。";
    }

    // シャッフル
    for (let i = servers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [servers[i], servers[j]] = [servers[j], servers[i]];
    }

    let directLink = null;
    const targetServers = servers.slice(0, 10);
    for (const server of targetServers) {
        console.log(`「${server.title}」の招待リンクを解析中...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        const inviteUrl = await getDirectInviteLink(server.detail_link);
        if (inviteUrl) {
            directLink = inviteUrl;
            break;
        }
    }

    if (directLink) {
        await targetChannel.send(directLink);
        console.log(`【送信完了】➔ ${directLink}`);
        return `成功しました！招待リンクを投稿しました。`;
    } else {
        return "直接の招待リンクが見つかりませんでした。もう一度試してください。";
    }
}

async function sendRandomServerAutomated() {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) return;
    await fetchAndSendInvite(channel);
}

const commands = [
    new SlashCommandBuilder()
        .setName('自動依頼')
        .setDescription('サーバーまとめサイトからランダムに招待リンクを1つ取得して送信します')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`成功: ${client.user.tag} としてログインしました！`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('スラッシュコマンドの登録に成功しました！');
    } catch (error) {
        console.error('コマンド登録エラー:', error);
    }
    setInterval(sendRandomServerAutomated, 1800000);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === '自動依頼') {
        await interaction.deferReply({ ephemeral: true });
        const resultMessage = await fetchAndSendInvite(interaction.channel);
        await interaction.editReply({ content: resultMessage });
    }
});

if (TOKEN) {
    client.login(TOKEN).catch(err => console.error("ログインエラー:", err.message));
}
