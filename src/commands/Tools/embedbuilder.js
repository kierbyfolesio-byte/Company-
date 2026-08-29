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
import { getColor } from '../../config/bot.js';

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
            if (typeof getColor === 'function') {
                const resolved = getColor(value);
                if (resolved) {
                    if (typeof resolved === 'string') {
                        if (/^#[0-9A-Fa-f]{6}$/.test(resolved)) return resolved;
                        if (/^[0-9A-Fa-f]{6}$/.test(resolved)) return `#${resolved}`;
                    }
                    if (typeof resolved === 'number') return resolved;
                }
            }
        } catch {
            // Fallback
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
                    filter: i => i.customId === 'eb_edit_field_modal' && i.user.id === pickInter.user.id,
                    time: 120_000,
                })
                .catch(() => null);

            if (!submitted) return;

            const name = submitted.fields.
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
                    filter: i => i.customId === 'eb_edit_field_modal' && i.user.id === pickInter.user.id,
                    time: 120_000,
                })
                .catch(() => null);

            if (!submitted) return;

            const name = submitted.fields.getTextInputValue('field_name').trim();
            const value = submitted.fields.getTextInputValue('field_value').trim();
            const inlineInput = submitted.fields.getTextInputValue('field_inline').trim().toLowerCase();
            const inline = inlineInput === 'yes' || inlineInput === 'true' || inlineInput === 'y';

            state.fields[idx] = { name, value, inline };

            await submitted.deferUpdate().catch(() => {});
            await refreshDashboard(rootInteraction, state);
        } catch (error) {
            logger.warn('Embed builder field edit interaction failed:', error.message);
        }
    });
}

async function handleSetImages(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const imageSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_image_pick')
        .setPlaceholder('What would you like to change?')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Set Thumbnail')
                .setDescription('Small image displayed in top-right corner')
                .setValue('set_thumbnail')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Set Large Image')
                .setDescription('Full-width banner image at the bottom')
                .setValue('set_image')
                .setEmoji('📸'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Clear Thumbnail')
                .setDescription('Remove the current thumbnail')
                .setValue('clear_thumbnail')
                .setEmoji('🗑️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Clear Large Image')
                .setDescription('Remove the current large image')
                .setValue('clear_image')
                .setEmoji('🗑️'),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Set Images')
                .setDescription('Choose which image to set or remove.')
                .addFields(
                    { name: 'Thumbnail',   value: state.thumbnail ? `[View](${state.thumbnail})` : '`Not set`', inline: true },
                    { name: 'Large Image', value: state.image     ? `[View](${state.image})`     : '`Not set`', inline: true },
                )
                .setColor(resolveEmbedColor('#3498DB')),
        ],
        components: [new ActionRowBuilder().addComponents(imageSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const imgMenuCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_image_pick',
        time: 60_000,
        max: 1,
    });

    imgMenuCollector.on('collect', async pickInter => {
        try {
            const action = pickInter.values[0];

            if (action === 'clear_thumbnail') {
                state.thumbnail = null;
                await pickInter.deferUpdate().catch(() => {});
                await refreshDashboard(rootInteraction, state);
                return;
            }

            if (action === 'clear_image') {
                state.image = null;
                await pickInter.deferUpdate().catch(() => {});
                await refreshDashboard(rootInteraction, state);
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId('eb_image_modal')
                .setTitle(action === 'set_thumbnail' ? 'Set Thumbnail' : 'Set Large Image')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('image_url')
                            .setLabel('Image Direct URL (https://...)')
                            .setStyle(TextInputStyle.Short)
                            .setValue(action === 'set_thumbnail' ? (state.thumbnail || '') : (state.image || ''))
                            .setRequired(true)
                            .setPlaceholder('https://example.com/image.png'),
                    ),
                );

            const shown = await InteractionHelper.safeShowModal(pickInter, modal);
            if (!shown) return;

            const submitted = await pickInter
                .awaitModalSubmit({
                    filter: i => i.customId === 'eb_image_modal' && i.user.id === pickInter.user.id,
                    time: 60_000,
                })
                .catch(() => null);

            if (!submitted) return;

            const url = submitted.fields.getTextInputValue('image_url').trim();
            if (!isValidUrl(url)) {
                await replyUserError(submitted, {
                    type: ErrorTypes.USER_INPUT,
                    message: 'Image URL must be a valid `http://` or `https://` direct link.',
                });
                return;
            }

            if (action === 'set_thumbnail') state.thumbnail = url;
            if (action === 'set_image') state.image = url;

            await submitted.deferUpdate().catch(() => {});
            await refreshDashboard(rootInteraction, state);
        } catch (error) {
            logger.warn('Embed builder image interaction failed:', error.message);
        }
    });
}

