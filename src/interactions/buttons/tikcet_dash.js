import ticketDashboard from '../commands/ticket/modules/ticket_dashboard.js'; // Adjust path if needed

export default {
    name: 'ticket_dash',
    // Matches any button customId starting with "ticket_dash_"
    customId: 'ticket_dash_',
    
    async execute(interaction, client) {
        await ticketDashboard.handleComponentInteraction(interaction, client);
    }
};

