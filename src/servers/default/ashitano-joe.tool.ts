import { BaseTool } from '../../mcp/servers/base-tool.js';
import { ToolParameters, ToolResult } from '../../mcp/types/index.js';

export default class AshitaNoJoeTool extends BaseTool {
  private joeResponses = [
    '燃えつきるほどヒートするやつは、かならずいるんだ、どこかに。',
    '燃え尽きたぜ…真っ白にな…',
    '立つんだ、ジョー！',
    '明日のために打つべし！',
    'おっちゃん、俺、もう眠てえや…',
    '泪桥を逆に渡る',
    '拳キチ（ボクキチ）',
    '自分のために、あしたのために！',
    'カーロス…あんたとの出合がなければ、俺は今でも…ドサ回りの三流ボサーとして…何の目的も持たずに…拳を振るっていたかもしれねえ…。',
    'ホセ…あんたが憎い…。だが、あんたがいなければ…俺はここまで燃え上がれなかった…。'
  ];

  constructor() {
    super(
      'ashitano_joe',
      '明日之丈机器人，当用户说出与明日之丈相关的词时返回经典台词',
      {
        type: 'object',
        properties: {
          trigger: {
            type: 'string',
            description: '触发回复的关键词',
          },
        },
        required: [],
      },
      ['明日之丈', 'ashitano', 'joe', '矢吹丈', '燃え尽き', '拳击', 'ボクシング']
    );
  }

  protected async _execute(params: ToolParameters): Promise<ToolResult> {
    // 随机返回明日之丈的经典台词
    const randomResponse =
      this.joeResponses[Math.floor(Math.random() * this.joeResponses.length)];
    return {
      success: true,
      data: randomResponse,
    };
  }
}