async function handleRemoveField(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const pickSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_remove_field_pick')
        .setPlaceholder('Select a field to remove...')
        .addOptions(
            state.fields.slice(0, 25).map((f, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${f.name.substring(0, 50)}`)
                    .setDescription(`${f.value.substring(0, 90)}${f.value.length > 90 ? '…' : ''}`)
                    .setValue(String(i))
                    .setEmoji('➖'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Remove Field')
                .setDescription('Select the field you want to delete.')
                .setColor(resolveEmbedColor('#FEE75C')),
        ],
        components: [new ActionRowBuilder().addComponents(pickSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const removeCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_remove_field_pick',
        time: 60_000,
        max: 1,
    });

    removeCollector.on('collect', async removeInter => {
        await removeInter.deferUpdate().catch(() => {});
        const idx = parseInt(removeInter.values[0], 10);
        state.fields.splice(idx, 1);
        await refreshDashboard(rootInteraction, state);
    });
}

async function handleReorderFields(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const pickSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_reorder_pick')
        .setPlaceholder('Select a field to move...')
        .addOptions(
            state.fields.slice(0, 25).map((f, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${f.name.substring(0, 50)}`)
                    .setDescription(`${f.value.substring(0, 90)}${f.value.length > 90 ? '…' : ''}`)
                    .setValue(String(i))
                    .setEmoji('↕️'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Reorder Fields')
                .setDescription('Select a field, then use the buttons to move it up or down.')
                .setColor(resolveEmbedColor('#3498DB')),
        ],
        components: [new ActionRowBuilder().addComponents(pickSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const pickCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_reorder_pick',
        time: 60_000,
        max: 1,
    });

    pickCollector.on('collect', async pickInter => {
        await pickInter.deferUpdate().catch(() => {});
        const sourceIdx = parseInt(pickInter.values[0], 10);

        const upBtn = new ButtonBuilder()
            .setCustomId('eb_reorder_up')
            .setLabel('Move Up')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⬆️')
            .setDisabled(sourceIdx === 0);

        const downBtn = new ButtonBuilder()
            .setCustomId('eb_reorder_down')
            .setLabel('Move Down')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⬇️')
            .setDisabled(sourceIdx === state.fields.length - 1);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('eb_reorder_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        await pickInter.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Move Field')
                    .setDescription(`Moving **${state.fields[sourceIdx].name}** — currently at position **${sourceIdx + 1}** of **${state.fields.length}**.`)
                    .setColor(resolveEmbedColor('#3498DB')),
            ],
            components: [new ActionRowBuilder().addComponents(upBtn, downBtn, cancelBtn)],
            flags: MessageFlags.Ephemeral,
        });

        const dirCollector = rootInteraction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i =>
                i.user.id === selectInteraction.user.id &&
                ['eb_reorder_up', 'eb_reorder_down', 'eb_reorder_cancel'].includes(i.customId),
            time: 30_000,
            max: 1,
        });

        dirCollector.on('collect', async dirInter => {
            await dirInter.deferUpdate().catch(() => {});
            if (dirInter.customId === 'eb_reorder_cancel') return;

            const targetIdx = dirInter.customId === 'eb_reorder_up' ? sourceIdx - 1 : sourceIdx + 1;

            if (targetIdx < 0 || targetIdx >= state.fields.length) return;

            const temp = state.fields[sourceIdx];
            state.fields[sourceIdx] = state.fields[targetIdx];
            state.fields[targetIdx] = temp;

            await refreshDashboard(rootInteraction, state);
        });
    });
}

async function handlePostEmbed(selectInteraction, rootInteraction, state, guild) {
    if (
        !state.title &&
        !state.description &&
        (!state.fields || state.fields.length === 0) &&
        !state.author?.name
    ) {
        await selectInteraction.deferUpdate().catch(() => {});
        await replyUserError(selectInteraction, {
            type: ErrorTypes.VALIDATION,
            message: 'Add at least a title, description, or field before posting.',
        });
        return;
    }

    await selectInteraction.deferUpdate().catch(() => {});

    const chanSelect = new ChannelSelectMenuBuilder()
        .setCustomId('eb_post_channel')
        .setPlaceholder('Select a channel...')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Post Embed')
                .setDescription('Select the channel where this embed will be sent.')
                .setColor(resolveEmbedColor('#3498DB')),
        ],
        components: [new ActionRowBuilder().addComponents(chanSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'eb_post_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInter => {
        await chanInter.deferUpdate().catch(() => {});
        const channel = chanInter.channels.first();

        if (!channel) {
            await replyUserError(chanInter, {
                type: ErrorTypes.USER_INPUT,
                message: 'Could not resolve the selected channel.',
            });
            return;
        }

        const finalEmbed = buildPreviewEmbed(state);

        if (finalEmbed.data.description === '*(Empty — use the menu below to add content)*') {
            finalEmbed.setDescription(null);
        }

        await channel.send({ embeds: [finalEmbed] });

        await chanInter.followUp({
            embeds: [successEmbed('Embed Sent', `Your embed has been posted to ${channel}.`)],
            flags: MessageFlags.Ephemeral,
        });
    });
}

