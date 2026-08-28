import {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ComponentType,
    ChannelType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

let getColor = (val) => val;
try {
    const config = await import('../../../config/bot.js');
    if (config.getColor) getColor = config.getColor;
} catch {
    try {
        const configAlt = await import('../../config/bot.js');
        if (configAlt.getColor) getColor = configAlt.getColor;
    } catch {
        // Fallback if config isn't found
    }
}

const MAX_FIELDS = 25;
const IDLE_TIMEOUT = 900_000;

const COLOR_PRESETS = [
    { label: 'Primary (Blue)',        value: '#336699', emoji: '🟦' },
    { label: 'Success (Green)',       value: '#57F287', emoji: '🟩' },
    { label: 'Error (Red)',           value: '#ED4245', emoji: '🟥' },
    { label: 'Warning (Yellow)',      value: '#FEE75C', emoji: '🟨' },
    { label: 'Info (Bright Blue)',    value: '#3498DB', emoji: '🔷' },
    { label: 'Blurple (Discord)',     value: '#5865F2', emoji: '🟣' },
    { label: 'Fuchsia',              value: '#EB459E', emoji: '💖' },
    { label: 'Gold',                  value: '#F1C40F', emoji: '🟨' },
    { label: 'White',                 value: '#FFFFFF', emoji: '⬜' },
    { label: 'Dark',                  value: '#202225', emoji: '⬛' },
    { label: 'Custom Hex...',         value: '__custom__', emoji: '🎨' },
];

function isValidUrl(str) {
    if (!str) return false;
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidHex(str) {
    return /^#?[0-9A-Fa-f]{6}$/.test(str);
}

function resolveEmbedColor(value) {
    if (!value) return '#336699';
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
        if (/^[0-9A-Fa-f]{6}$/.test(value)) return `#${value}`;
        try {
            const resolved = getColor(value);
            if (resolved && typeof resolved === 'string') {
                if (/^#[0-9A-Fa-f]{6}$/.test(resolved)) return resolved;
                if (/^[0-9A-Fa-f]{6}$/.test(resolved)) return `#${resolved}`;
            }
            if (typeof resolved === 'number') return resolved;
        } catch {
            // fallback if lookup fails
        }
    }
    return '#336699';
}

function buildPreviewEmbed(state) {
    const embed = new EmbedBuilder();

    if (state.title)       embed.setTitle(state.title.substring(0, 256));
    if (state.description) embed.setDescription(state.description.substring(0, 4096));

    embed.setColor(resolveEmbedColor(state.color));

    if (state.author?.name) {
        const obj = { name: state.author.name.substring(0, 256) };
        if (state.author.iconUrl && isValidUrl(state.author.iconUrl)) obj.iconURL = state.author.iconUrl;
        if (state.author.url   && isValidUrl(state.author.url))      obj.url     = state.author.url;
        embed.setAuthor(obj);
    }

    if (state.footer?.text) {
        const obj = { text: state.footer.text.substring(0, 2048) };
        if (state.footer.iconUrl && isValidUrl(state.footer.iconUrl)) obj.iconURL = state.footer.iconUrl;
        embed.setFooter(obj);
    }

    if (state.thumbnail && isValidUrl(state.thumbnail)) embed.setThumbnail(state.thumbnail);
    if (state.image     && isValidUrl(state.image))     embed.setImage(state.image);

    if (state.timestamp) {
        embed.setTimestamp(new Date());
    } else {
        embed.setTimestamp(null);
    }

    if (Array.isArray(state.fields) && state.fields.length > 0) {
        embed.addFields(state.fields.slice(0, 25));
    }

    if (
        !state.title &&
        !state.description &&
        (!state.fields || state.fields.length === 0) &&
        !state.author?.name
    ) {
        embed.setDescription('*(Empty — use the menu below to add content)*');
    }

    return embed;
}

function buildDashboardEmbed(state) {
    const trunc = (str, n) => (str.length > n ? str.substring(0, n) + '…' : str);

    const lines = [
        `**Title** › ${state.title ? `\`${trunc(state.title, 40)}\`` : '`Not set`'}`,
        `**Description** › ${state.description ? `${state.description.length} character(s)` : '`Not set`'}`,
        `**Color** › ${state.color ? `\`${state.color}\`` : '`Default`'}`,
        `**Author** › ${state.author?.name ? `\`${trunc(state.author.name, 30)}\`` : '`Not set`'}`,
        `**Footer** › ${state.footer?.text ? `\`${trunc(state.footer.text, 30)}\`` : '`Not set`'}`,
        `**Thumbnail** › ${state.thumbnail ? '✅ Set' : '`Not set`'}`,
        `**Image** › ${state.image ? '✅ Set' : '`Not set`'}`,
        `**Timestamp** › ${state.timestamp ? '✅ Enabled' : '`Disabled`'}`,
        `**Fields** › ${state.fields ? state.fields.length : 0} / ${MAX_FIELDS}`,
    ];

    return new EmbedBuilder()
        .setTitle('Embed Builder — Control Panel')
        .setDescription(lines.join('\n'))
        .setColor(resolveEmbedColor('#3498DB'))
        .setFooter({ text: 'The preview above updates live · Closes after 15 min of inactivity' });
}

function buildMainMenu(state) {
    const fieldCount = state.fields ? state.fields.length : 0;

    const primaryRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_main_edit_content')
            .setLabel('Edit Content')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId('eb_main_set_color')
            .setLabel('Set Color')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎨'),
        new ButtonBuilder()
            .setCustomId('eb_main_set_images')
            .setLabel('Set Images')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🖼️'),
        new ButtonBuilder()
            .setCustomId('eb_main_post_embed')
            .setLabel('Post Embed')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📤'),
    );

    const secondaryRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_main_add_field')
            .setLabel(`Add Field (${fieldCount}/${MAX_FIELDS})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('eb_main_edit_field')
            .setLabel('Edit Field')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝')
            .setDisabled(fieldCount === 0),
        new ButtonBuilder()
            .setCustomId('eb_main_remove_field')
            .setLabel('Remove Field')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('➖')
            .setDisabled(fieldCount === 0),
        new ButtonBuilder()
            .setCustomId('eb_main_toggle_timestamp')
            .setLabel(state.timestamp ? 'Disable Timestamp' : 'Enable Timestamp')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🕐'),
    );

    const tertiaryRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_main_reorder_fields')
            .setLabel('Reorder Fields')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↕️')
            .setDisabled(fieldCount < 2),
        new ButtonBuilder()
            .setCustomId('eb_main_json_export')
            .setLabel('JSON / Raw Data')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('eb_main_reset_all')
            .setLabel('Reset Everything')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
    );

    return [primaryRow, secondaryRow, tertiaryRow];
}

