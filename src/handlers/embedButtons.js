// src/commands/utility/embedbuilder.js

import { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder 
} from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';

// Session store for active embed builder instances
const activeSessions = new Map();

export async function handleColorButton(interaction) {
  // 1. Guard against lost session data after bot restarts
  const session = activeSessions.get(interaction.user.id);
  if (!session) {
    return interaction.reply({
      embeds: [
        errorEmbed(
          'Session Expired', 
          'Your embed builder session expired or the bot restarted. Please run `/embedbuilder` again.'
        )
      ],
      ephemeral: true
    });
  }

  // 2. Do NOT defer update here if showing a Modal!
  const modal = new ModalBuilder()
    .setCustomId('embed_color_modal')
    .setTitle('Set Embed Color');

  const colorInput = new TextInputBuilder()
    .setCustomId('color_value')
    .setLabel('Hex Color or Color Name')
    .setPlaceholder('#336699 or Blue')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(colorInput));

  // 3. Directly show modal as initial response
  await interaction.showModal(modal);
}

export async function handleColorModalSubmit(interaction) {
  const session = activeSessions.get(interaction.user.id);
  if (!session) {
    return interaction.reply({
      embeds: [errorEmbed('Session Expired', 'Please restart with `/embedbuilder`.')],
      ephemeral: true
    });
  }

  const rawColor = interaction.fields.getTextInputValue('color_value').trim();

  // Validate hex format or name before passing to embed
  const hexMatch = rawColor.match(/^#?([0-9A-Fa-f]{6})$/);
  const validColor = hexMatch ? `#${hexMatch[1]}` : rawColor;

  session.color = validColor;

  // Re-render embed safely
  const updatedEmbed = createEmbed({
    title: session.title,
    description: session.description,
    color: session.color,
    fields: session.fields
  });

  await interaction.update({
    embeds: [updatedEmbed]
  });
}
