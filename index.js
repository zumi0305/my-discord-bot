const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// ================= 設定部分 =================
const TOKEN = process.env.DISCORD_TOKEN;
// チャンネルIDは元のコードのものをそのまま設定しています
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1515109697680576684";
// ===========================================

// --- Webサイト用のサーバー設定 (Express) ---
const app = express();
const PORT = process.env.PORT || 8080;

// 元のPython(Flask)と同じように、トップページにアクセスされたら index.html を返す設定
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

// ディス速からサーバー一覧を取得する関数
async function getDissokuServers() {
    const url = "https://dissoku.net/ja/servers";
    try {
        const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        if (response.status !== 200) {
            console.log(`ディス速一覧の取得失敗 (ステータス: ${response.status})`);
            return [];
        }

        const $ = cheerio.load(response.data);
        const servers = [];

        $("a[href]").each((i, el) => {
            let href = $(el).attr("href");
            if (href && href.includes("/servers/") && !href.endsWith("/servers")) {
                const title = $(el).text().trim();
                if (title) {
                    if (!href.startsWith("http")) {
                        href = "https://dissoku.net" + href;
                    }
                    servers.push({ title, detail_link: href });
                }
            }
        });

        // 重複排除
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

// 詳細ページから直接の招待リンクを抽出する関数
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
                return false; // ループを抜ける
            }
        });

        return inviteLink;
    } catch (e) {
        console.log("詳細ページ解析エラー:", e.message);
        return null;
    }
}

// 30分に1回実行されるメイン処理
async function sendRandomServer() {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.log(`【エラー】チャンネル（ID: ${CHANNEL_ID}）が見つかりません。`);
        return;
    }

    console.log("ディス速から最新のサーバー情報を取得しています...");
    const servers = await getDissokuServers();

    if (!servers || servers.length === 0) {
        console.log("データが空のためスキップします。");
        return;
    }

    // 配列のシャッフル (Pythonの random.shuffle と同じ)
    for (let i = servers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [servers[i], servers[j]] = [servers[j], servers[i]];
    }

    let directLink = null;

    // 最初から最大5つのサーバーを巡回
    const targetServers = servers.slice(0, 5);
    for (const server of targetServers) {
        console.log(`「${server.title}」から直接招待URLを抽出中...`);
        
        // 1.5秒待機 (Pythonの await asyncio.sleep(1.5) と同じ)
        await new Promise(resolve => setTimeout(resolve, 1500));

        const inviteUrl = await getDirectInviteLink(server.detail_link);
        if (inviteUrl) {
            directLink = inviteUrl;
            break;
        }
    }

    if (directLink) {
        // URLのみを送信することでDiscord公式の参加ボタン付きカードが出ます
        await channel.send(directLink);
        console.log(`【送信完了】参加ボタン付きカード（本物）を投稿しました ➔ {directLink}`);
    } else {
        console.log("直接招待リンクが取得できなかったため、今回は送信をスキップしました。");
    }
}

// ログイン完了時の処理
client.once('ready', () => {
    console.log(`成功: ${client.user.tag} としてログインしました！`);
    
    // 起動直後に1回実行
    sendRandomServer();
    
    // 30分（1800000ミリ秒）ごとに定期実行
    setInterval(sendRandomServer, 180000);
});

// ログイン実行
if (TOKEN) {
    client.login(TOKEN).catch(err => {
        console.error("ログインエラー:", err.message);
    });
} else {
    console.log("【致命的なエラー】シークレット（環境変数）に 'DISCORD_TOKEN' が設定されていません。");
}
