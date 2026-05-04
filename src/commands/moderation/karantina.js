const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('karantina')
    .setDescription('Suphelui kullaniciyi tum kanallardan izole eder.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('uygula')
      .setDescription('Kullaniciya karantina uygular.')
      .addUserOption(o => o.setName('uye').setDescription('Hedef uye').setRequired(true))
      .addStringOption(o => o.setName('sebep').setDescription('Karantina sebebi').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('kaldir')
      .setDescription('Kullanicinin karantinasini kaldirir.')
      .addUserOption(o => o.setName('uye').setDescription('Karantinadan cikacak uye').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getMember('uye');
    if (!target) return interaction.reply({ content: 'Uye bulunamadi.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;

    // "Karantina" rolunu bul veya olustur
    let karRole = guild.roles.cache.find(r => r.name === 'Karantina');
    if (!karRole) {
      karRole = await guild.roles.create({
        name: 'Karantina',
        color: 0x6b7280,
        reason: 'Lutheus Guard - Karantina sistemi',
        permissions: []
      });
      // Tum kanallardan yaz/goruntule yetkisini kapat
      await Promise.all(guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
        .map(c => c.permissionOverwrites.edit(karRole, { SendMessages: false, Speak: false, AddReactions: false }))
      );
    }

    if (sub === 'uygula') {
      const sebep = interaction.options.getString('sebep');
      await target.roles.add(karRole, sebep);
      const embed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('🔒 Karantina Uygulandı')
        .addFields(
          { name: 'Kullanıcı', value: `${target}`, inline: true },
          { name: 'Yetkili', value: `${interaction.user}`, inline: true },
          { name: 'Sebep', value: sebep, inline: false }
        ).setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else {
      await target.roles.remove(karRole, 'Karantina kaldırıldı');
      await interaction.editReply({ content: `✅ ${target} karantinadan çıkarıldı.` });
    }
  }
};
