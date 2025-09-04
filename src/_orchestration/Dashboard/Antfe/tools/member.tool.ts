export const memberTool = {
    name: 'antfe-member',
    schema: {
        title: 'Get Antfe Members',
        description: 'Get Antfe Members',
    },
    handle: () => {
        return {
            content: [{ type: 'text', text: 'C, Mr., 显林叔' }],
        }
    },
}
