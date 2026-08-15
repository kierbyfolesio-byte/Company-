import { Events } from 'discord.js';

export default {
    name: Events.MessageCreate,
    once: false,
    async execute(message, config, client) {
        // Ignore messages sent by bots
        if (message.author.bot) return;

        // List up to 6 channel IDs where you want auto-reactions active
        const TARGET_CHANNEL_IDS = [
            '1529966689918259282',
            '1529966689918259282',
            'CHANNEL_ID_3',
            'CHANNEL_ID_4',
            'CHANNEL_ID_5',
            'CHANNEL_ID_6'
        ];

        // Stop execution if the message isn't in one of your target channels
        if (!TARGET_CHANNEL_IDS.includes(message.channel.id)) return;

        // Custom Emoji IDs
        const LIKE_EMOJI_ID = '153810823129';
        const DISLIKE_EMOJI_ID = '153810825086';

        try {
            await message.react(LIKE_EMOJI_ID);
            await message.react(DISLIKE_EMOJI_ID);
        } catch (error) {
            console.error(`Failed to add reactions in channel ${message.channel.id}:`, error);
        }
    }
};
