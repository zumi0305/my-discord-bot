const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
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

// ディス速のRSS（配信データ）から最新サーバーを自動取得する関数
async function fetchDissokuRss() {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.log("【エラー】チャンネルが見つかりません。");
        return;
    }

    console.log("ディス速のRSSフィードから最新サーバーを取得中...");
    
    // Webサイトの画面ではなく、ブロックされにくいデータ配信元URLを使用
    const url = "https://dissoku.net/ja/rss";

    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/rss+xml, application/xml, text/xml"
            },
            timeout: 10000
        });

        const xmlData = response.data;
        
        // XMLからリンク（<link>タグの中身）を簡易的に抽出
        const linkRegex = /<link>(https:\/\/dissoku\.net\/ja\/servers\/[^\s<]+)<\/link>/g;
        let match;
        const serverLinks = [];

        while ((match = linkRegex.exec(xmlData)) !== null) {
            serverLinks.push(match[1]);
        }

        if (serverLinks.length === 0) {
            console.log("ディス速のデータからサーバーリンクが見つかりませんでした。");
            return;
        }

        // 取得した最新リンク一覧からランダムに1つ選ぶ
        const randomIndex = Math.floor(Math.random() * serverLinks.length);
        const chosenLink = serverLinks[randomIndex];

        // Discordに自動送信
        await channel.send(`【ディス速最新自動取得】\n${chosenLink}`);
        console.log(`【自動送信成功】投稿しました ➔ ${chosenLink}`);

    } catch (error) {
        console.log("[エラー発生] ディス速RSSへのアクセスに失敗しました:", error.message);
    }
}

client.once('ready', () => {
    console.log(`成功: ${client.user.tag} としてログインしました！`);
    
    // 起動直後に1回目を実行
    fetchDissokuRss();

    // 4分（240,000ミリ秒）ごとに自動実行するループ
    setInterval(fetchDissokuRss, 240000);
    console.log("4分ごとの自動取得・送信ループを開始しました。");
});

if (TOKEN) {
    client.login(TOKEN).catch(err => console.error("ログインエラー:", err.message));
}
