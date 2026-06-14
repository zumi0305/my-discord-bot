import os
import json
import discord
from discord import app_commands

# Botの初期設定（インテント）
intents = discord.Intents.default()
intents.messages = True
intents.message_content = True

class MyBot(discord.Client):
    def __init__(self):
        super().__init__(intents=intents)
        # スラッシュコマンド用のツリーを作成
        self.tree = app_commands.CommandTree(self)

client = MyBot()

# Renderの仕様に合わせて確実にカレントディレクトリに保存する
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'users.json')
user_data = {}

# データの読み込み（安全版）
def load_data():
    global user_data
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    user_data = json.loads(content)
                else:
                    user_data = {}
        except Exception as e:
            print(f"データ読み込み失敗: {e}")
            user_data = {}
    else:
        user_data = {}

# データの保存（安全版）
def save_data():
    try:
        # 一時ファイルに書き込んでから置換することで破損を防ぐ
        temp_file = DATA_FILE + '.tmp'
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(user_data, f, indent=4, ensure_ascii=False)
        if os.path.exists(temp_file):
            if os.path.exists(DATA_FILE):
                os.remove(DATA_FILE)
            os.rename(temp_file, DATA_FILE)
    except Exception as e:
        print(f"データ保存失敗: {e}")

# ランクの判定
def get_rank(level):
    if level >= 100: return 'Marshal (元帥)'
    if level >= 70:  return 'Colonel (大佐)'
    if level >= 50:  return 'Captain (大尉)'
    if level >= 40:  return 'Lieutenant (中尉)'
    if level >= 30:  return 'Second Lieutenant (少尉)'
    if level >= 20:  return 'First Sergeant (曹長)'
    if level >= 15:  return 'Sergeant (軍曹)'
    if level >= 10:  return 'Corporal (伍長)'
    if level >= 5:   return 'Private First Class (上等兵)'
    return 'Private (新兵)'

# ユーザーの初期化
def init_user(user_id, username):
    str_id = str(user_id)
    if str_id not in user_data:
        user_data[str_id] = {
            "id": user_id,
            "name": username,
            "xp": 0,
            "level": 1,
            "wins": 0,
            "merit": 0
        }
        save_data()

# 起動時に実行されるイベント
@client.event
async def on_ready():
    print(f'{client.user.name} ({client.user.id}) is online!')
    load_data()
    try:
        # スラッシュコマンドをDiscordに強制同期
        await client.tree.sync()
        print("スラッシュコマンドの同期が成功しました！")
    except Exception as e:
        print(f"Failed to sync commands: {e}")

# メッセージが送信された時のイベント（XP付与）
@client.event
async def on_message(message):
    if message.author.bot:
        return

    user_id = message.author.id
    init_user(user_id, message.author.name)

    str_id = str(user_id)
    user_data[str_id]["xp"] += 5
    user = user_data[str_id]
    next_level_xp = user["level"] * 100

    if user["xp"] >= next_level_xp:
        user["xp"] -= next_level_xp
        user["level"] += 1
        await message.reply(f"⭐ **LEVEL UP!**\n{message.author.name} reached Level **{user['level']}**!")
    
    save_data()

# /profile コマンド
@client.tree.command(name="profile", description="View profile")
@app_commands.describe(user="Select a user")
async def profile(interaction: discord.Interaction, user: discord.User = None):
    # データを最新状態に読み込み直す
    load_data()
    target_user = user or interaction.user
    init_user(target_user.id, target_user.name)
    
    data = user_data[str(target_user.id)]
    power = data["level"] * 100
    rank = get_rank(data["level"])

    await interaction.response.send_message(
        f"👤 **{data['name']}**\n⚔️ **Power:** ${power}\n🎖️ **Rank:** {rank}\n⭐ **Level:** {data['level']}"
    )

# /ranking コマンド
@client.tree.command(name="ranking", description="View Leaderboard")
async def ranking(interaction: discord.Interaction):
    # データを最新状態に読み込み直す
    load_data()
    sorted_list = sorted(user_data.values(), key=lambda x: x['level'], reverse=True)[:10]
    
    if not sorted_list:
        await interaction.response.send_message('No data.')
        return

    txt = '🏆 **Leaderboard**\n\n'
    for i, u in enumerate(sorted_list):
        txt += f"{i+1}. {u['name']} ⚔️{u['level']*100}\n"
        
    await interaction.response.send_message(txt)

# Renderの環境変数からトークンを読み込んで起動
client.run(os.getenv('DISCORD_TOKEN'))
