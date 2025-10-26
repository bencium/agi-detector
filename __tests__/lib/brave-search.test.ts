import axios from 'axios';
import { braveWebSearch, _clearBraveCache } from '@/lib/brave-search';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('braveWebSearch', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetAllMocks();
    _clearBraveCache();
    process.env = { ...OLD_ENV, BRAVE_API_KEY: 'test-key' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns normalized docs and sets header/token', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        web: { results: [
          { title: 'Post 1', url: 'https://example.com/1', description: 'Snippet 1' },
          { title: 'Post 2', url: 'https://example.com/2', description: 'Snippet 2' },
        ]}
      }
    } as any);

    const docs = await braveWebSearch('site:example.com', { count: 3, freshness: 'pd' });
    expect(docs).toHaveLength(2);
    expect(docs[0]).toEqual({ title: 'Post 1', url: 'https://example.com/1', snippet: 'Snippet 1' });
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/web/search'), expect.objectContaining({
      headers: { 'X-Subscription-Token': 'test-key' },
      params: expect.objectContaining({ q: 'site:example.com', count: 3, freshness: 'pd' })
    }));
  });

  it('returns empty when no API key', async () => {
    process.env.BRAVE_API_KEY = '';
    const docs = await braveWebSearch('site:example.com');
    expect(docs).toEqual([]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('caches results for 10 minutes', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { web: { results: [] } } } as any);
    await braveWebSearch('site:cache.test');
    await braveWebSearch('site:cache.test');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

