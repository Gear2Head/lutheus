const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                const reply = { content: 'Komut calistirilirken bir hata olustu!', ephemeral: true };
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp(reply).catch(() => null);
                } else {
                    await interaction.reply(reply).catch(() => null);
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId === 'ticket:olustur') {
                try {
                    const ticketName = `ticket-${interaction.user.username.toLowerCase()}`.replace(/[^a-z0-9\-]/g, '');
                    
                    const existingChannel = interaction.guild.channels.cache.find(c => c.name === ticketName);
                    if (existingChannel) {
                        return interaction.reply({ content: `Zaten bir destek talebiniz bulunuyor: <#${existingChannel.id}>`, ephemeral: true });
                    }

                    const channel = await interaction.guild.channels.create({
                        name: ticketName,
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionFlagsBits.ViewChannel],
                            },
                            {
                                id: interaction.user.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                            },
                            {
                                id: interaction.client.user.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
                            }
                        ],
                    });

                    await interaction.reply({ content: `Destek talebiniz oluşturuldu: <#${channel.id}>`, ephemeral: true });

                    const ticketEmbed = new EmbedBuilder()
                        .setTitle('🎫 Destek Talebi')
                        .setDescription(`Merhaba <@${interaction.user.id}>, yetkililer en kısa sürede seninle ilgilenecektir.\n\nSorununu detaylıca açıklayabilirsin. Ticket'ı kapatmak için \`/ticket kapat\` komutunu kullanabilirsin.`)
                        .setColor(0x8a5cf5)
                        .setTimestamp();
                    
                    await channel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed] });

                } catch (error) {
                    console.error("Ticket error:", error);
                    await interaction.reply({ content: 'Ticket oluşturulurken hata meydana geldi.', ephemeral: true }).catch(() => null);
                }
            } else if (interaction.customId === 'cekilis:katil') {
                try {
                    await interaction.reply({ content: '🎉 Çekilişe başarıyla katıldın!', ephemeral: true });
                } catch (error) {
                    console.error("Giveaway error:", error);
                    await interaction.reply({ content: 'Çekilişe katılırken hata oluştu.', ephemeral: true }).catch(() => null);
                }
            }
        }
    },
};