async function handleJsonExport(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const previewEmbed = buildPreviewEmbed(state);
    const json = JSON.stringify(previewEmbed.toJSON(), null, 2);

    if (json.length <= 3980) {
        await selectInteraction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Embed JSON')
                    .setDescription(`\`\`\`json\n${json}\n\`\`\``)
                    .setColor(resolveEmbedColor('#3498DB')),
            ],
            flags: MessageFlags.Ephemeral,
        });
    } else {
        await selectInteraction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Embed JSON')
                    .setDescription('The JSON is too long to display inline — see the attached file.')
                    .setColor(resolveEmbedColor('#3498DB')),
            ],
            files: [
                {
                    attachment: Buffer.from(json, 'utf-8'),
                    name: 'embed.json',
                },
            ],
            flags: MessageFlags.Ephemeral,
        });
    }
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('embedbuilder')
        .setDescription('Build and post a fully custom embed with live preview'),

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, {
                flags: MessageFlags.Ephemeral,
            });
            if (!deferSuccess) return;

            const guild = interaction.guild;

            const state = {
                title:       null,
                description: null,
                color:       '#336699',
                author:      null,
                footer:      null,
                thumbnail:   null,
                image:       null,
                timestamp:   false,
                fields:      [],
            };

            await refreshDashboard(interaction, state);

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id && i.customId.startsWith('eb_main_'),
                time: IDLE_TIMEOUT,
            });

            collector.on('collect', async ci => {
                try {
                    switch (ci.customId) {
                        case 'eb_main_edit_content':
                            await handleEditContent(ci, interaction, state);
                            break;
                        case 'eb_main_set_color':
                            await handleEditContent(ci, interaction, state);
                            break;
                        case 'eb_main_set_color':
                            await handleSetColor(ci, interaction, state);
                            break;
                        case 'eb_main_set_images':
                            await handleSetImages(ci, interaction, state);
                            break;
                        case 'eb_main_post_embed':
                            await handlePostEmbed(ci, interaction, state, guild);
                            break;
                        case 'eb_main_add_field':
                            await handleAddField(ci, interaction, state);
                            break;
                        case 'eb_main_edit_field':
                            await handleEditField(ci, interaction, state);
                            break;
                        case 'eb_main_remove_field':
                            await handleRemoveField(ci, interaction, state);
                            break;
                        case 'eb_main_reorder_fields':
                            await handleReorderFields(ci, interaction, state);
                            break;
                        case 'eb_main_toggle_timestamp':
                            state.timestamp = !state.timestamp;
                            await ci.deferUpdate().catch(() => {});
                            await refreshDashboard(interaction, state);
                            break;
                        case 'eb_main_json_export':
                            await handleJsonExport(ci, interaction, state);
                            break;
                        case 'eb_main_reset_all':
                            state.title       = null;
                            state.description = null;
                            state.color       = '#336699';
                            state.author      = null;
                            state.footer      = null;
                            state.thumbnail   = null;
                            state.image       = null;
                            state.timestamp   = false;
                            state.fields      = [];
                            await ci.deferUpdate().catch(() => {});
                            await refreshDashboard(interaction, state);
                            break;
                        default:
                            await ci.deferUpdate().catch(() => {});
                    }
                } catch (error) {
                    logger.error('Error in embedbuilder collector:', error);
                    const msg =
                        error instanceof TitanBotError
                            ? error.userMessage || 'An error occurred.'
                            : 'An unexpected error occurred.';
                    if (!ci.replied && !ci.deferred) await ci.deferUpdate().catch(() => {});
                    await replyUserError(ci, {
                        type: ErrorTypes.UNKNOWN,
                        message: msg,
                    }).catch(() => {});
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await InteractionHelper.safeEditReply(interaction, { components: [] }).catch(() => {});
                }
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in embedbuilder:', error);
            throw new TitanBotError(
                `embedbuilder failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'Failed to open the embed builder.',
            );
        }
    },
};
