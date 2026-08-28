import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const data = new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Generates an image of a user quote.')
    .addStringOption(option =>
        option.setName('text')
            .setDescription('The text quote')
            .setRequired(true))
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user who said it (defaults to you)')
            .setRequired(false));

export default {
    name: 'quote',
    data: data,
    category: 'fun',

    async execute(interaction, config, client) {
        await interaction.deferReply();

        try {
            const text = interaction.options.getString('text');
            const targetUser = interaction.options.getUser('user') || interaction.user;

            const canvas = createCanvas(800, 300);
            const ctx = canvas.getContext('2d');

            // Draw Dark Background
            ctx.fillStyle = '#111214';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Fetch & Draw Circular Avatar
            const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await loadImage(avatarUrl);

            ctx.save();
            ctx.beginPath();
            ctx.arc(140, 150, 75, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 65, 75, 150, 150);
            ctx.restore();

            // Set Text Baseline and Font (Bolder & Larger: 32px)
            ctx.textBaseline = 'top';
            ctx.font = 'bold 32px sans-serif';
            ctx.fillStyle = '#FFFFFF';

            const quoteStr = `"${text}"`;
            const emojiRegex = /<(a?):(\w+):(\d+)>/g;
            const rawTokens = [];
            let lastIdx = 0;
            let match;

            // Tokenize text and custom Discord emojis
            while ((match = emojiRegex.exec(quoteStr)) !== null) {
                if (match.index > lastIdx) {
                    rawTokens.push({ type: 'text', content: quoteStr.slice(lastIdx, match.index) });
                }
                rawTokens.push({
                    type: 'emoji',
                    url: `https://cdn.discordapp.com/emojis/${match[3]}.png`,
                    name: match[2]
                });
                lastIdx = emojiRegex.lastIndex;
            }
            if (lastIdx < quoteStr.length) {
                rawTokens.push({ type: 'text', content: quoteStr.slice(lastIdx) });
            }

            // Split plain text into words and spaces to preserve formatting
            const wordTokens = [];
            for (const token of rawTokens) {
                if (token.type === 'text') {
                    const parts = token.content.split(/(\s+)/);
                    for (const part of parts) {
                        if (part) wordTokens.push({ type: 'text', content: part });
                    }
                } else {
                    wordTokens.push(token);
                }
            }

            // Load emoji images asynchronously
            const tokens = await Promise.all(wordTokens.map(async (item) => {
                if (item.type === 'emoji') {
                    try {
                        const img = await loadImage(item.url);
                        return { ...item, img };
                    } catch {
                        return { type: 'text', content: `:${item.name}:` };
                    }
                }
                return item;
            }));

            // Layout & Line Wrapping Settings
            const startX = 250;
            const startY = 75;
            const maxWidth = 500;
            const lineHeight = 42;
            const fontSize = 32;

            const lines = [[]];
            let currentLineWidth = 0;

            for (const token of tokens) {
                let tokenWidth = 0;
                if (token.type === 'text') {
                    tokenWidth = ctx.measureText(token.content).width;
                } else if (token.type === 'emoji' && token.img) {
                    tokenWidth = fontSize + 6;
                }

                if (currentLineWidth + tokenWidth > maxWidth && currentLineWidth > 0 && token.content !== ' ') {
                    lines.push([]);
                    currentLineWidth = 0;
                    if (token.type === 'text' && token.content.trim() === '') continue;
                }

                lines[lines.length - 1].push({ ...token, width: tokenWidth });
                currentLineWidth += tokenWidth;
            }

            // Render Quote Text & Custom Emojis
            let currentY = startY;
            for (const line of lines) {
                let currentX = startX;
                for (const item of line) {
                    if (item.type === 'text') {
                        ctx.fillText(item.content, currentX, currentY);
                    } else if (item.type === 'emoji' && item.img) {
                        ctx.drawImage(item.img, currentX, currentY + 2, fontSize + 4, fontSize + 4);
                    }
                    currentX += item.width;
                }
                currentY += lineHeight;
            }

            // Draw Author Name
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = '#949BA4';
            ctx.fillText(`— ${targetUser.displayName || targetUser.username}`, startX, currentY + 12);

            // Output Attachment
            const buffer = await canvas.encode('png');
            const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });

            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error('Error executing /quote command:', error);
            await interaction.editReply({ content: 'Failed to generate quote image.' });
        }
    }
};
