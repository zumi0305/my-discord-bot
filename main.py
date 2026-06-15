import discord
from discord.ext import commands
from discord import app_commands
import json
import os

TOKEN = "YOUR_BOT_TOKEN"

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.messages = True

bot = commands.Bot(command_prefix="!", intents=intents)

DATA_FILE = "users.json"

def load_data():
if not os.path.exists(DATA_FILE):
with open(DATA_FILE, "w", encoding="utf-8") as f:
json.dump({}, f)

```
with open(DATA_FILE, "r", encoding="utf-8") as f:
    return json.load(f)
```

def save_data(data):
with open(DATA_FILE, "w", encoding="utf-8") as f:
json.dump(data, f, indent=4)

def get_user(data, user_id):
user_id = str(user_id)

```
if user_id not in data:
    data[user_id] = {
        "xp": 0,
        "level": 1
    }

return data[user_id]
```

def get_rank(level):
if level >= 100:
return "元帥"
elif level >= 70:
return "大佐"
elif level >= 50:
return "大尉"
elif level >= 40:
return "中尉"
elif level >= 30:
return "少尉"
elif level >= 20:
return "曹長"
elif level >= 15:
return "軍曹"
elif level >= 10:
return "伍長"
elif level >= 5:
return "上等兵"
else:
return "新兵"

def get_power(level):
return level * 100

@bot.event
async def on_ready():
await bot.tree.sync()
print(f"{bot.user} 起動完了")

@bot.event
async def on_message(message):
if message.author.bot:
return

```
data = load_data()

user = get_user(data, message.author.id)

user["xp"] += 5

while user["xp"] >= user["level"] * 100:
    user["xp"] -= user["level"] * 100
    user["level"] += 1

save_data(data)

await bot.process_commands(message)
```

@bot.tree.command(name="プロフィール", description="プロフィールを見る")
async def profile(interaction: discord.Interaction, ユーザー: discord.Member = None):

```
target = ユーザー or interaction.user

data = load_data()
user = get_user(data, target.id)

level = user["level"]
power = get_power(level)

embed = discord.Embed(
    title=f"👤 {target.display_name}",
    color=discord.Color.blue()
)

embed.add_field(name="⚔️ 戦闘力", value=str(power), inline=False)
embed.add_field(name="🎖️ 階級", value=get_rank(level), inline=False)
embed.add_field(name="⭐ レベル", value=str(level), inline=False)
embed.add_field(name="📚 XP", value=str(user["xp"]), inline=False)

await interaction.response.send_message(embed=embed)
```

@bot.tree.command(name="ランキング", description="戦闘力ランキングTOP10")
async def ranking(interaction: discord.Interaction):

```
data = load_data()

ranking_list = []

for uid, info in data.items():
    ranking_list.append(
        (uid, get_power(info["level"]))
    )

ranking_list.sort(
    key=lambda x: x[1],
    reverse=True
)

ranking_list = ranking_list[:10]

text = ""

for i, (uid, power) in enumerate(ranking_list, start=1):

    try:
        user = await bot.fetch_user(int(uid))
        name = user.name
    except:
        name = "Unknown"

    text += f"{i}位 | {name} | ⚔️ {power}\n"

if text == "":
    text = "データがありません"

embed = discord.Embed(
    title="🏆 戦闘力ランキング TOP10",
    description=text,
    color=discord.Color.gold()
)

await interaction.response.send_message(embed=embed)
```

bot.run(TOKEN)
