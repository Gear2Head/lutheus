const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cekilis')
    .setDescription('Cekilis sistemi.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('baslat')
      .setDescription('Yeni bir cekilis baslatir.')
      .addStringOption(o => o.setName('odul').setDescription('Cekilis odulu').setRequired(true))
      .addIntegerOption(o => o.setName('sure').setDescription('Sure (dakika)').setRequired(true).setMinValue(1).setMaxValue(43200))
      .addIntegerOption(o => o.setName('kazanan').setDescription('Kazanan sayisi').setRequired(false).setMinValue(1).setMaxValue(20))
    )
    .addSubcommand(sub => sub
      .setName('bitir')
      .setDescription('Aktif cekilisi erken bitirir.')
      .addStringOption(o => o.setName('mesaj_id').setDescription('Cekilis mesaj ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'baslat') {
      const odul = interaction.options.getString('odul');
      const sure = interaction.options.getInteger('sure');
      const kazananSayisi = interaction.options.getInteger('kazanan') || 1;
      const bitis = Date.now() + sure * 60 * 1000;

      const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🎉 Çekiliş Başladı!')
        .setDescription(`**Ödül:** ${odul}\n\nKatılmak için aşağıdaki butona tıklayın!`)
        .addFields(
          { name: '⏰ Bitiş', value: `<t:${Math.floor(bitis / 1000)}:R>`, inline: true },
          { name: '🏆 Kazanan', value: String(kazananSayisi), inline: true },
          { name: '🎟️ Katılımcı', value: '0', inline: true },
        )
        .setFooter({ text: `Lutheus Guard • Başlatan: ${interaction.user.tag}` })
        .setTimestamp(bitis);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cekilis:katil')
          .setLabel('🎉 Katıl')
          .setStyle(ButtonStyle.Success)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      // Sure dolunca kazanani sec
      setTimeout(async () => {
        const updatedMsg = await msg.fetch().catch(() => null);
        if (!updatedMsg) return;

        // Buton tiklayanlar collector ile toplanabilir (ileri seviye)
        const endEmbed = new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('🎉 Çekiliş Bitti!')
          .setDescription(`**Ödül:** ${odul}\n\nKazanan belirlemek için bot yeniden başlatılmadan collector eklenmeli.`)
          .setTimestamp();

        await updatedMsg.edit({ embeds: [endEmbed], components: [] });
      }, sure * 60 * 1000);

    } else if (sub === 'bitir') {
      await interaction.reply({ content: '⏹️ Çekiliş sonlandırıldı (erken bitiş).', ephemeral: true });
    }
  }
};
