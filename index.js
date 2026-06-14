const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// ================= 設定部分 =================
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1515109697680576684";

// 🏷️ 検索したいタグ（「ゲーム」「雑談」「アニメ」など、ディスボードにあるタグを指定できます）
const SEARCH_TAG = "雑談"; 
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

// ディスボードからサーバー情報を取得する関数
async function fetchAndSendDisboardLink() {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.log("【エラー】チャンネルが見つかりません。");
        return;
    }

    console.log(`ディスボードから「${SEARCH_TAG}」タグの最新サーバーを取得中...`);

    // ブロックを回避しやすいディスボードの検索ページURL
    const url = `https://disboard.org/ja/servers/tag/${encodeURIComponent(SEARCH_TAG)}`;
    
    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "ja-JP,ja;q=0.9"
            },
            timeout: 10000
        });

        if (response.status !== 200) {
            console.log(`[取得エラー] ステータスコード: ${response.status}`);
            return;
        }

        const $ = cheerio.load(response.data);
        const serverPageLinks = [];

        // ディスボード内の各サーバー詳細ページへのリンクを集める
        $("a").each((i, el) => {
            const href = $(el).attr("href");
            // /server/join/〜 という直接の招待仲介リンクを探す
            if (href && href.includes("/server/join/")) {
                const fullLink = href.startsWith("http") ? href : "https://disboard.org" + href;
                serverPageLinks.push(fullLink);
            }
        });

        if (serverPageLinks.length === 0) {
            console.log("ディスボードからサーバーのリンクが見つかりませんでした。");
            return;
        }

        // 集まった最新サーバーの中からランダムに1つ選ぶ
        const randomIndex = Math.floor(Math.random() * serverPageLinks.length);
        const chosenLink = serverPageLinks[randomIndex];

        // Discordに送信
        await channel.send(`【ディスボード最新自動取得】\n${chosenLink}`);
        console.log(`【自動送信成功】投稿しました ➔ ${chosenLink}`);

    } catch (error) {
        console.log("[エラー発生] ディスボードへのアクセスに失敗しました:", error.message);
    }
}

client.once('ready', () => {
    console.log(`成功: ${client.user.tag} としてログインしました！`);
    
    // 起動直後に1回目を実行
    fetchAndSendDisboardLink();

    // 4分（240,000ミリ秒）ごとに自動実行するループ
    setInterval(fetchAndSendDisboardLink, 240000);
    console.log("4分ごとの自動取得・送信ループを開始しました。");
});

if (TOKEN) {
    client.login(TOKEN).catch(err => console.error("ログインエラー:", err.message));
}
