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
    res.send("Bot is running!");
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

// ブロックを回避するための設定
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml"
};

// ディス速のデータから最新のサーバーURLリストを取得
async function getDissokuLinks() {
    const url = "https://dissoku.net/ja/rss";
    try {
        const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        if (response.status !== 200) {
            console.log(`ディス速データの取得失敗 (ステータス: ${response.status})`);
            return [];
        }

        const xmlData = response.data;
        // あなたのコードと同じように、正規表現でサーバー詳細URLを抽出
        const linkRegex = /<link>(https:\/\/dissoku\.net\/ja\/servers\/[^\s<]+)<\/link>/g;
        let match;
        const links = [];

        while ((match = linkRegex.exec(xmlData)) !== null) {
            links.push(match[1]);
        }

        // 重複を削除して返す
        return [...new Set(links)];
    } catch (error) {
        console.log("データ取得エラー:", error.message);
        return [];
    }
}

// ⏰ 指定の「4分に1回」自動送信するメイン処理
async function sendRandomServerAutomated() {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.log(`【エラー】チャンネル（ID: ${CHANNEL_ID}）が見つかりません。`);
        return;
    }

    console.log("ディス速から最新のサーバー情報を自動取得中...");
    const links = await getDissokuLinks();

    if (!links || links.length === 0) {
        console.log("有効なサーバーリンクが見つからなかったためスキップします。");
        return;
    }

    // 取得した最新リストからランダムに1つ選択
    const randomIndex = Math.floor(Math.random() * links.length);
    const chosenLink = links[randomIndex];

    try {
        // Discordが自動で綺麗なカード（緑の参加ボタン付き）にしてくれます
        await channel.send(`【ディス速最新自動取得】\n${chosenLink}`);
        console.log(`【送信完了】投稿しました ➔ ${chosenLink}`);
    } catch (error) {
        console.log("メッセージ送信エラー:", error.message);
    }
}

client.once('ready', () => {
    console.log(`成功: ${client.user.tag} としてログインしました！`);
    
    // 起動直後に1回目を実行
    sendRandomServerAutomated();

    // 4分（240,000ミリ秒）ごとに自動実行するループ
    setInterval(sendRandomServerAutomated, 240000);
    console.log("4分ごとの自動取得・送信ループを開始しました。");
});

if (TOKEN) {
    client.login(TOKEN).catch(err => console.error("ログインエラー:", err.message));
} else {
    console.log("【致命的なエラー】シークレットに 'DISCORD_TOKEN' が設定されていません。");
}
