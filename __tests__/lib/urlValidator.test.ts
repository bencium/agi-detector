import { isUrlSafe, isUrlSafeWithDns } from '@/lib/security/urlValidator';

jest.mock('dns/promises', () => ({
  lookup: jest.fn()
}));

const { lookup } = jest.requireMock('dns/promises') as { lookup: jest.Mock };

describe('urlValidator', () => {
  beforeEach(() => {
    lookup.mockReset();
  });

  it('blocks localhost and private IPv4', () => {
    expect(isUrlSafe('http://localhost').safe).toBe(false);
    expect(isUrlSafe('http://127.0.0.1').safe).toBe(false);
    expect(isUrlSafe('http://10.0.0.1').safe).toBe(false);
    expect(isUrlSafe('http://192.168.1.2').safe).toBe(false);
  });

  it('blocks loopback IPv6', () => {
    expect(isUrlSafe('http://[::1]').safe).toBe(false);
  });

  it('allows public hostnames', () => {
    expect(isUrlSafe('https://example.com').safe).toBe(true);
  });

  it('blocks hostnames that resolve to private IPs', async () => {
    lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    const result = await isUrlSafeWithDns('https://example.com');
    expect(result.safe).toBe(false);
  });

  it('allows hostnames that resolve to public IPs', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const result = await isUrlSafeWithDns('https://example.com');
    expect(result.safe).toBe(true);
  });
});
