import discord
from discord import app_commands

TOKEN = "BOT_TOKEN"

intents = discord.Intents.default()

client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)

@client.event
async def on_ready():
    try:
        synced = await tree.sync()
        print(f"{len(synced)}個のコマンドを同期しました")
    except Exception as e:
        print(e)

    print(f"ログインしました: {client.user}")

@tree.command(
    name="kura",
    description="チャンネルを作成してメッセージを送信"
)
@app_commands.describe(
    channel_count="作成するチャンネル数",
    send_count="各チャンネルへの送信回数"
)
async def kura(
    interaction: discord.Interaction,
    channel_count: int,
    send_count: int
):

    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message(
            "管理者のみ使用できます。",
            ephemeral=True
        )
        return

    if channel_count < 1 or channel_count > 20:
        await interaction.response.send_message(
            "チャンネル数は1～20で指定してください。",
            ephemeral=True
        )
        return

    if send_count < 1 or send_count > 10:
        await interaction.response.send_message(
            "送信回数は1～10で指定してください。",
            ephemeral=True
        )
        return

    await interaction.response.send_message(
        "処理を開始します...",
        ephemeral=True
    )

    created_channels = []

    for i in range(channel_count):
        ch = await interaction.guild.create_text_channel(
            f"チャンネル{i + 1}"
        )
        created_channels.append(ch)

    for ch in created_channels:
        for _ in range(send_count):
            await ch.send("広報確認してね！！")

    print(
        f"{interaction.guild.name}: "
        f"{channel_count}個作成 / {send_count}回送信"
    )

client.run(TOKEN)
