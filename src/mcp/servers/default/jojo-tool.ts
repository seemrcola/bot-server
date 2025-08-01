import { BaseTool } from '../base-tool.js';
import { ToolParameters, ToolResult } from '../../types/index.js';

export class JoJoTool extends BaseTool {
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
      }
    );
  }

  protected async _execute(params: ToolParameters): Promise<ToolResult> {
    const randomResponse = this.jojoResponses[Math.floor(Math.random() * this.jojoResponses.length)];
    return {
      success: true,
      data: randomResponse,
    };
  }
} 
