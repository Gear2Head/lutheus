const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`[Bot] ${client.user.tag} olarak giris yapildi!`);
        client.user.setActivity('Lutheus v4 | /yardim');
    },
};
