import { Events } from 'discord.js';

export default {
    name: Events.MessageCreate,
    once: false,
    async execute(message, config, client) {
        // Ignore messages sent by bots
        if (message.author.bot) return;

        // List up to 6 channel IDs where you want auto-reactions active
        const TARGET_CHANNEL_IDS = [
            '1538114405349204059',
            '1529966689918259282',
            'CHANNEL_ID_3',
            'CHANNEL_ID_4',
            'CHANNEL_ID_5',
            'CHANNEL_ID_6'
        ];

        // Stop execution if the message isn't in one of your target channels
        if (!TARGET_CHANNEL_IDS.includes(message.channel.id)) return;

        // Check if the message contains at least one image attachment
        const hasImage = message.attachments.some(attachment => 
            attachment.contentType?.startsWith('image/') || Boolean(attachment.height)
        );

        // Stop execution if there are no images attached
        if (!hasImage) return;

        // Custom Emoji IDs (Remember: standard Discord IDs are 18-19 digits long)
        const LIKE_EMOJI_ID = '1538108231291904040';
        const DISLIKE_EMOJI_ID = '1538108250866716672';

        try {
            await message.react(LIKE_EMOJI_ID);
            await message.react(DISLIKE_EMOJI_ID);
        } catch (error) {
            console.error(`Failed to add reactions in channel ${message.channel.id}:`, error);
        }
    }
};
