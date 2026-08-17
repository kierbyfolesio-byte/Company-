import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getColor } from '../../../config/bot.js';
import { createEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';

export default {
    /**
     * Executes the dashboard menu render.
     * Note: The interaction has already been deferred ephemerally in the parent command.
     */
    async execute(interaction, config, client) {
        try {
            const guildConfig = (await getGuildConfig(client, interaction.guildId)) || {};
            
            const embed = this.buildDashboardEmbed(guildConfig);
            const components = this.buildDashboardComponents(guildConfig);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed],
                components: components,
            });
        } catch (error) {
            logger.error('Error executing ticket dashboard module', {
                error: error.message,
                guildId: interaction.guildId,
            });

            await replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'Failed to display the ticket dashboard.',
            });
        }
    },

    /**
     * Constructs the status embed for the dashboard.
     */
    buildDashboardEmbed(guildConfig) {
        const panels = Array.isArray(guildConfig.ticketPanels) ? guildConfig.ticketPanels : [];
        const category = guildConfig.ticketCategoryId ? `<#${guildConfig.ticketCategoryId}>` : '*Not Set*';
        const closedCategory = guildConfig.ticketClosedCategoryId ? `<#${guildConfig.ticketClosedCategoryId}>` : '*Not Set*';
        const staffRole = guildConfig.ticketStaffRoleId ? `<@&${guildConfig.ticketStaffRoleId}>` : '*Not Set*';
        const maxTickets = guildConfig.maxTicketsPerUser === 0 ? 'Unlimited' : (guildConfig.maxTicketsPerUser ?? 3);
        const dmOnClose = guildConfig.dmOnClose !== false ? ' Enabled' : ' Disabled';

        // Panel breakdown text
        let panelListText = 'No panels configured yet. Use `/ticket setup` to create one.';
        if (panels.length > 0) {
            panelListText = panels
                .map((p, index) => `**${index + 1}.** Channel: <#${p.panelChannelId}> | Label: \`${p.buttonLabel}\``)
                .slice(0, 5)
                .join('\n');

            if (panels.length > 5) {
                panelListText += `\n*...and ${panels.length - 5} more panel(s).*`;
            }
        }

        return createEmbed({
            title: '⚙️ Ticket System Control Panel',
            description: 'Manage and monitor your server\'s active support ticket configuration.',
            color: getColor('info'),
            fields: [
                { name: '📊 Active Panels', value: `${panels.length} panel(s)`, inline: true },
                { name: '🛡️ Staff Role', value: staffRole, inline: true },
                { name: '🎟️ Max Tickets/User', value: `${maxTickets}`, inline: true },
                { name: '📂 Open Category', value: category, inline: true },
                { name: '📁 Closed Category', value: closedCategory, inline: true },
                { name: '📬 DM on Close', value: dmOnClose, inline: true },
                { name: '📌 Configured Ticket Panels', value: panelListText, inline: false },
            ],
        });
    },

    /**
     * Constructs interactive action rows for dashboard management.
     */
    buildDashboardComponents(guildConfig) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_dash_toggle_dm')
                .setLabel('Toggle DM on Close')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✉️'),
            new ButtonBuilder()
                .setCustomId('ticket_dash_clear_panels')
                .setLabel('Clear Registered Panels')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('ticket_dash_refresh')
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄')
        );

        return [row];
    }
};
