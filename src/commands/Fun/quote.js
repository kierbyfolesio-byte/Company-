import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';

export default {
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Generates an image of a user quote.')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text quote')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user who said it (defaults to you)')
                .setRequired(false)),
    category: 'fun',

    async execute(interaction, config, client) {
        // Defer reply since image rendering can take a second
        await interaction.deferReply();

        const text = interaction.options.getString('text');
        const targetUser = interaction.options.getUser('user') || interaction.user;

        // Create Canvas (Width: 800px, Height: 300px)
        const canvas = createCanvas(800, 300);
        const ctx = canvas.getContext('2d');

        // Draw Dark Background
        ctx.fillStyle = '#111214';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Fetch User Avatar
        const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);

        // Draw Circular Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(140, 150, 75, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 65, 75, 150, 150);
        ctx.restore();

        // Helper function to wrap quote text automatically across lines
        const wrapText = (context, quote, x, y, maxWidth, lineHeight) => {
            const words = quote.split(' ');
            let line = '';
            let currentY = y;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = context.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    context.fillText(line, x, currentY);
                    line = words[n] + ' ';
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            context.fillText(line, x, currentY);
            return currentY;
        };

        // Draw Quote Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'italic 26px sans-serif';
        const lastY = wrapText(ctx, `"${text}"`, 260, 110, 480, 36);

        // Draw Author Name below the quote
        ctx.fillStyle = '#949BA4';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`— ${targetUser.displayName || targetUser.username}`, 260, lastY + 40);

        // Convert canvas into Discord attachment
        const buffer = await canvas.encode('png');
        const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });

        await interaction.editReply({ files: [attachment] });
    }
};
