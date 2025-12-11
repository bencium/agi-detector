declare module 'user-agents' {
  interface UserAgentOptions {
    deviceCategory?: 'desktop' | 'mobile' | 'tablet';
    platform?: string;
  }

  class UserAgent {
    constructor(options?: UserAgentOptions);
    toString(): string;
    data: {
      userAgent: string;
      appName: string;
      connection?: {
        type?: string;
      };
      platform: string;
      pluginsLength: number;
      screenHeight: number;
      screenWidth: number;
      vendor: string;
      viewportHeight: number;
      viewportWidth: number;
      deviceCategory: string;
    };
    random(): UserAgent;
  }

  export = UserAgent;
}
