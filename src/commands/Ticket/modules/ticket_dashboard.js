import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} from 'discord.js';
import { getColor } from '../../../config/bot.js';
import { createEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';

export default {
    /**
     * Main entry point when running /ticket dashboard
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
     * Builds dashboard embed with detailed server config
     */
    buildDashboardEmbed(guildConfig, selectedPanelIndex = null) {
        const panels = Array.isArray(guildConfig.ticketPanels) ? guildConfig.ticketPanels : [];
        const category = guildConfig.ticketCategoryId ? `<#${guildConfig.ticketCategoryId}>` : '*Not Set*';
        const closedCategory = guildConfig.ticketClosedCategoryId ? `<#${guildConfig.ticketClosedCategoryId}>` : '*Not Set*';
        const staffRole = guildConfig.ticketStaffRoleId ? `<@&${guildConfig.ticketStaffRoleId}>` : '*Not Set*';
        const maxTickets = guildConfig.maxTicketsPerUser === 0 ? 'Unlimited' : (guildConfig.maxTicketsPerUser ?? 3);
        const dmOnClose = guildConfig.dmOnClose !== false ? 'Enabled' : 'Disabled';

        let panelSummaryText = 'No panels configured yet. Run `/ticket setup` to create one.';
        
        if (panels.length > 0) {
            panelSummaryText = panels.map((p, idx) => {
                const isSelected = selectedPanelIndex === idx ? '▸ ' : '• ';
                return `${isSelected}**Panel #${idx + 1}**: <#${p.panelChannelId}> | Button: \`${p.buttonLabel || 'Create Ticket'}\``;
            }).join('\n');
        }

        const fields = [
            { name: '🛡️ Staff Role', value: staffRole, inline: true },
            { name: '🎟️ Max Tickets/User', value: `${maxTickets}`, inline: true },
            { name: '📬 DM on Close', value: dmOnClose, inline: true },
            { name: '📂 Default Open Category', value: category, inline: true },
            { name: '📁 Default Closed Category', value: closedCategory, inline: true },
            { name: '📊 Active Panels Count', value: `${panels.length} panel(s)`, inline: true },
            { name: '📌 Configured Panels', value: panelSummaryText, inline: false }
        ];

        return createEmbed({
            title: '⚙️ Ticket System Control Panel',
            description: 'Select a panel below to edit or remove it, or use the global action buttons.',
            color: getColor('info'),
            fields
        });
    },

    /**
     * Builds interactive components (Select menus + Buttons)
     */
    buildDashboardComponents(guildConfig) {
        const components = [];
        const panels = Array.isArray(guildConfig.ticketPanels) ? guildConfig.ticketPanels : [];

        // 1. Panel Select Menu (Allows picking which panel to manage)
        if (panels.length > 0) {
            const selectOptions = panels.slice(0, 25).map((panel, idx) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Panel #${idx + 1} - #${panel.panelChannelId}`)
                    .setDescription(`Label: "${panel.buttonLabel || 'Create Ticket'}"`)
                    .setValue(`select_panel_${idx}`)
                    .setEmoji('📋')
            );

            const panelSelectRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_dash_select_panel')
                    .setPlaceholder('Select a panel to edit or delete...')
                    .addOptions(selectOptions)
            );
            components.push(panelSelectRow);
        }

        // 2. Action Buttons
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_dash_toggle_dm')
                .setLabel(`DM on Close: ${guildConfig.dmOnClose !== false ? 'ON' : 'OFF'}`)
                .setStyle(guildConfig.dmOnClose !== false ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('✉️'),
            new ButtonBuilder()
                .setCustomId('ticket_dash_clear_all')
                .setLabel('Clear All Panels')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
                .setDisabled(panels.length === 0),
            new ButtonBuilder()
                .setCustomId('ticket_dash_refresh')
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄')
        );

        components.push(buttonRow);
        return components;
    },

    /**
     * Interaction handler for component actions (Buttons / Select Menus)
     */
    async handleComponentInteraction(interaction, client) {
        const guildConfig = (await getGuildConfig(client, interaction.guildId)) || {};
        const { customId } = interaction;

        if (customId === 'ticket_dash_toggle_dm') {
            guildConfig.dmOnClose = guildConfig.dmOnClose === false;
            await setGuildConfig(client, interaction.guildId, guildConfig);
        } 
        else if (customId === 'ticket_dash_clear_all') {
            guildConfig.ticketPanels = [];
            await setGuildConfig(client, interaction.guildId, guildConfig);
        }

        // Re-render dashboard
        const embed = this.buildDashboardEmbed(guildConfig);
        const components = this.buildDashboardComponents(guildConfig);

        await interaction.update({ embeds: [embed], components });
    }
};
