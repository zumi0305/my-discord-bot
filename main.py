import os
import sys
import asyncio
import random
import re
from threading import Thread
import discord
from discord.ext import tasks
import requests
from flask import Flask

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# ================= 設定部分 =================
TOKEN = os.environ.get("DISCORD_TOKEN")
CHANNEL_ID_STR = os.environ.get("DISCORD_CHANNEL_ID", "1515109697680576684")
CHANNEL_ID = int(CHANNEL_ID_STR) if CHANNEL_ID_STR.isdigit() else 1515109697680576684
# ===========================================

app = Flask(__name__)

@app.route('/')
def home():
    return "Bot is running!"

def run_web_server():
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)

def keep_alive():
    t = Thread(target=run_web_server)
    t.daemon = True
    t.start()

intents = discord.Intents.default()
client = discord.Client(intents=intents)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml"
}

# 🔒 セキュリティ（403）に弾かれないデータ配信元から取得します
def get_dissoku_rss_links():
    url = "https://dissoku.net/ja/rss"
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            print(f"ディス速データの取得失敗 (ステータス: {response.status_code})")
            return []

        xml_data = response.text
        links = re.findall(r'<link>(https://dissoku\.net/ja/servers/[^\s<]+)</link>', xml_data)
        return list(set(links))
    except Exception as e:
        print("データ取得エラー:", e)
        return []

@client.event
async def on_ready():
    print(f"成功: {client.user} としてログインしました！")
    if not send_random_server.is_running():
        send_random_server.start()

# ⏰ 4分ごとに自動送信
@tasks.loop(minutes=4)
async def send_random_server():
    channel = client.get_channel(CHANNEL_ID)
    if not channel:
        print(f"【エラー】チャンネル（ID: {CHANNEL_ID}）が見つかりません。")
        return

    print("ディス速から最新のサーバー情報を自動取得中...")
    links = get_dissoku_rss_links()
    
    if not links:
        print("有効なサーバーリンクが見つからなかったためスキップします。")
        return

    chosen_link = random.choice(links)

    try:
        # Discordに送信（緑の参加ボタン付きカードになります）
        await channel.send(f"【ディス速最新自動取得】\n{chosen_link}")
        print(f"【送信完了】投稿しました ➔ {chosen_link}")
    except Exception as e:
        print("メッセージ送信エラー:", e)

@send_random_server.before_loop
async def before_send():
    await client.wait_until_ready()

if TOKEN:
    keep_alive()
    try:
        client.run(TOKEN)
    except Exception as e:
        print("ログインエラーが発生しました:", e)
else:
    print("【致命的なエラー】シークレットに 'DISCORD_TOKEN' が設定されていません。")
