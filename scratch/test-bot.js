const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('DISCORD_BOT_TOKEN is missing in .env!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    const channelId = '1511004172084969562';
    const userId = '758769576778661989';
    
    try {
        // 1. Send test messages to channel
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            console.log(`Sending messages to channel #${channel.name}...`);
            await channel.send('Lutheus Test Mesajı 🧪');
            
            const embed = new EmbedBuilder()
                .setTitle('Lutheus Ceza Rapor Sistemi')
                .setDescription('Bu kanal başarıyla ayarlandı ve aktif hale getirildi! 🚀')
                .setColor(0x9d7bfe)
                .setTimestamp();
            await channel.send({ embeds: [embed] });
            console.log('Channel messages sent successfully!');
        } else {
            console.error('Channel not found or not text-based');
        }
    } catch (err) {
        console.error('Error sending channel message:', err);
    }
    
    try {
        // 2. Send test DM to user
        console.log(`Sending DM to user ${userId}...`);
        const user = await client.users.fetch(userId);
        if (user) {
            await user.send('Lutheus Ceza Rapor Sistemi Test DM: DM gönderme sistemi başarıyla çalışıyor! 💬');
            console.log('DM sent successfully!');
        } else {
            console.error('User not found');
        }
    } catch (err) {
        console.error('Error sending DM:', err);
    }
    
    client.destroy();
    process.exit(0);
});

client.login(token);
