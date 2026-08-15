import { Events } from 'discord.js';

export default {
    name: Events.MessageCreate,
    once: false,
    async execute(message, config, client) {
        if (message.author.bot) return;

        // Replace with your server's Custom Emoji IDs
        const CUSTOM_LIKE_EMOJI_ID = '123456789012345678';
        const CUSTOM_DISLIKE_EMOJI_ID = '876543210987654321';

        try {
            await message.react(1538108250866716672);
            await message.react(1538108231291904040);
        } catch (error) {
            console.error(`Failed to add custom reactions:`, error);
        }
    }
};

