import ticketDashboard from '../commands/ticket/modules/ticket_dashboard.js'; // Adjust path if needed

export default {
    name: 'ticket_dash_select_panel',
    customId: 'ticket_dash_select_panel',
    
    async execute(interaction, client) {
        await ticketDashboard.handleComponentInteraction(interaction, client);
    }
};
