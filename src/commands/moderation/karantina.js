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

    // Yetkili hiyerarsisi kontrolu
    if (target.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.editReply({ content: '❌ Bu kullanıcıya karantina uygulayamazsınız — rolünüz hedefin rolünden düşük veya eşit.' });
    }

    // Bot hiyerarşisi kontrolü
    const botMember = interaction.guild.members.me;
    if (target.roles.highest.position >= botMember.roles.highest.position) {
      return interaction.editReply({
        content: `❌ Bu işlemi yapamam — **${target.user.tag}** kullanıcısının rolü benim rolümden üstte veya eşit.\n📌 Çözüm: Sunucu ayarlarında **Lutheus Guard** rolünü hedef kullanıcının rolünün **üstüne** taşıyın.`
      });
    }

    if (sub === 'uygula') {
      const sebep = interaction.options.getString('sebep');
      try {
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
      } catch (err) {
        if (err.code === 50013 || err.message.includes('Missing Permissions')) {
          await interaction.editReply({ content: `❌ İşlem başarısız: Yetkim yetersiz (Missing Permissions).\n📌 Çözüm: Botun rolünü hedef kullanıcının ve Karantina rolünün üstüne taşıyın.` });
        } else {
          await interaction.editReply({ content: `❌ İşlem başarısız: ${err.message}` });
        }
      }
    } else {
      try {
        await target.roles.remove(karRole, 'Karantina kaldırıldı');
        await interaction.editReply({ content: `✅ ${target} karantinadan çıkarıldı.` });
      } catch (err) {
        if (err.code === 50013 || err.message.includes('Missing Permissions')) {
          await interaction.editReply({ content: `❌ İşlem başarısız: Yetkim yetersiz (Missing Permissions).\n📌 Çözüm: Botun rolünü hedef kullanıcının ve Karantina rolünün üstüne taşıyın.` });
        } else {
          await interaction.editReply({ content: `❌ İşlem başarısız: ${err.message}` });
        }
      }
    }
  }
};
