/**
 * Hugging Face Integration
 *
 * Monitors Hugging Face for:
 * - Trending models and datasets
 * - Model leaderboards (Open LLM Leaderboard)
 * - AGI-relevant benchmarks (GAIA, AGIEval, etc.)
 */

import axios from 'axios';

const HF_API_BASE = 'https://huggingface.co/api';
const RATE_LIMIT_DELAY = 500; // 500ms between requests

interface HuggingFaceItem {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    timestamp: string;
    id: string;
    itemType: 'model' | 'dataset' | 'space';
    downloads?: number;
    likes?: number;
    tags: string[];
    createdAt?: string;
  };
}

// AGI-relevant model tags
const AGI_MODEL_TAGS = [
  'text-generation',
  'question-answering',
  'zero-shot-classification',
  'reinforcement-learning',
  'conversational',
  'reasoning',
];

// AGI-relevant dataset tags
const AGI_DATASET_TAGS = [
  'gaia-benchmark',
  'agi-eval',
  'mmlu',
  'reasoning',
  'multi-task',
  'zero-shot',
  'few-shot',
];

/**
 * Get trending models from Hugging Face
 */
export async function getTrendingModels(limit: number = 20): Promise<HuggingFaceItem[]> {
  try {
    console.log('[Hugging Face] Fetching trending models...');

    const response = await axios.get(`${HF_API_BASE}/models`, {
      params: {
        sort: 'trending',
        limit,
        full: true,
      },
      timeout: 30000,
    });

    const items: HuggingFaceItem[] = [];

    for (const model of response.data) {
      // Filter for AGI-relevant tags
      const hasAGITag = model.tags?.some((tag: string) =>
        AGI_MODEL_TAGS.some(agiTag => tag.includes(agiTag))
      );

      if (!hasAGITag && items.length > limit / 2) continue; // Skip non-AGI models after getting enough

      items.push({
        title: model.modelId || model.id,
        content: model.description || model.modelId || '',
        url: `https://huggingface.co/${model.modelId || model.id}`,
        metadata: {
          source: 'Hugging Face Models',
          timestamp: new Date().toISOString(),
          id: model.id || model.modelId,
          itemType: 'model',
          downloads: model.downloads,
          likes: model.likes,
          tags: model.tags || [],
          createdAt: model.createdAt,
        },
      });
    }

    console.log(`[Hugging Face] Found ${items.length} trending models`);
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

    return items;

  } catch (error: any) {
    console.error('[Hugging Face] Error fetching models:', error.message);
    return [];
  }
}

/**
 * Get AGI-relevant datasets
 */
export async function getAGIDatasets(limit: number = 20): Promise<HuggingFaceItem[]> {
  try {
    console.log('[Hugging Face] Fetching AGI-relevant datasets...');

    const response = await axios.get(`${HF_API_BASE}/datasets`, {
      params: {
        sort: 'downloads',
        limit: limit * 2, // Fetch more to filter
        full: true,
      },
      timeout: 30000,
    });

    const items: HuggingFaceItem[] = [];

    for (const dataset of response.data) {
      // Check for AGI-relevant tags or keywords
      const hasAGITag = dataset.tags?.some((tag: string) =>
        AGI_DATASET_TAGS.some(agiTag => tag.toLowerCase().includes(agiTag.toLowerCase()))
      );

      const hasAGIKeyword = (dataset.id || '').toLowerCase().includes('agi') ||
                            (dataset.id || '').toLowerCase().includes('reasoning') ||
                            (dataset.id || '').toLowerCase().includes('mmlu') ||
                            (dataset.id || '').toLowerCase().includes('gaia');

      if (!hasAGITag && !hasAGIKeyword) continue;

      items.push({
        title: dataset.id,
        content: dataset.description || dataset.id,
        url: `https://huggingface.co/datasets/${dataset.id}`,
        metadata: {
          source: 'Hugging Face Datasets',
          timestamp: new Date().toISOString(),
          id: dataset.id,
          itemType: 'dataset',
          downloads: dataset.downloads,
          likes: dataset.likes,
          tags: dataset.tags || [],
          createdAt: dataset.createdAt,
        },
      });

      if (items.length >= limit) break;
    }

    console.log(`[Hugging Face] Found ${items.length} AGI datasets`);
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

    return items;

  } catch (error: any) {
    console.error('[Hugging Face] Error fetching datasets:', error.message);
    return [];
  }
}