async function refreshDashboard(interaction, state) {
    return await InteractionHelper.safeEditReply(interaction, {
        embeds: [buildPreviewEmbed(state), buildDashboardEmbed(state)],
        components: buildMainMenu(state),
    });
}

async function handleEditContent(selectInteraction, rootInteraction, state) {
    const modal = new ModalBuilder()
        .setCustomId('eb_content')
        .setTitle('Edit Content')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('eb_title')
                    .setLabel('Title (max 256 characters)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.title || '')
                    .setMaxLength(256)
                    .setRequired(false)
                    .setPlaceholder('My Embed Title'),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('eb_description')
                    .setLabel('Description (max 4000 characters)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(state.description ? state.description.substring(0, 4000) : '')
                    .setMaxLength(4000)
                    .setRequired(false)
                    .setPlaceholder('Write your embed description here...'),
            ),
        );

    const shown = await InteractionHelper.safeShowModal(selectInteraction, modal);
    if (!shown) return;

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'eb_content' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    await submitted.deferUpdate().catch(() => {});

    state.title       = submitted.fields.getTextInputValue('eb_title').trim()       || null;
    state.description = submitted.fields.getTextInputValue('eb_description').trim() || null;

    await refreshDashboard(rootInteraction, state);
}

async function handleSetColor(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const colorSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_color_pick')
        .setPlaceholder('Choose a color...')
        .addOptions(
            COLOR_PRESETS.map(c =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(c.label)
                    .setValue(c.value)
                    .setEmoji(c.emoji)
                    .setDescription(c.value !== '__custom__' ? c.value : 'Enter your own #RRGGBB value'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Set Color')
                .setDescription('Select a preset color or choose **Custom Hex** to enter your own `#RRGGBB` value.')
                .setColor(resolveEmbedColor('#3498DB')),
        ],
        components: [new ActionRowBuilder().addComponents(colorSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const colorCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_color_pick',
        time: 60_000,
        max: 1,
    });

    colorCollector.on('collect', async colorInter => {
        try {
            const picked = colorInter.values[0];

            if (picked === '__custom__') {
                const hexModal = new ModalBuilder()
                    .setCustomId('eb_custom_hex')
                    .setTitle('Custom Color')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('hex_value')
                                .setLabel('Hex Color Code')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('#5865F2 or 5865F2')
                                .setMaxLength(7)
                                .setMinLength(6)
                                .setRequired(true),
                        ),
                    );

                const shown = await InteractionHelper.safeShowModal(colorInter, hexModal);
                if (!shown) return;

                const hexSubmit = await colorInter
                    .awaitModalSubmit({
                        filter: i => i.customId === 'eb_custom_hex' && i.user.id === colorInter.user.id,
                        time: 60_000,
                    })
                    .catch(() => null);

                if (!hexSubmit) return;

                let hex = hexSubmit.fields.getTextInputValue('hex_value').trim();
                if (!isValidHex(hex)) {
                    await replyUserError(hexSubmit, {
                        type: ErrorTypes.USER_INPUT,
                        message: `\`${hex}\` is not a valid hex color. Use format \`#RRGGBB\` or \`RRGGBB\`.`,
                    });
                    return;
                }

                state.color = hex.startsWith('#') ? hex : `#${hex}`;
                await hexSubmit.deferUpdate().catch(() => {});
            } else {
                state.color = picked;
                await colorInter.deferUpdate().catch(() => {});
            }

            await refreshDashboard(rootInteraction, state);
        } catch (error) {
            logger.warn('Embed builder color picker interaction failed:', error.message);
        }
    });
}

