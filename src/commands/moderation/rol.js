const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rol')
    .setDescription('Rol yonetim komutlari.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub => sub
      .setName('ver')
      .setDescription('Kullaniciya rol verir.')
      .addUserOption(o => o.setName('uye').setDescription('Hedef uye').setRequired(true))
      .addRoleOption(o => o.setName('rol').setDescription('Verilecek rol').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('al')
      .setDescription('Kullanicidan rol alir.')
      .addUserOption(o => o.setName('uye').setDescription('Hedef uye').setRequired(true))
      .addRoleOption(o => o.setName('rol').setDescription('Alinacak rol').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('liste')
      .setDescription('Sunucudaki rolleri listeler.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ver' || sub === 'al') {
      const target = interaction.options.getMember('uye');
      const rol = interaction.options.getRole('rol');

      if (!target) return interaction.reply({ content: 'Uye bulunamadi.', ephemeral: true });
      if (rol.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({ content: 'Bu rol botun en yüksek rolünden daha yüksek konumda, işlem yapılamaz.', ephemeral: true });
      }

      if (sub === 'ver') {
        try {
          await target.roles.add(rol);
          await interaction.reply({ embeds: [
            new EmbedBuilder().setColor(0x22c55e)
              .setDescription(`✅ ${target} kullanıcısına **${rol.name}** rolü verildi.`)
          ]});
        } catch(err) {
          if (err.code === 50013 || err.message.includes('Missing Permissions')) {
            return interaction.reply({ content: `❌ İşlem başarısız: Yetkim yetersiz (Missing Permissions).\n📌 Çözüm: Botun rolünü verilecek rolden daha üste taşıyın.`, ephemeral: true });
          }
          return interaction.reply({ content: `❌ İşlem başarısız: ${err.message}`, ephemeral: true });
        }
      } else {
        try {
          await target.roles.remove(rol);
          await interaction.reply({ embeds: [
            new EmbedBuilder().setColor(0xef4444)
              .setDescription(`✅ ${target} kullanıcısından **${rol.name}** rolü alındı.`)
          ]});
        } catch(err) {
          if (err.code === 50013 || err.message.includes('Missing Permissions')) {
            return interaction.reply({ content: `❌ İşlem başarısız: Yetkim yetersiz (Missing Permissions).\n📌 Çözüm: Botun rolünü alınacak rolden daha üste taşıyın.`, ephemeral: true });
          }
          return interaction.reply({ content: `❌ İşlem başarısız: ${err.message}`, ephemeral: true });
        }
      }
    } else if (sub === 'liste') {
      const roles = interaction.guild.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => `${r} — ${r.members.size} üye`)
        .slice(0, 25);

      const embed = new EmbedBuilder()
        .setColor(0x8a5cf5)
        .setTitle('🏷️ Sunucu Rolleri')
        .setDescription(roles.join('\n') || 'Rol bulunamadı.')
        .setFooter({ text: `Toplam ${interaction.guild.roles.cache.size - 1} rol` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