/**
 * Search for specific AGI-related content
 */
export async function searchHuggingFace(query: string): Promise<HuggingFaceItem[]> {
  try {
    console.log(`[Hugging Face] Searching for: "${query}"`);

    const [models, datasets] = await Promise.all([
      axios.get(`${HF_API_BASE}/models`, {
        params: { search: query, limit: 10 },
        timeout: 30000,
      }),
      axios.get(`${HF_API_BASE}/datasets`, {
        params: { search: query, limit: 10 },
        timeout: 30000,
      }),
    ]);

    const items: HuggingFaceItem[] = [];

    // Add models
    for (const model of models.data) {
      items.push({
        title: model.modelId || model.id,
        content: model.description || '',
        url: `https://huggingface.co/${model.modelId || model.id}`,
        metadata: {
          source: 'Hugging Face',
          timestamp: new Date().toISOString(),
          id: model.id || model.modelId,
          itemType: 'model',
          downloads: model.downloads,
          likes: model.likes,
          tags: model.tags || [],
        },
      });
    }

    // Add datasets
    for (const dataset of datasets.data) {
      items.push({
        title: dataset.id,
        content: dataset.description || '',
        url: `https://huggingface.co/datasets/${dataset.id}`,
        metadata: {
          source: 'Hugging Face',
          timestamp: new Date().toISOString(),
          id: dataset.id,
          itemType: 'dataset',
          downloads: dataset.downloads,
          likes: dataset.likes,
          tags: dataset.tags || [],
        },
      });
    }

    console.log(`[Hugging Face] Search found ${items.length} items`);
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

    return items;

  } catch (error: any) {
    console.error('[Hugging Face] Search error:', error.message);
    return [];
  }
}

/**
 * Comprehensive Hugging Face monitoring
 */
export async function fetchAllHuggingFaceSources(): Promise<HuggingFaceItem[]> {
  console.log('[Hugging Face] Starting comprehensive monitoring...');

  const results: HuggingFaceItem[] = [];

  // 1. Trending models
  const models = await getTrendingModels(15);
  results.push(...models);

  // 2. AGI datasets
  const datasets = await getAGIDatasets(15);
  results.push(...datasets);

  // 3. Search for key terms
  const keywords = ['AGI', 'reasoning', 'GAIA'];
  for (const keyword of keywords) {
    const searchResults = await searchHuggingFace(keyword);
    results.push(...searchResults);
  }

  // Deduplicate by ID
  const unique = Array.from(
    new Map(results.map(item => [item.metadata.id, item])).values()
  );

  console.log(`[Hugging Face] Total unique items: ${unique.length}`);
  return unique;
}

/**
 * Calculate boost based on Hugging Face popularity
 */
export function getHuggingFaceBoost(item: HuggingFaceItem): number {
  let boost = 1.0;

  // Downloads indicate real usage
  if (item.metadata.downloads) {
    if (item.metadata.downloads > 100000) {
      boost *= 1.3; // 30% boost for >100k downloads
    } else if (item.metadata.downloads > 10000) {
      boost *= 1.2; // 20% boost for >10k downloads
    } else if (item.metadata.downloads > 1000) {
      boost *= 1.1; // 10% boost for >1k downloads
    }
  }

  // Likes indicate community approval
  if (item.metadata.likes) {
    if (item.metadata.likes > 1000) {
      boost *= 1.25; // 25% boost for >1k likes
    } else if (item.metadata.likes > 100) {
      boost *= 1.15; // 15% boost for >100 likes
    }
  }

  // AGI-specific tags
  const hasAGITag = item.metadata.tags.some(tag =>
    ['agi', 'reasoning', 'gaia', 'mmlu'].some(keyword =>
      tag.toLowerCase().includes(keyword)
    )
  );

  if (hasAGITag) {
    boost *= 1.2; // 20% boost for AGI tags
  }

  return Math.min(boost, 2.0); // Cap at 2x
}
