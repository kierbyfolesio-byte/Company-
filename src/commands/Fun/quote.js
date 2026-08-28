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

            // 1. Dark Background
            ctx.fillStyle = '#111214';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Draw Circular Avatar
            const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await loadImage(avatarUrl);

            ctx.save();
            ctx.beginPath();
            ctx.arc(140, 150, 75, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 65, 75, 150, 150);
            ctx.restore();

            // 3. Configure Font & Baseline (Explicit Linux font family stack)
            ctx.textBaseline = 'top';
            const textFont = 'bold 30px "DejaVu Sans", Arial, sans-serif';
            ctx.font = textFont;
            ctx.fillStyle = '#FFFFFF';

            const quoteStr = `"${text}"`;
            const startX = 250;
            const startY = 70;
            const maxWidth = 500;
            const lineHeight = 42;
            const emojiSize = 34;

            // Parse custom Discord emojis (<:name:id> or <a:name:id>)
            const emojiRegex = /<(a?):(\w+):(\d+)>/g;
            const rawTokens = [];
            let lastIdx = 0;
            let match;

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

            // Split plain text into words & preserve spaces
            const tokens = [];
            for (const item of rawTokens) {
                if (item.type === 'text') {
                    const parts = item.content.split(/(\s+)/);
                    for (const p of parts) {
                        if (p) tokens.push({ type: 'text', content: p });
                    }
                } else {
                    tokens.push(item);
                }
            }

            // Pre-load emoji images safely
            const processedTokens = await Promise.all(tokens.map(async (tok) => {
                if (tok.type === 'emoji') {
                    try {
                        const img = await loadImage(tok.url);
                        return { ...tok, img };
                    } catch {
                        return { type: 'text', content: `:${tok.name}:` };
                    }
                }
                return tok;
            }));

            // Calculate line wrapping
            const lines = [[]];
            let currentLineWidth = 0;

            for (const tok of processedTokens) {
                let w = 0;
                if (tok.type === 'text') {
                    w = ctx.measureText(tok.content).width;
                } else if (tok.type === 'emoji' && tok.img) {
                    w = emojiSize + 4;
                }

                if (currentLineWidth + w > maxWidth && currentLineWidth > 0 && tok.content !== ' ') {
                    lines.push([]);
                    currentLineWidth = 0;
                    if (tok.type === 'text' && tok.content.trim() === '') continue;
                }

                lines[lines.length - 1].push({ ...tok, width: w });
                currentLineWidth += w;
            }

            // 4. Render Quote Text & Inline Emojis
            let currentY = startY;
            for (const line of lines) {
                let currentX = startX;
                for (const item of line) {
                    if (item.type === 'text') {
                        ctx.font = textFont;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillText(item.content, currentX, currentY);
                    } else if (item.type === 'emoji' && item.img) {
                        ctx.drawImage(item.img, currentX, currentY - 2, emojiSize, emojiSize);
                    }
                    currentX += item.width;
                }
                currentY += lineHeight;
            }

            // 5. Render Author Name
            ctx.font = 'bold 22px "DejaVu Sans", Arial, sans-serif';
            ctx.fillStyle = '#949BA4';
            ctx.fillText(`— ${targetUser.displayName || targetUser.username}`, startX, currentY + 10);

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
