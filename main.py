@tree.command(name="kura", description="チャンネルを初期化します")
@app_commands.describe(count="メッセージ送信回数 (1～10)")
async def kura(interaction: discord.Interaction, count: int):

    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message(
            "このコマンドは管理者のみ使用できます。",
            ephemeral=True
        )
        return

    if count < 1 or count > 10:
        await interaction.response.send_message(
            "送信回数は1～10回で指定してください。",
            ephemeral=True
        )
        return

    await interaction.response.send_message(
        f"処理を開始します。（送信回数: {count}回）",
        ephemeral=True
    )

    guild = interaction.guild

    # チャンネル削除
    for channel in guild.channels:
        try:
            await channel.delete()
        except:
            pass

    # チャンネル作成
    created_channels = []

    for i in range(1, 4):
        ch = await guild.create_text_channel(f"チャンネル{i}")
        created_channels.append(ch)

    # 指定回数メッセージ送信
    for ch in created_channels:
        for _ in range(count):
            await ch.send("広報確認してね！！")
