const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_rules')
        .setDescription('Posts the official server rules embed.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const rulesEmbed = new EmbedBuilder()
            .setTitle('📜 Server Rules & Guidelines')
            .setDescription('Welcome to the community! Please read and follow these rules to ensure a safe and enjoyable environment for everyone.')
            .setColor(0x0099FF)
            .addFields(
                { name: '1. Treat Everyone with Respect', value: 'Harassment, hate speech, sexism, racism, or toxicity of any kind will result in an immediate ban.' },
                { name: '2. No Spam or Excessive Self-Promotion', value: 'Keep chat clear. Do not advertise your content, social links, or servers outside of designated promo channels.' },
                { name: '3. Keep Content Safe for Work (SFW)', value: 'Explicit, violent, or sexually suggestive material is strictly prohibited across all text and voice channels.' },
                { name: '4. Respect Staff Instructions', value: 'Moderators have the final say. If asked to stop a behavior or topic, please comply respectfully.' },
                { name: '5. Follow Discord TOS', value: 'Adhere to the official Discord Community Guidelines (https://discord.com/guidelines) at all times.' },
                { name: '6. Respect Channel Topics', value: 'Keep discussions relevant to the channel you are in. Check channel descriptions if you aren\'t sure where to post.' },
                { name: '7. No Excessive Pinging', value: 'Do not tag members, staff, or roles unnecessarily. Avoid pinging people repeatedly for attention.' },
                { name: '8. Voice Channel Etiquette', value: 'No ear-splitting noises, soundboard spam, or voice changers. Keep screen shares SFW.' },
                { name: '9. Protect Privacy (No Doxxing)', value: 'Never share private personal information of yourself or others without explicit consent.' },
                { name: '10. No DM Spam or Advertising', value: 'DMing server members with unsolicited self-promotion, links, or harassment will result in a ban.' },
                { name: '11. Appropriate Profiles', value: 'Usernames, nicknames, avatars, and statuses must remain SFW and respectful.' }
            )
            .setFooter({ 
                text: `${interaction.guild.name} • Subject to change by staff`, 
                iconURL: interaction.guild.iconURL({ dynamic: true }) 
            });

        await interaction.reply({ embeds: [rulesEmbed] });
    },
};