async function handleAddField(selectInteraction, rootInteraction, state) {
    if (state.fields.length >= MAX_FIELDS) {
        await selectInteraction.deferUpdate().catch(() => {});
        await replyUserError(selectInteraction, {
            type: ErrorTypes.VALIDATION,
            message: `You cannot add more than ${MAX_FIELDS} fields.`,
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('eb_add_field')
        .setTitle('Add Field')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_name')
                    .setLabel('Field Name (max 256 chars)')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(256)
                    .setRequired(true)
                    .setPlaceholder('Field Name'),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_value')
                    .setLabel('Field Value (max 1024 chars)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(1024)
                    .setRequired(true)
                    .setPlaceholder('Field Value / Content'),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_inline')
                    .setLabel('Display Inline? (yes/no)')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(3)
                    .setRequired(false)
                    .setPlaceholder('no'),
            ),
        );

    const shown = await InteractionHelper.safeShowModal(selectInteraction, modal);
    if (!shown) return;

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'eb_add_field' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const name = submitted.fields.getTextInputValue('field_name').trim();
    const value = submitted.fields.getTextInputValue('field_value').trim();
    const inlineInput = submitted.fields.getTextInputValue('field_inline').trim().toLowerCase();
    const inline = inlineInput === 'yes' || inlineInput === 'true' || inlineInput === 'y';

    state.fields.push({ name, value, inline });

    await submitted.deferUpdate().catch(() => {});
    await refreshDashboard(rootInteraction, state);
}

async function handleEditField(selectInteraction, rootInteraction, state) {
    if (state.fields.length === 0) return;

    await selectInteraction.deferUpdate().catch(() => {});

    const pickSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_edit_field_pick')
        .setPlaceholder('Select a field to edit...')
        .addOptions(
            state.fields.slice(0, 25).map((f, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${f.name.substring(0, 50)}`)
                    .setDescription(`${f.value.substring(0, 90)}${f.value.length > 90 ? '…' : ''}`)
                    .setValue(String(i))
                    .setEmoji('📝'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Edit Field')
                .setDescription('Select the field you want to modify.')
                .setColor(resolveEmbedColor('#3498DB')),
        ],
        components: [new ActionRowBuilder().addComponents(pickSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const editCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_edit_field_pick',
        time: 60_000,
        max: 1,
    });

    editCollector.on('collect', async pickInter => {
        try {
            const idx = parseInt(pickInter.values[0], 10);
            const field = state.fields[idx];
            if (!field) { await pickInter.deferUpdate().catch(() => {}); return; }

            const modal = new ModalBuilder()
                .setCustomId('eb_edit_field_modal')
                .setTitle(`Edit Field ${idx + 1}`)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('field_name')
                            .setLabel('Field Name')
                            .setStyle(TextInputStyle.Short)
                            .setValue(field.name)
                            .setMaxLength(256)
                            .setRequired(true),
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('field_value')
                            .setLabel('Field Value')
                            .setStyle(TextInputStyle.Paragraph)
                            .setValue(field.value.substring(0, 1024))
                            .setMaxLength(1024)
                            .setRequired(true),
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('field_inline')
                            .setLabel('Display Inline? (yes/no)')
                            .setStyle(TextInputStyle.Short)
                            .setValue(field.inline ? 'yes' : 'no')
                            .setMaxLength(3)
                            .setRequired(false),
                    ),
                );

            const shown = await InteractionHelper.safeShowModal(pickInter, modal);
            if (!shown) return;

            const submitted = await pickInter
                .awaitModalSubmit({
                    filter: i => i.customId === 'eb_edit_field_modal' && i.user.id === pickInter
