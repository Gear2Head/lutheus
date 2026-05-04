const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botun gecikme suresini gosterir.'),
    async execute(interaction) {
        await interaction.reply(`🏓 Pong! Gecikme: ${interaction.client.ws.ping}ms`);
    },
};
