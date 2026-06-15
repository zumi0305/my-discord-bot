const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder
} = require('discord.js');

const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const DATA_FILE = './users.json';

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getRank(level) {
    if (level >= 100) return '元帥';
    if (level >= 70) return '大佐';
    if (level >= 50) return '大尉';
    if (level >= 40) return '中尉';
    if (level >= 30) return '少尉';
    if (level >= 20) return '曹長';
    if (level >= 15) return '軍曹';
    if (level >= 10) return '伍長';
    if (level >= 5) return '上等兵';
    return '新兵';
}

function getPower(level) {
    return level * 100;
}

client.once('ready', async () => {
    console.log(`${client.user.tag} 起動`);

    const commands = [
        new SlashCommandBuilder()
            .setName('プロフィール')
            .setDescription('プロフィールを見る')
            .addUserOption(option =>
                option
                    .setName('ユーザー')
                    .setDescription('対象ユーザー')
                    .setRequired(false)
            ),

        new SlashCommandBuilder()
            .setName('ランキング')
            .setDescription('戦闘力ランキング')
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('スラッシュコマンド登録完了');
    } catch (err) {
        console.error(err);
    }
});

client.on('messageCreate', message => {
    if (message.author.bot) return;

    const data = loadData();

    if (!data[message.author.id]) {
        data[message.author.id] = {
            xp: 0,
            level: 1,
            wins: 0,
            military: 0
        };
    }

    const user = data[message.author.id];

    user.xp += 5;

    while (user.xp >= user.level * 100) {
        user.xp -= user.level * 100;
        user.level++;
    }

    saveData(data);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const data = loadData();

    if (interaction.commandName === 'プロフィール') {

        const target =
            interaction.options.getUser('ユーザー') ||
            interaction.user;

        if (!data[target.id]) {
            data[target.id] = {
                xp: 0,
                level: 1,
                wins: 0,
                military: 0
            };
            saveData(data);
        }

        const user = data[target.id];

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${target.username}`)
            .addFields(
                {
                    name: '⚔️ 戦闘力',
                    value: `${getPower(user.level)}`,
                    inline: true
                },
                {
                    name: '🎖️ 階級',
                    value: getRank(user.level),
                    inline: true
                },
                {
                    name: '⭐ レベル',
                    value: `${user.level}`,
                    inline: true
                },
                {
                    name: '🏆 勝利数',
                    value: `${user.wins}`,
                    inline: true
                },
                {
                    name: '🏅 軍功',
                    value: `${user.military}`,
                    inline: true
                }
            );

        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ランキング') {

        const ranking = Object.entries(data)
            .sort((a, b) =>
                getPower(b[1].level) -
                getPower(a[1].level)
            )
            .slice(0, 10);

        let text = '';

        for (let i = 0; i < ranking.length; i++) {

            const [id, user] = ranking[i];

            let memberName = `ID:${id}`;

            try {
                const fetched =
                    await client.users.fetch(id);
                memberName = fetched.username;
            } catch {}

            text +=
                `${i + 1}位 ${memberName} ` +
                `⚔️${getPower(user.level)}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 戦闘力ランキング TOP10')
            .setDescription(text || 'データなし');

        await interaction.reply({
            embeds: [embed]
        });
    }
});

client.login(TOKEN);
