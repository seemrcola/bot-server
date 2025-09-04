export const discordTool = {
    name: 'antfe-discord',
    schema: {
        title: 'Get Antfe Discord',
        description: 'Get Antfe Discord',
    },
    handle: () => {
        return {
            content: [{ type: 'text', text: 'https://discord.com/invite/P3v4zzZtGV' }],
        }
    },
}
