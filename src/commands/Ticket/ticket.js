import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Manages the server's ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription(
                    "Sets up a ticket creation panel in a specified channel.",
                )
                .addChannelOption((option) =>
                    option
                        .setName("panel_channel")
                        .setDescription(
                            "The channel where the ticket panel will be sent.",
                        )
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("panel_message")
                        .setDescription(
                            "The main message/description for the ticket panel.",
                        )
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("button_label")
                        .setDescription(
                            "The label for the ticket creation button (default: Create Ticket)",
                        )
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription(
                            "The category where new tickets will be created (optional).",
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName("closed_category")
                        .setDescription(
                            "The category where closed tickets will be moved (optional).",
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName("staff_role")
                        .setDescription(
                            "The role that can access tickets (optional).",
                        )
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName("max_tickets_per_user")
                        .setDescription("Max tickets per normal user (0 = unlimited, default: 3)")
                        .setMinValue(0)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName("dm_on_close")
                        .setDescription("Send DM to user when their ticket is closed (default: true)")
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Open the interactive ticket system dashboard"),
        ),
    category: "ticket",

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            logger.warn('Ticket command permission denied', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket'
            });
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the `Manage Channels` permission for this action.' });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "dashboard") {
            return ticketConfig.execute(interaction, config, client);
        }

        if (subcommand === "setup") {
            const panelChannel = interaction.options.getChannel("panel_channel");
            const categoryChannel = interaction.options.getChannel("category");
            const closedCategoryChannel = interaction.options.getChannel("closed_category");
            const staffRole = interaction.options.getRole("staff_role");
            const panelMessage = interaction.options.getString("panel_message") || "Click the button below to create a support ticket.";
            const buttonLabel = interaction.options.getString("button_label") || "Create Ticket";
            const rawMaxTickets = interaction.options.getInteger("max_tickets_per_user");
            const maxTicketsPerUser = rawMaxTickets !== null ? rawMaxTickets : 3;
            const dmOnClose = interaction.options.getBoolean("dm_on_close") !== false;

            const setupEmbed = createEmbed({ 
                title: "Support Tickets", 
                description: panelMessage,
                color: getColor('info')
            });

            const ticketButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("create_ticket")
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji("📩"),
            );

            try {
                const sentPanel = await panelChannel.send({
                    embeds: [setupEmbed],
                    components: [ticketButton],
                });

                if (client.db && interaction.guildId) {
                    const currentConfig = (await getGuildConfig(client, interaction.guildId)) || {};
                    
                    // Support multiple panel setups across channels
                    if (!Array.isArray(currentConfig.ticketPanels)) {
                        currentConfig.ticketPanels = [];
                    }

                    const panelData = {
                        panelChannelId: panelChannel.id,
                        panelMessageId: sentPanel.id,
                        categoryId: categoryChannel?.id || null,
                        closedCategoryId: closedCategoryChannel?.id || null,
                        staffRoleId: staffRole?.id || null,
                        panelMessage,
                        buttonLabel,
                        maxTicketsPerUser,
                        dmOnClose
                    };

                    currentConfig.ticketPanels.push(panelData);

                    // Fallbacks for legacy single-panel handlers
                    currentConfig.ticketCategoryId = categoryChannel?.id || currentConfig.ticketCategoryId || null;
                    currentConfig.ticketClosedCategoryId = closedCategoryChannel?.id || currentConfig.ticketClosedCategoryId || null;
                    currentConfig.ticketStaffRoleId = staffRole?.id || currentConfig.ticketStaffRoleId || null;
                    currentConfig.maxTicketsPerUser = maxTicketsPerUser;
                    currentConfig.dmOnClose = dmOnClose;

                    await setGuildConfig(client, interaction.guildId, currentConfig);
                }

                const maxDisplay = maxTicketsPerUser === 0 ? "Unlimited" : maxTicketsPerUser;
                let successMessage = `Ticket panel deployed in ${panelChannel}.\n\n`;
                successMessage += `**Max User Tickets:** ${maxDisplay} *(Moderators have no limit)*\n`;
                successMessage += `**DM on Close:** ${dmOnClose ? 'Enabled' : 'Disabled'}`;

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed("Ticket Panel Created", successMessage)],
                });

            } catch (error) {
                logger.error('Ticket setup error', { error: error.message, guildId: interaction.guildId });
                await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: 'Could not send ticket panel. Check bot channel permissions.' 
                });
            }
        }
    }
};

