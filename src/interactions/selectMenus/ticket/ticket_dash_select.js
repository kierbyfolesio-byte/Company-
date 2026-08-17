import ticketDashboard from '../../commands/ticket/modules/ticket_dashboard.js';

export default {
    name: 'ticket_dash_select_panel',
    customId: 'ticket_dash_select_panel',
    async execute(interaction, client) {
        await ticketDashboard.handleInteraction(interaction, client);
    }
};

