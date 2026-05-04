const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temizle')
        .setDescription('Kanalda belirtilen miktarda mesaji siler.')
        .addIntegerOption(option => 
            option.setName('adet')
                .setDescription('Silinecek mesaj sayisi (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        const amount = interaction.options.getInteger('adet');
        await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `${amount} mesaj basariyla silindi.`, ephemeral: true });
    },
};
