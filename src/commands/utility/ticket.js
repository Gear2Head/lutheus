const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Destek ticket sistemi.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('panel')
      .setDescription('Ticket acma butonunu iceren paneli gonderir.')
      .addStringOption(o => o.setName('baslik').setDescription('Panel basligi').setRequired(false))
      .addStringOption(o => o.setName('aciklama').setDescription('Panel aciklamasi').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('kapat')
      .setDescription('Bu ticket kanalini kapatir (transkript kaydeder).')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      const baslik = interaction.options.getString('baslik') || '🎫 Destek Talebi';
      const aciklama = interaction.options.getString('aciklama') || 'Bir sorun yaşıyorsanız aşağıdaki butona tıklayarak destek talebi oluşturabilirsiniz.';

      const embed = new EmbedBuilder()
        .setColor(0x8a5cf5)
        .setTitle(baslik)
        .setDescription(aciklama)
        .setFooter({ text: 'Lutheus Guard • Destek Sistemi' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:olustur')
          .setLabel('📩 Ticket Oluştur')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });

    } else if (sub === 'kapat') {
      const channel = interaction.channel;
      if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: 'Bu komut sadece ticket kanallarında kullanılabilir.', ephemeral: true });
      }

      await interaction.reply({ content: '🔒 Ticket kapatılıyor...' });

      // Kanal transkriptini al
      const messages = await channel.messages.fetch({ limit: 100 });
      const transcript = messages.reverse().map(m =>
        `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '[Embed/Dosya]'}`
      ).join('\n');

      // Log kanalına gonder (varsa)
      const logChannel = interaction.guild.channels.cache.find(c => c.name === 'ticket-log' || c.name === 'log');
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x6b7280)
          .setTitle('📁 Ticket Kapatıldı')
          .addFields(
            { name: 'Kanal', value: channel.name, inline: true },
            { name: 'Kapatan', value: interaction.user.tag, inline: true },
            { name: 'Mesaj Sayısı', value: String(messages.size), inline: true }
          ).setTimestamp();
        await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
      }

      await channel.delete('Ticket kapatıldı').catch(() => null);
    }
  }
};
