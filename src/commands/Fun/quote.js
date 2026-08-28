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

            // Draw Background
            ctx.fillStyle = '#111214';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Fetch & Draw Avatar
            const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await loadImage(avatarUrl);

            ctx.save();
            ctx.beginPath();
            ctx.arc(140, 150, 75, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 65, 75, 150, 150);
            ctx.restore();

            // Regex for custom Discord emojis: <:name:id> or <a:name:id>
            const emojiRegex = /<(a?):(\w+):(\d+)>/g;

            // Split text into readable tokens (words & custom emojis)
            const rawTokens = [];
            let lastIdx = 0;
            let match;
            const quoteText = `"${text}"`;

            while ((match = emojiRegex.exec(quoteText)) !== null) {
                if (match.index > lastIdx) {
                    const plain = quoteText.slice(lastIdx, match.index);
                    plain.split(/(\s+)/).forEach(part => {
                        if (part) rawTokens.push({ type: 'text', content: part });
                    });
                }
                const emojiId = match[3];
                rawTokens.push({
                    type: 'emoji',
                    url: `https://cdn.discordapp.com/emojis/${emojiId}.png`,
                    name: match[2]
                });
                lastIdx = emojiRegex.lastIndex;
            }

            if (lastIdx < quoteText.length) {
                const remaining = quoteText.slice(lastIdx);
                remaining.split(/(\s+)/).forEach(part => {
                    if (part) rawTokens.push({ type: 'text', content: part });
                });
            }

            // Pre-load custom emoji images
            const tokens = await Promise.all(rawTokens.map(async (token) => {
                if (token.type === 'emoji') {
                    try {
                        const img = await loadImage(token.url);
                        return { ...token, img };
                    } catch {
                        return { type: 'text', content: `:${token.name}:` };
                    }
                }
                return token;
            }));

            // Render Text & Inline Emojis
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'italic 26px sans-serif';

            const startX = 260;
            let currentX = startX;
            let currentY = 110;
            const maxWidth = 480;
            const lineHeight = 36;
            const fontSize = 26;

            for (const token of tokens) {
                if (token.type === 'text') {
                    const metrics = ctx.measureText(token.content);
                    if (currentX + metrics.width > startX + maxWidth && currentX > startX) {
                        currentX = startX;
                        currentY += lineHeight;
                    }
                    ctx.fillText(token.content, currentX, currentY);
                    currentX += metrics.width;
                } else if (token.type === 'emoji' && token.img) {
                    const emojiSize = fontSize + 4;
                    if (currentX + emojiSize > startX + maxWidth && currentX > startX) {
                        currentX = startX;
                        currentY += lineHeight;
                    }
                    ctx.drawImage(token.img, currentX, currentY - fontSize + 2, emojiSize, emojiSize);
                    currentX += emojiSize + 4;
                }
            }

            // Draw Author Name
            ctx.fillStyle = '#949BA4';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(`— ${targetUser.displayName || targetUser.username}`, startX, currentY + 40);

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
