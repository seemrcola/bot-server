import { BaseTool } from '../../mcp/servers/base-tool.js';
import { ToolParameters, ToolResult } from '../../mcp/types/index.js';

export default class AshitaNoJoeTool extends BaseTool {
  private joeResponses: Record<string, string[]> = {
    '拳击': [
      '明日のために打つべし！',
      '燃えつきるほどヒートするやつは、かならずいるんだ、どこかに。',
      '立つんだ、ジョー！',
      '拳キチ（ボクキチ）',
    ],
    '燃烧': [
      '燃え尽きたぜ…真っ白にな…',
      '燃えつきるほどヒートするやつは、かならずいるんだ、どこかに。',
    ],
    '明天': [
      '明日のために打つべし！',
      '自分のために、あしたのために！',
    ],
    '疲惫': [
      'おっちゃん、俺、もう眠てえや…',
    ],
    '对手': [
      'カーロス…あんたとの出合がなければ、俺は今でも…ドサ回りの三流ボサーとして…何の目的も持たずに…拳を振るっていたかもしれねえ…。',
      'ホセ…あんたが憎い…。だが、あんたがいなければ…俺はここまで燃え上がれなかった…。'
    ],
    '通用': [
      '燃えつきるほどヒートするやつは、かならずいるんだ、どこかに。',
      '明日のために打つべし！',
      '立つんだ、ジョー！',
    ]
  };

  constructor() {
    super(
      'ashitano_joe',
      '获取关于日本经典拳击漫画《明日之丈》（あしたのジョー）的著名语录和信息。',
      {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: '明日之丈相关的主题，例如 "拳击"、"燃烧"、"明天"等',
          },
        },
        required: ['topic'],
      },
      ['明日之丈', 'ashitano', 'joe', '矢吹丈', '燃え尽き', '拳击', 'ボクシング']
    );
  }

  protected async _execute(params: ToolParameters): Promise<ToolResult> {
    const topic = (params['topic'] as string) || '通用';
    let selectedQuotes: string[] = this.joeResponses['通用'] || []; // 添加 fallback

    // 尝试根据主题精确匹配
    for (const key in this.joeResponses) {
      if (topic.toLowerCase().includes(key.toLowerCase())) {
        selectedQuotes = this.joeResponses[key] || [];
        break;
      }
    }
    
    const response = selectedQuotes.join('\n');
    
    return {
      success: true,
      data: `关于'${topic}'的《明日之丈》语录:\n${response}`,
    };
  }
}
