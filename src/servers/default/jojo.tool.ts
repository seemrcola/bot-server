import { BaseTool } from '../../mcp/servers/base-tool.js';
import { ToolParameters, ToolResult } from '../../mcp/types/index.js';

export default class JoJoTool extends BaseTool {
  private jojoResponses = [
    'オラオラオラオラ！(ORAORAORAORAORA!)',
    '無駄無駄無駄無駄！(MUDAMUDAMUDAMUDA!)',
    'WRYYYYYYYYYYYY!',
    '逃げるんだよォ！(Nigerundayo!)',
    '贫弱、贫弱ゥ！(Hinjakku, Hinjakku!)',
    'やれやれだぜ... (Yare yare daze...)',
    'この味は！...嘘をついている『味』だぜ...',
    'だが断る！(But I refuse!)',
    'ゴゴゴゴゴ...',
    'メメタァ！',
    'ドラララララ！',
    'アリアリアリアリ！(ARIARIARIARIARI!)',
    'YES! YES! YES!',
    'NO! NO! NO!',
    'WRYYYYY！',
    'ロードローラーだ！(ROAD ROLLER DA!)',
    '時よ止まれ！(ZA WARUDO!)',
    'スタープラチナ！',
    'ザ・ワールド！',
  ];

  constructor() {
    super(
      'jojo',
      'JoJo动漫机器人，当用户说出与JoJo相关的词时返回经典台词',
      {
        type: 'object',
        properties: {
            trigger: {
              type: 'string',
              description: '触发回复的关键词'
            },
        },
        required: [],
      },
      ['jojo', 'ゴゴゴ', 'mudamuda', '無駄', '替身', 'stand', '承太郎', '迪奥', 'dio']
    );
  }

  protected async _execute(params: ToolParameters): Promise<ToolResult> {
    // 这里的随机回复是根据jojo动漫的台词库随机返回的
    const randomResponse = this.jojoResponses[Math.floor(Math.random() * this.jojoResponses.length)];
    return {
      success: true,
      data: randomResponse,
    };
  }
} 
