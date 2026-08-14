import { Events, EmbedBuilder } from 'discord.js';

// ⚙️ REPLACE WITH YOUR ACTUAL LOG CHANNEL ID
const LOG_CHANNEL_ID = '1234567890123456789';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('⚡ Consolidated Logger initialized!');

        // Helper function to get log channel safely
        const getLogChannel = async (guild) => {
            if (!guild) return null;
            return guild.channels.cache.get(LOG_CHANNEL_ID) 
                || await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        };

        // ===================================================
        // 1. DELETED MESSAGES
        // ===================================================
        client.on(Events.MessageDelete, async (message) => {
            if (!message?.guild || message.partial || message.author?.bot) return;

            const logChannel = await getLogChannel(message.guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: message.author.tag, 
                    iconURL: message.author.displayAvatarURL({ dynamic: true }) 
                })
                .setColor(0xED4245) // Red
                .setDescription(
                    `**Message deleted in ${message.channel}**\n\n` +
                    `${message.content || '*[Message contained no text or only attachments]*'}\n\n` +
                    `Message ID: ${message.id}`
                )
                .setFooter({ text: `ID: ${message.author.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        });

        // ===================================================
        // 2. EDITED MESSAGES
        // ===================================================
        client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
            if (!oldMessage?.guild || oldMessage.partial || oldMessage.author?.bot) return;
            if (oldMessage.content === newMessage.content) return;

            const logChannel = await getLogChannel(oldMessage.guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: oldMessage.author.tag, 
                    iconURL: oldMessage.author.displayAvatarURL({ dynamic: true }) 
                })
                .setColor(0x3498DB) // Blue
                .setDescription(
                    `**Message edited in ${oldMessage.channel}** [Jump to message](${newMessage.url})\n\n` +
                    `**Before:**\n${oldMessage.content || '*[None]*'}\n\n` +
                    `**After:**\n${newMessage.content || '*[None]*'}\n\n` +
                    `Message ID: ${newMessage.id}`
                )
                .setFooter({ text: `ID: ${oldMessage.author.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        });

        // ===================================================
        // 3. ROLES & SERVER AVATAR UPDATES
        // ===================================================
        client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
            if (!oldMember?.guild) return;

            const logChannel = await getLogChannel(oldMember.guild);
            if (!logChannel) return;

            // Role Removed
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
            removedRoles.forEach(async (role) => {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: newMember.user.tag, 
                        iconURL: newMember.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setColor(0x3498DB)
                    .setDescription(`**Role removed**\n\n<@&${role.id}>`)
                    .setFooter({ text: `ID: ${newMember.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => {});
            });

            // Role Added
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            addedRoles.forEach(async (role) => {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: newMember.user.tag, 
                        iconURL: newMember.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setColor(0x2ECC71) // Green
                    .setDescription(`**Role added**\n\n<@&${role.id}>`)
                    .setFooter({ text: `ID: ${newMember.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => {});
            });

            // Server Avatar Update
            if (oldMember.avatar !== newMember.avatar) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: newMember.user.tag, 
                        iconURL: newMember.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setColor(0x3498DB)
                    .setThumbnail(newMember.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setDescription(`**Avatar update**\n\n${newMember}`)
                    .setFooter({ text: `ID: ${newMember.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => {});
            }
        });

        // ===================================================
        // 4. GLOBAL DISCORD AVATAR UPDATE
        // ===================================================
        client.on(Events.UserUpdate, async (oldUser, newUser) => {
            if (oldUser.avatar === newUser.avatar) return;

            const guild = newUser.client.guilds.cache.first();
            const logChannel = await getLogChannel(guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: newUser.tag, 
                    iconURL: newUser.displayAvatarURL({ dynamic: true }) 
                })
                .setColor(0x3498DB)
                .setThumbnail(newUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setDescription(`**Avatar update**\n\n${newUser}`)
                .setFooter({ text: `ID: ${newUser.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        });
    },
};
