const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sicil')
    .setDescription('Bir kullanicinin ceza gecmisini ve notlarini goruntular.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('uye').setDescription('Sorgulanan kullanici').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('uye');
    await interaction.deferReply({ ephemeral: true });

    // Firebase entegrasyonu hazir oldugunda buradan cekecek
    // Simdilik Discord Audit Log'dan son 10 islemi gosterir
    const guild = interaction.guild;
    let auditEntries = [];
    try {
      const logs = await guild.fetchAuditLogs({ limit: 50 });
      auditEntries = logs.entries
        .filter(e => e.target?.id === target.id && [22, 23, 24, 25].includes(e.action))
        .first(10);
    } catch {
      // Audit log yetkisi yoksa devam et
    }

    const embed = new EmbedBuilder()
      .setColor(0x8a5cf5)
      .setTitle(`📋 Sicil | ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: 'Kullanıcı ID', value: target.id, inline: true },
        { name: 'Hesap Açılışı', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: 'Kaynak: Discord Audit Log • Firebase entegrasyonuyla genisleyecek' })
      .setTimestamp();

    if (auditEntries.length === 0) {
      embed.setDescription('Bu kullanıcıya ait kayıtlı ceza bulunamadı.');
    } else {
      const actionNames = { 22: 'KICK', 23: 'BAN', 24: 'BAN KALDIR', 25: 'TIMEOUT' };
      const lines = auditEntries.map(e => {
        const t = Math.floor(e.createdTimestamp / 1000);
        return `**${actionNames[e.action] || e.action}** — <t:${t}:R> — ${e.reason || 'Sebep yok'}`;
      });
      embed.setDescription(lines.join('\n'));
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
