const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ceza')
    .setDescription('Kullaniciya ceza uygular.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub
      .setName('ban')
      .setDescription('Kullaniciya sunucu yasagi uygular.')
      .addUserOption(o => o.setName('uye').setDescription('Hedef uye').setRequired(true))
      .addStringOption(o => o.setName('sebep').setDescription('Ceza sebebi').setRequired(true))
      .addStringOption(o => o.setName('kanit').setDescription('Kanit linki (ekran goruntusu vb.)').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('kick')
      .setDescription('Kullaniciy sunucudan atar.')
      .addUserOption(o => o.setName('uye').setDescription('Hedef uye').setRequired(true))
      .addStringOption(o => o.setName('sebep').setDescription('Ceza sebebi').setRequired(true))
      .addStringOption(o => o.setName('kanit').setDescription('Kanit linki').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('sustur')
      .setDescription('Kullaniciy belirli sure susturur (Timeout).')
      .addUserOption(o => o.setName('uye').setDescription('Hedef uye').setRequired(true))
      .addIntegerOption(o => o.setName('dakika').setDescription('Susturma suresi (dakika, max 40320)').setRequired(true).setMinValue(1).setMaxValue(40320))
      .addStringOption(o => o.setName('sebep').setDescription('Ceza sebebi').setRequired(true))
      .addStringOption(o => o.setName('kanit').setDescription('Kanit linki').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('uyar')
      .setDescription('Kullaniciya yazili uyari gonderir.')
      .addUserOption(o => o.setName('uye').setDescription('Hedef uye').setRequired(true))
      .addStringOption(o => o.setName('sebep').setDescription('Uyari sebebi').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getMember('uye');
    const sebep = interaction.options.getString('sebep');
    const kanit = interaction.options.getString('kanit') || null;

    if (!target) {
      return interaction.reply({ content: 'Hedef uye bulunamadi.', ephemeral: true });
    }

    // Bot hiyerarsisi kontrolu — botun rolu hedeften ustte olmali
    const botMember = interaction.guild.members.me;
    if (target.roles.highest.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `❌ Bu işlemi yapamam — **${target.user.tag}** kullanıcısının rolü benim rolümden üstte veya eşit.\n📌 Çözüm: Sunucu ayarlarında **Lutheus Guard** rolünü hedef kullanıcının rolünün **üstüne** taşıyın.`,
        ephemeral: true
      });
    }

    // Yetkili hiyerarsisi kontrolu
    if (target.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: '❌ Bu kullanıcıya ceza veremezsiniz — rolünüz hedefin rolünden düşük veya eşit.', ephemeral: true });
    }

    const cezaId = `C-${Date.now().toString(36).toUpperCase()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setColor(sub === 'uyar' ? 0xf59e0b : 0xef4444)
      .setTitle(`🔨 Ceza Uygulandı | ${sub.toUpperCase()}`)
      .setThumbnail(target.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: 'Kullanıcı', value: `${target} (${target.user.id})`, inline: true },
        { name: 'Yetkili', value: `${interaction.user}`, inline: true },
        { name: 'Ceza ID', value: `\`${cezaId}\``, inline: true },
        { name: 'Sebep', value: sebep, inline: false },
        { name: 'Tarih', value: `<t:${timestamp}:F>`, inline: true },
      );

    if (kanit) embed.addFields({ name: 'Kanıt', value: kanit, inline: false });
    if (sub === 'sustur') {
      const dakika = interaction.options.getInteger('dakika');
      embed.addFields({ name: 'Süre', value: `${dakika} dakika`, inline: true });
    }

    try {
      if (sub === 'ban') await target.ban({ reason: `[${cezaId}] ${sebep}` });
      else if (sub === 'kick') await target.kick(`[${cezaId}] ${sebep}`);
      else if (sub === 'sustur') {
        const dakika = interaction.options.getInteger('dakika');
        await target.timeout(dakika * 60 * 1000, `[${cezaId}] ${sebep}`);
      } else if (sub === 'uyar') {
        await target.send({ embeds: [
          new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle('⚠️ Uyarı Aldınız')
            .setDescription(`**${interaction.guild.name}** sunucusunda uyarı aldınız.\n\n**Sebep:** ${sebep}\n**Yetkili:** ${interaction.user.tag}`)
            .setTimestamp()
        ]}).catch(() => null);
      }

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      if (err.code === 50013 || err.message.includes('Missing Permissions')) {
        await interaction.reply({ content: `❌ Bu işlemi yapamam — yetkim yetersiz (Missing Permissions).\n📌 Çözüm: Sunucu ayarlarında **Lutheus Guard** rolünü hedef kullanıcının rolünün **üstüne** taşıyın veya yetkilerimi kontrol edin.`, ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ content: `❌ İşlem başarısız: ${err.message}`, ephemeral: true }).catch(() => null);
      }
    }
  }
};
