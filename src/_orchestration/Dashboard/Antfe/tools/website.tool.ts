export const websiteTool = {
    name: 'antfe-website',
    schema: {
        title: 'Get Antfe Website',
        description: 'Get Antfe Website',
    },
    handle: () => {
        return {
            content: [{ type: 'text', text: 'https://antfe.com' }],
        }
    },
}
