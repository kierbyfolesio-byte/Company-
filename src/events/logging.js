import { Events, EmbedBuilder } from 'discord.js';

// ⚙️ DEFAULT FALLBACK CHANNEL ID (Replace with your actual #LOGS channel ID)
const LOG_CHANNEL_ID = '1537767642633469953';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('⚡ Consolidated Carl-Style Logger initialized!');

        // Helper function to fetch log channel safely
        const getLogChannel = async (guild) => {
            if (!guild) return null;
            const targetChannelId = guild.client.logChannels?.get(guild.id) || LOG_CHANNEL_ID;
            if (!targetChannelId || targetChannelId === '1234567890123456789') return null;

            return guild.channels.cache.get(targetChannelId) 
                || await guild.channels.fetch(targetChannelId).catch(() => null);
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
        // 3. MEMBER JOINS
        // ===================================================
        client.on(Events.GuildMemberAdd, async (member) => {
            const logChannel = await getLogChannel(member.guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: member.user.tag, 
                    iconURL: member.user.displayAvatarURL({ dynamic: true }) 
                })
                .setColor(0x2ECC71) // Green
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setDescription(`**Member joined**\n\n${member} (${member.user.tag})`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        });

        // ===================================================
        // 4. MEMBER LEAVES
        // ===================================================
        client.on(Events.GuildMemberRemove, async (member) => {
            const logChannel = await getLogChannel(member.guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: member.user.tag, 
                    iconURL: member.user.displayAvatarURL({ dynamic: true }) 
                })
                .setColor(0xED4245) // Red
                .setDescription(`**Member left**\n\n${member.user.tag}`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        });

        // ===================================================
        // 5. BANS
        // ===================================================
        client.on(Events.GuildBanAdd, async (ban) => {
            const logChannel = await getLogChannel(ban.guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: ban.user.tag, 
                    iconURL: ban.user.displayAvatarURL({ dynamic: true }) 
                })
                .setColor(0xED4245) // Red
                .setDescription(`**Member banned**\n\n${ban.user.tag}`)
                .setFooter({ text: `ID: ${ban.user.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        });

        // ===================================================
        // 6. UNBANS
        // ===================================================
        client.on(Events.GuildBanRemove, async (ban) => {
            const logChannel = await getLogChannel(ban.guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: ban.user.tag, 
                    iconURL: ban.user.displayAvatarURL({ dynamic: true }) 
                })
                .setColor(0x2ECC71) // Green
                .setDescription(`**Member unbanned**\n\n${ban.user.tag}`)
                .setFooter({ text: `ID: ${ban.user.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        });

        // ===================================================
        // 7. MEMBER ROLES, NICKNAMES & SERVER AVATARS
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
                    .setColor(0x2ECC71)
                    .setDescription(`**Role added**\n\n<@&${role.id}>`)
                    .setFooter({ text: `ID: ${newMember.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => {});
            });

            // Server Nickname Update
            if (oldMember.nickname !== newMember.nickname) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: newMember.user.tag, 
                        iconURL: newMember.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setColor(0x3498DB)
                    .setDescription(
                        `**Nickname update**\n\n` +
                        `**Before:** ${oldMember.nickname || oldMember.user.username}\n` +
                        `**After:** ${newMember.nickname || newMember.user.username}`
                    )
                    .setFooter({ text: `ID: ${newMember.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => {});
            }

            // Server Avatar Update
            if (oldMember.avatar !== newMember.avatar) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: newMember.user.tag, 
                        iconURL: newMember.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setColor(0x3498DB)
                    .setThumbnail(newMember.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setDescription(`**Server avatar update**\n\n${newMember}`)
                    .setFooter({ text: `ID: ${newMember.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => {});
            }
        });

        // ===================================================
        // 8. GLOBAL USERNAME & GLOBAL AVATAR UPDATES
        // ===================================================
        client.on(Events.UserUpdate, async (oldUser, newUser) => {
            const guild = newUser.client.guilds.cache.first();
            const logChannel = await getLogChannel(guild);
            if (!logChannel) return;

            // Global Name / Display Name Update
            if (oldUser.username !== newUser.username || oldUser.displayName !== newUser.displayName) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: newUser.tag, 
                        iconURL: newUser.displayAvatarURL({ dynamic: true }) 
                    })
                    .setColor(0x3498DB)
                    .setDescription(
                        `**Name update**\n\n` +
                        `**Before:** ${oldUser.tag} (${oldUser.displayName})\n` +
                        `**After:** ${newUser.tag} (${newUser.displayName})`
                    )
                    .setFooter({ text: `ID: ${newUser.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => {});
            }

            // Global Avatar Update
            if (oldUser.avatar !== newUser.avatar) {
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
            }
        });
    },
};
