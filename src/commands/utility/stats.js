const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Sunucu istatistiklerini ve bot durumunu gosterir.'),

  async execute(interaction) {
    await interaction.deferReply();
    const guild = interaction.guild;
    await guild.members.fetch().catch(() => null);

    const total = guild.memberCount;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = total - bots;
    const online = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const channels = guild.channels.cache.size;
    const roles = guild.roles.cache.size - 1; // @everyone haric
    const boostLevel = guild.premiumTier;
    const boosts = guild.premiumSubscriptionCount;
    const createdAt = Math.floor(guild.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x8a5cf5)
      .setTitle(`📊 ${guild.name} — Sunucu İstatistikleri`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: '👥 Toplam Üye', value: String(total), inline: true },
        { name: '🧑 İnsan', value: String(humans), inline: true },
        { name: '🤖 Bot', value: String(bots), inline: true },
        { name: '🟢 Online', value: online > 0 ? String(online) : 'Bilinmiyor', inline: true },
        { name: '📢 Kanal', value: String(channels), inline: true },
        { name: '🏷️ Rol', value: String(roles), inline: true },
        { name: '💎 Boost Seviyesi', value: `Tier ${boostLevel} (${boosts} boost)`, inline: true },
        { name: '📅 Oluşturulma', value: `<t:${createdAt}:R>`, inline: true },
        { name: '🆔 Sunucu ID', value: guild.id, inline: true },
      )
      .setFooter({ text: `Lutheus Guard • ${new Date().toLocaleString('tr-TR')}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
