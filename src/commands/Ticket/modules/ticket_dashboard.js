import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getColor } from '../../../config/bot.js';
import { createEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';

export default {
    async execute(interaction, config, client) {
        try {
            const guildConfig = (await getGuildConfig(client, interaction.guildId)) || {};
            const embed = this.buildDashboardEmbed(guildConfig);
            const components = this.buildDashboardComponents(guildConfig);

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components });
        } catch (error) {
            logger.error('Error executing ticket dashboard', { error: error.message, guildId: interaction.guildId });
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to display dashboard.' });
        }
    },

    buildDashboardEmbed(guildConfig, selectedIndex = null) {
        const panels = Array.isArray(guildConfig.ticketPanels) ? guildConfig.ticketPanels : [];
        const category = guildConfig.ticketCategoryId ? `<#${guildConfig.ticketCategoryId}>` : '*Not Set*';
        const closedCategory = guildConfig.ticketClosedCategoryId ? `<#${guildConfig.ticketClosedCategoryId}>` : '*Not Set*';
        const staffRole = guildConfig.ticketStaffRoleId ? `<@&${guildConfig.ticketStaffRoleId}>` : '*Not Set*';
        const maxTickets = guildConfig.maxTicketsPerUser === 0 ? 'Unlimited' : (guildConfig.maxTicketsPerUser ?? 3);
        const dmOnClose = guildConfig.dmOnClose !== false ? 'Enabled' : 'Disabled';

        let panelSummary = 'No panels configured yet. Run `/ticket setup` to create one.';
        if (panels.length > 0) {
            panelSummary = panels.map((p, idx) => {
                const marker = selectedIndex === idx ? '➡️ ' : '• ';
                return `${marker}**Panel #${idx + 1}**: <#${p.panelChannelId}> | Button: \`${p.buttonLabel || 'Create Ticket'}\``;
            }).join('\n');
        }

        return createEmbed({
            title: '⚙️ Ticket System Control Panel',
            description: selectedIndex !== null ? `**Managing Panel #${selectedIndex + 1}**` : 'Select a panel below to edit or delete it.',
            color: getColor('info'),
            fields: [
                { name: '🛡️ Staff Role', value: staffRole, inline: true },
                { name: '🎟️ Max Tickets/User', value: `${maxTickets}`, inline: true },
                { name: '📬 DM on Close', value: dmOnClose, inline: true },
                { name: '📂 Open Category', value: category, inline: true },
                { name: '📁 Closed Category', value: closedCategory, inline: true },
                { name: '📊 Active Panels', value: `${panels.length} panel(s)`, inline: true },
                { name: '📌 Configured Panels', value: panelSummary, inline: false }
            ]
        });
    },

    buildDashboardComponents(guildConfig, selectedIndex = null) {
        const components = [];
        const panels = Array.isArray(guildConfig.ticketPanels) ? guildConfig.ticketPanels : [];

        if (panels.length > 0) {
            const options = panels.slice(0, 25).map((panel, idx) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Panel #${idx + 1} - #${panel.panelChannelId}`)
                    .setDescription(`Button: "${panel.buttonLabel || 'Create Ticket'}"`)
                    .setValue(`panel_${idx}`)
                    .setDefault(selectedIndex === idx)
            );

            components.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket_dash_select_panel')
                        .setPlaceholder('Select a panel to manage...')
                        .addOptions(options)
                )
            );
        }

        const buttonRow = new ActionRowBuilder();

        if (selectedIndex !== null && panels[selectedIndex]) {
            buttonRow.addComponents(
                new ButtonBuilder().setCustomId(`ticket_dash_delete_${selectedIndex}`).setLabel(`Delete Panel #${selectedIndex + 1}`).setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
                new ButtonBuilder().setCustomId('ticket_dash_deselect').setLabel('Back to Overview').setStyle(ButtonStyle.Secondary).setEmoji('↩️')
            );
        } else {
            buttonRow.addComponents(
                new ButtonBuilder().setCustomId('ticket_dash_toggle_dm').setLabel(`DM on Close: ${guildConfig.dmOnClose !== false ? 'ON' : 'OFF'}`).setStyle(guildConfig.dmOnClose !== false ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('✉️'),
                new ButtonBuilder().setCustomId('ticket_dash_clear_all').setLabel('Clear All Panels').setStyle(ButtonStyle.Danger).setEmoji('⚠️').setDisabled(panels.length === 0),
                new ButtonBuilder().setCustomId('ticket_dash_refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary).setEmoji('🔄')
            );
        }

        components.push(buttonRow);
        return components;
    },

    async handleInteraction(interaction, client) {
        // INSTANT ACKNOWLEDGMENT TO PREVENT TIMEOUT
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        const guildConfig = (await getGuildConfig(client, interaction.guildId)) || {};
        const { customId, values } = interaction;
        let selectedIndex = null;

        if (customId === 'ticket_dash_select_panel' && values?.[0]) {
            selectedIndex = parseInt(values[0].replace('panel_', ''), 10);
        } else if (customId.startsWith('ticket_dash_delete_')) {
            const idx = parseInt(customId.replace('ticket_dash_delete_', ''), 10);
            if (Array.isArray(guildConfig.ticketPanels) && guildConfig.ticketPanels[idx]) {
                guildConfig.ticketPanels.splice(idx, 1);
                await setGuildConfig(client, interaction.guildId, guildConfig);
            }
        } else if (customId === 'ticket_dash_toggle_dm') {
            guildConfig.dmOnClose = guildConfig.dmOnClose === false;
            await setGuildConfig(client, interaction.guildId, guildConfig);
        } else if (customId === 'ticket_dash_clear_all') {
            guildConfig.ticketPanels = [];
            await setGuildConfig(client, interaction.guildId, guildConfig);
        }

        const embed = this.buildDashboardEmbed(guildConfig, selectedIndex);
        const components = this.buildDashboardComponents(guildConfig, selectedIndex);

        await interaction.editReply({ embeds: [embed], components }).catch(() => {});
    }
};
