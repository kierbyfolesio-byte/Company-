import ticketDashboard from '../../commands/ticket/modules/ticket_dashboard.js';

export default {
    name: 'ticket_dash',
    customId: 'ticket_dash_',
    async execute(interaction, client) {
        await ticketDashboard.handleInteraction(interaction, client);
    }
};

