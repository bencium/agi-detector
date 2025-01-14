'use client';

import React, { useState, useEffect } from 'react';

interface CrawlResult {
  id: string;
  title: string;
  url: string;
  content: string;
  metadata: {
    source: string;
    timestamp: string;
  };
}

interface AnalysisResult {
  id: string;
  score: number;
  confidence: number;
  indicators: string[];
  explanation: string;
}

const MONITORED_SOURCES = [
  { id: 'openai', name: 'OpenAI Blog' },
  { id: 'deepmind', name: 'DeepMind Research' },
  { id: 'anthropic', name: 'Anthropic Updates' },
  { id: 'microsoft', name: 'Microsoft AI News' },
  { id: 'ibm', name: 'IBM Research Blog' },
];

const MONITORED_INDICATORS = [
  { id: 'perf-leaps', text: 'Unexplained AI performance leaps' },
  { id: 'self-improve', text: 'Self-improvement capabilities' },
  { id: 'cross-domain', text: 'Cross-domain knowledge transfer' },
  { id: 'autonomous', text: 'Autonomous behavior patterns' },
];

const KEY_SOURCES = [
  { id: 'openai', text: 'OpenAI Blog' },
  { id: 'deepmind', text: 'DeepMind Research' },
  { id: 'anthropic', text: 'Anthropic Updates' },
  { id: 'microsoft', text: 'Microsoft AI Research' },
];

// Add a function to check if it's time for the daily crawl
const shouldRunDailyCrawl = (lastRunTime: string | null): boolean => {
  if (!lastRunTime) return true;
  
  const lastRun = new Date(lastRunTime);
  const now = new Date();
  
  // Check if it's been 24 hours since the last run
  return now.getTime() - lastRun.getTime() >= 24 * 60 * 60 * 1000;
};

export default function Home(): React.ReactElement {
  const [crawlResults, setCrawlResults] = useState<CrawlResult[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoCrawling, setIsAutoCrawling] = useState(false);
  const [lastCrawlTime, setLastCrawlTime] = useState<string | null>(null);
  const [nextScheduledCrawl, setNextScheduledCrawl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Function to format dates
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  const analyzeData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/analyze', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setAnalyses(prev => [...prev, data.data]);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    }
    setIsLoading(false);
  };

  const startCrawling = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/crawl', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setCrawlResults(prev => [...prev, ...data.data]);
        const now = new Date();
        setLastCrawlTime(now.toISOString());
        
        // Schedule next crawl
        const nextCrawl = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        setNextScheduledCrawl(nextCrawl.toISOString());

        // Automatically analyze new results
        await analyzeData();
      } else {
        throw new Error(data.error || 'Failed to crawl sources');
      }
    } catch (error) {
      console.error('Crawling failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to crawl sources');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-crawling check interval (checks every hour)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isAutoCrawling) {
      // Initial check and crawl if needed
      if (shouldRunDailyCrawl(lastCrawlTime)) {
        startCrawling();
      } else if (lastCrawlTime) {
        // Set next scheduled crawl time
        const lastCrawl = new Date(lastCrawlTime);
        const nextCrawl = new Date(lastCrawl.getTime() + 24 * 60 * 60 * 1000);
        setNextScheduledCrawl(nextCrawl.toISOString());
      }
      
      // Check every hour if it's time to crawl
      intervalId = setInterval(() => {
        if (shouldRunDailyCrawl(lastCrawlTime)) {
          startCrawling();
        }
      }, 60 * 60 * 1000); // Check every hour
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoCrawling, lastCrawlTime]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="p-8">
          <h1 className="text-4xl font-bold mb-6 text-black">AGI Detection Dashboard</h1>
          
          <div className="bg-white/5 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-black">About AGI Detector</h2>
            <p className="text-black mb-4">
              An advanced monitoring system designed to detect early signs of Artificial General Intelligence (AGI) by analyzing patterns across multiple domains. Our system continuously monitors research breakthroughs, technological advancements, and anomalous patterns that might indicate the emergence of AGI.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <h3 className="font-semibold mb-1">Monitored Indicators:</h3>
                <ul className="list-disc list-inside">
                  {MONITORED_INDICATORS.map(indicator => (
                    <li key={indicator.id} className="text-black">
                      {indicator.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Key Sources:</h3>
                <ul className="list-disc list-inside">
                  {KEY_SOURCES.map(source => (
                    <li key={source.id} className="text-black">
                      {source.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <div key="feature-1" className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-black">🔍 Comprehensive Monitoring</h3>
                <p className="text-sm text-black">Tracks AI research papers, news sites, company blogs, and social media for breakthrough indicators</p>
              </div>
              <div key="feature-2" className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-black">🧠 Advanced Analysis</h3>
                <p className="text-sm text-black">Uses NLP to analyze content for signs of AI self-improvement, cross-domain learning, and autonomous behavior</p>
              </div>
              <div key="feature-3" className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-black">⚡ Real-time Alerts</h3>
                <p className="text-sm text-black">Instant notifications for significant developments or anomalous patterns in AI advancement</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stats Overview */}
            <div key="stat-1" className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-black mb-2">Sources Monitored</h3>
              <p className="text-3xl font-bold text-blue-600">{crawlResults.length}</p>
            </div>
            <div key="stat-2" className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-black mb-2">Potential Indicators</h3>
              <p className="text-3xl font-bold text-yellow-600">{analyses.length}</p>
            </div>
            <div key="stat-3" className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-black mb-2">AGI Likelihood Assessment</h3>
              <p className="text-3xl font-bold text-green-600">
                {analyses.length > 0 ? 'Medium' : 'Low'}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Findings */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold text-black mb-4">Recent Findings</h2>
              <div className="space-y-4">
                {crawlResults.length === 0 ? (
                  <p className="text-black">No recent findings to display.</p>
                ) : (
                  crawlResults.map((result) => (
                    <div key={result.id} className="border-b border-gray-200 pb-4">
                      <h3 className="font-semibold text-black">{result.title}</h3>
                      <p className="text-sm text-black">{result.url}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Monitored Sources */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold text-black mb-4">Monitored Sources</h2>
              <ul className="space-y-2">
                {MONITORED_SOURCES.map(source => (
                  <li key={source.id} className="text-black">
                    {source.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 space-y-4">
            <div className="flex gap-4">
              <button
                onClick={() => setIsAutoCrawling(!isAutoCrawling)}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  isAutoCrawling 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isAutoCrawling ? 'Stop Auto-Crawling' : 'Start Auto-Crawling'}
              </button>
              <button
                onClick={startCrawling}
                disabled={isLoading || isAutoCrawling}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Manual Crawl'}
              </button>
              <button
                onClick={analyzeData}
                disabled={isLoading || crawlResults.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Analyze Data
              </button>
            </div>
            
            {/* Status Information */}
            <div className="text-sm space-y-1">
              {lastCrawlTime && (
                <p className="text-black">Last crawl: {formatDateTime(new Date(lastCrawlTime))}</p>
              )}
              {isAutoCrawling && nextScheduledCrawl && (
                <p className="text-green-600">
                  Next scheduled crawl: {formatDateTime(new Date(nextScheduledCrawl))}
                </p>
              )}
              {error && (
                <p className="text-red-600">{error}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
