import os
import sys
import asyncio
import random
from threading import Thread
import discord
from discord.ext import tasks
import requests
from bs4 import BeautifulSoup
from flask import Flask, render_template

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

TOKEN = os.environ.get("DISCORD_TOKEN")
CHANNEL_ID_STR = os.environ.get("DISCORD_CHANNEL_ID", "1515109697680576684")
CHANNEL_ID = int(CHANNEL_ID_STR) if CHANNEL_ID_STR.isdigit() else 1515109697680576684

app = Flask(__name__, template_folder='.')

@app.route('/')
def home():
    return render_template('index.html')

def run_web_server():
    app.run(host='0.0.0.0', port=8080)

def keep_alive():
    t = Thread(target=run_web_server)
    t.start()

intents = discord.Intents.default()
intents.guilds = True
client = discord.Client(intents=intents)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "ja-JP,ja;q=0.9",
}

def get_dissoku_servers():
    url = "https://dissoku.net/ja/servers"
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            return []
        soup = BeautifulSoup(response.text, "html.parser")
        servers = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/servers/" in href and not href.endswith("/servers"):
                title = a.get_text(strip=True)
                if title:
                    if not href.startswith("http"):
                        href = "https://dissoku.net" + href
                    servers.append({"title": title, "detail_link": href})
        unique_servers = []
        seen = set()
        for s in servers:
            if s["detail_link"] not in seen:
                seen.add(s["detail_link"])
                unique_servers.append(s)
        return unique_servers
    except Exception as e:
        print("一覧取得エラー:", e)
        return []

def get_direct_invite_link(detail_url):
    try:
        response = requests.get(detail_url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            return None
        soup = BeautifulSoup(response.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "discord.gg/" in href or "discord.com/invite/" in href:
                return href
        return None
    except Exception as e:
        print("詳細ページ解析エラー:", e)
        return None

@client.event
async def on_ready():
    print(f"成功: {client.user} としてログインしました！")
    if not send_random_server.is_running():
        send_random_server.start()

@tasks.loop(minutes=30)
async def send_random_server():
    channel = client.get_channel(CHANNEL_ID)
    if not channel:
        print(f"【エラー】チャンネル（ID: {CHANNEL_ID}）が見つかりません。")
        return
    print("ディス速から情報を取得中...")
    servers = get_dissoku_servers()
    if not servers:
        return
    random.shuffle(servers)
    direct_link = None
    for server in servers[:5]:
        await asyncio.sleep(1.5)
        invite_url = get_direct_invite_link(server["detail_link"])
        if invite_url:
            direct_link = invite_url
            break
    if direct_link:
        await channel.send(direct_link)
        print(f"【送信完了】投稿完了 ➔ {direct_link}")

@send_random_server.before_loop
async def before_send():
    await client.wait_until_ready()

if TOKEN:
    keep_alive()
    client.run(TOKEN)
else:
    print("【致命的なエラー】DISCORD_TOKENが設定されていません。")
