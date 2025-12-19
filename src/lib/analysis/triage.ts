export type TriageResult = {
  skip: boolean;
  reason?: string;
  matches?: string[];
};

const NOISE_KEYWORDS = [
  'funding',
  'series',
  'seed round',
  'raises',
  'raised',
  'investment',
  'valuation',
  'acquired',
  'acquisition',
  'merger',
  'ipo',
  'earnings',
  'revenue',
  'quarter',
  'profit',
  'loss',
  'pricing',
  'subscription',
  'plan',
  'billing',
  'product update',
  'feature update',
  'release notes',
  'roadmap',
  'partnership',
  'collaboration',
  'conference',
  'summit',
  'webinar',
  'hackathon',
  'sponsor',
  'hiring',
  'job opening',
  'careers',
  'appointed',
  'joins as',
  'ceo',
  'cto',
  'cfo',
  'award',
  'community update',
  'policy update',
  'terms of service',
  'privacy policy'
  ,
  '融资',
  '估值',
  '收购',
  '并购',
  '发布会',
  '合作',
  '招聘',
  '岗位',
  '公告',
  '政策',
  '服务条款',
  '隐私政策'
];

const CAPABILITY_KEYWORDS = [
  'benchmark',
  'state of the art',
  'sota',
  'accuracy',
  'score',
  'outperforms',
  'surpasses',
  'achieves',
  'generalization',
  'reasoning',
  'planning',
  'agent',
  'autonomous',
  'multimodal',
  'vision',
  'language',
  'training',
  'model',
  'architecture',
  'scaling',
  'parameters',
  'evaluation',
  'dataset',
  'paper',
  'arxiv',
  'preprint',
  'novel',
  'algorithm',
  'compute',
  'capability',
  'performance',
  'human-level',
  'superhuman',
  'arc',
  'mmlu',
  'gpqa',
  'swe-bench',
  'gsm8k',
  'hellaswag',
  'imagenet',
  'big-bench'
  ,
  '基准',
  '评测',
  '准确率',
  '得分',
  '性能',
  '泛化',
  '推理',
  '规划',
  '多模态',
  '模型',
  '架构',
  '训练',
  '参数',
  '数据集',
  '论文',
  '预印本',
  '算法',
  '能力',
  '人类水平'
];

export function runLayer0Triage(input: {
  title: string;
  content: string;
  source?: string | null;
}): TriageResult {
  const text = `${input.title || ''} ${input.content || ''}`.toLowerCase();
  const wordCount = (input.content || '').split(/\s+/).filter(Boolean).length;

  const hasCapability = CAPABILITY_KEYWORDS.some((kw) => text.includes(kw));
  const noiseMatches = NOISE_KEYWORDS.filter((kw) => text.includes(kw));

  if (!hasCapability && wordCount < 120) {
    return {
      skip: true,
      reason: 'Short update without capability signals'
    };
  }

  if (!hasCapability && noiseMatches.length > 0) {
    return {
      skip: true,
      reason: `Noise keywords: ${noiseMatches.slice(0, 3).join(', ')}`,
      matches: noiseMatches
    };
  }

  return { skip: false };
}
