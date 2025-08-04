import { BaseTool } from '../../mcp/servers/base-tool.js';
import { ToolParameters, ToolResult } from '../../mcp/types/index.js';

export default class JoJoTool extends BaseTool {
  private jojoResponses: Record<string, string[]> = {
    '承太郎': [
      'やれやれだぜ... (Yare yare daze...)',
      'オラオラオラオラ！(ORAORAORAORAORA!)',
      'スタープラチナ！ザ・ワールド！',
    ],
    'DIO': [
      '無駄無駄無駄無駄！(MUDAMUDAMUDAMUDA!)',
      'WRYYYYYYYYYYYY!',
      '贫弱、贫弱ゥ！(Hinjakku, Hinjakku!)',
      'ロードローラーだ！(ROAD ROLLER DA!)',
      '時よ止まれ！(ZA WARUDO!)',
    ],
    '乔瑟夫': [
      '逃げるんだよォ！(Nigerundayo!)',
      'YES! YES! YES!',
      'NO! NO! NO!',
    ],
    '布加拉提': [
      'アリアリアリアリ！(ARIARIARIARIARI!)',
      'この味は！...嘘をついている『味』だぜ...',
    ],
    '通用': [
      'だが断る！(But I refuse!)',
      'ゴゴゴゴゴ...',
      'メメタァ！',
    ]
  };

  constructor() {
    super(
      'jojo',
      '获取关于日本著名漫画《JOJO的奇妙冒险》（ジョジョの奇妙な冒険）中的经典台词、名场面或角色信息。',
      {
        type: 'object',
        properties: {
            topic: {
              type: 'string',
              description: 'JOJO相关的主题或角色名，例如 "承太郎" 或 "DIO"'
            },
        },
        required: ['topic'],
      },
      ['jojo', 'ゴゴゴ', 'mudamuda', '無駄', '替身', 'stand', '承太郎', '迪奥', 'dio', '乔瑟夫', '布加拉提']
    );
  }

  protected async _execute(params: ToolParameters): Promise<ToolResult> {
    const topic = (params['topic'] as string) || '通用';
    let selectedQuotes: string[] = this.jojoResponses['通用'] || []; // 添加 fallback

    // 尝试根据主题精确匹配
    for (const key in this.jojoResponses) {
      if (topic.toLowerCase().includes(key.toLowerCase())) {
        selectedQuotes = this.jojoResponses[key] || [];
        break;
      }
    }
    
    const response = selectedQuotes.join('\n');
    
    return {
      success: true,
      data: `关于'${topic}'的台词:\n${response}`,
    };
  }
} 
