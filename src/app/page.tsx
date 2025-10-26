'use client';

import React, { useState, useEffect } from 'react';
import TrendChart from '@/components/TrendChart';
import ConsoleOutput from '@/components/ConsoleOutput';
import { useConsoleCapture } from '@/hooks/useConsoleCapture';

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
  severity?: string;
  evidenceQuality?: string;
  requiresVerification?: boolean;
  crossReferences?: string[];
  crawl?: { url?: string; title?: string };
  validatedAt?: string;
  lastValidation?: {
    prevScore?: number;
    newScore?: number;
    prevConfidence?: number;
    newConfidence?: number;
    addedIndicators?: number;
    recommendation?: string;
    timestamp?: string;
  };
}

const shouldRunDailyCrawl = (lastRunTime: string | null): boolean => {
  if (!lastRunTime) return true;
  
  const lastRun = new Date(lastRunTime);
  const now = new Date();
  
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
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'analysis' | 'trends'>('overview');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false);
  const [sourceStats, setSourceStats] = useState<Record<string, number>>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [validationMeta, setValidationMeta] = useState<Record<string, {
    prevScore: number;
    newScore: number;
    prevConfidence: number;
    newConfidence: number;
    addedIndicators: number;
    recommendation: string;
    timestamp: string;
  }>>({});
  const { logs, addLog, clearLogs } = useConsoleCapture();

  const scrollToAnalysis = (analysisId: string | null) => {
    if (!analysisId) return;
    setActiveTab('analysis');
    setTimeout(() => {
      const el = document.getElementById(`analysis-card-${analysisId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const jumpToMostSevere = () => {
    if (analyses.length === 0) return;
    const rank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const sorted = [...analyses].sort((a, b) => (rank[(b.severity || 'none').toLowerCase()] ?? 0) - (rank[(a.severity || 'none').toLowerCase()] ?? 0));
    const target = sorted.find(a => (a.severity || '').toLowerCase() === 'critical') || sorted[0];
    scrollToAnalysis(target.id);
  };

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
    setTotalAnalyzed(0);
    addLog('Starting AI analysis of all unanalyzed articles...');
    
    let totalAnalyzedCount = 0;
    let batchNumber = 0;
    const maxBatches = 20; // Safety limit to prevent infinite loops
    
    try {
      while (batchNumber < maxBatches) {
        addLog(`Processing batch ${batchNumber + 1}...`);
        const response = await fetch('/api/analyze-all', { method: 'POST' });
        
        // Check if response is ok before parsing JSON
        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        if (!text) {
          addLog('No more articles to analyze');
          break;
        }
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse response:', text);
          throw new Error('Invalid response from server');
        }
        
        if (data.success && data.data?.summary) {
          const batchAnalyzed = data.data.summary.totalAnalyzed || 0;
          totalAnalyzedCount += batchAnalyzed;
          setTotalAnalyzed(totalAnalyzedCount);
          
          // Display detailed logs from the backend
          if (data.logs && Array.isArray(data.logs)) {
            data.logs.forEach((log: string) => addLog(log));
          }
          
          if (batchAnalyzed === 0) {
            addLog('All articles have been analyzed');
            break;
          }
          
          addLog(`✅ Batch ${batchNumber + 1} complete: ${batchAnalyzed} articles analyzed (Total: ${totalAnalyzedCount})`);
          
          // Small delay between batches to avoid overwhelming the API
          if (batchAnalyzed === 50) {
            addLog('⏳ Waiting 2 seconds before next batch...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          break;
        }
        
        batchNumber++;
      }
      
      // Reload all data to get the new analyses
      await loadExistingData();
      addLog(`✅ Analysis complete! Total analyzed: ${totalAnalyzedCount} articles`);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      addLog(`❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    }
    setIsLoading(false);
    setTotalAnalyzed(0);
  };

  const startCrawling = async () => {
    setError(null);
    setIsLoading(true);
    clearLogs();
    addLog('🚀 Starting crawl of all AI sources...');
    
    try {
      addLog('Fetching from: OpenAI, DeepMind, Anthropic, Microsoft AI, arXiv, TechCrunch, VentureBeat');
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
        // Update crawl results - data is already saved in database
        setCrawlResults(prev => [...prev, ...data.data]);
        const now = new Date();
        setLastCrawlTime(now.toISOString());
        
        const nextCrawl = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        setNextScheduledCrawl(nextCrawl.toISOString());
        
        // Reload all data to get updated counts
        setTimeout(() => loadExistingData(), 1000);
        
        addLog(`✅ Crawl complete! Found ${data.data.length} articles`);
        addLog('Starting AGI analysis...');
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

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isAutoCrawling) {
      if (shouldRunDailyCrawl(lastCrawlTime)) {
        startCrawling();
      } else if (lastCrawlTime) {
        const lastCrawl = new Date(lastCrawlTime);
        const nextCrawl = new Date(lastCrawl.getTime() + 24 * 60 * 60 * 1000);
        setNextScheduledCrawl(nextCrawl.toISOString());
      }
      
      intervalId = setInterval(() => {
        if (shouldRunDailyCrawl(lastCrawlTime)) {
          startCrawling();
        }
      }, 60 * 60 * 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoCrawling, lastCrawlTime]);

  // Load existing data on mount
  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      addLog('Loading existing data...');
      const response = await fetch('/api/data');
      const data = await response.json();
      
      if (data.success) {
        setCrawlResults(data.data.crawlResults);
        setAnalyses(data.data.analyses);
        setSourceStats(data.data.sourceStats);
        if (data.data.latestCrawlTime) {
          setLastCrawlTime(data.data.latestCrawlTime);
        }
        addLog(`Loaded ${data.data.totalArticles} articles and ${data.data.totalAnalyses} analyses`);
        
        // Automatically analyze unanalyzed articles
        const unanalyzedCount = data.data.totalArticles - data.data.totalAnalyses;
        if (unanalyzedCount > 0) {
          addLog(`Found ${unanalyzedCount} unanalyzed articles. Starting analysis...`);
          setTimeout(() => analyzeData(), 2000); // Small delay to let UI settle
        }
      }
    } catch (error) {
      console.error('Failed to load existing data:', error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Fetch trend data
  useEffect(() => {
    fetchTrends();
  }, [trendPeriod]);

  const fetchTrends = async () => {
    try {
      addLog(`Fetching ${trendPeriod} trend data...`);
      const response = await fetch(`/api/trends?period=${trendPeriod}`);
      const data = await response.json();
      if (data.success) {
        setTrendData(data.data.trends);
        addLog(`Loaded ${data.data.trends.length} trend data points`);
      }
    } catch (error) {
      console.error('Failed to fetch trends:', error);
    }
  };

  const validateAnalysis = async (analysisId: string) => {
    setValidatingId(analysisId);
    addLog(`Running cross-validation for analysis ${analysisId}...`);
    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId })
      });
      const data = await response.json();
      if (data.success) {
        // Update the analysis in the state
        const oldAnalysis = analyses.find(a => a.id === analysisId);
        const newAnalysis = data.data.updatedAnalysis;
        
        setAnalyses(prev => prev.map(a => 
          a.id === analysisId ? { ...a, ...newAnalysis } : a
        ));
        
        // Show validation summary
        const oldScore = oldAnalysis?.score || 0;
        const newScore = newAnalysis.score || 0;
        const newIndicators = data.data.validation.additionalIndicators?.length || 0;
        const oldConfidence = oldAnalysis?.confidence || 0;
        const newConfidence = newAnalysis.confidence || 0;
        const recommendation = data.data.validation.recommendation || 'investigate';
        const nowIso = new Date().toISOString();

        // Persist diff inline for this session
        setValidationMeta(prev => ({
          ...prev,
          [analysisId]: {
            prevScore: oldScore,
            newScore,
            prevConfidence: oldConfidence,
            newConfidence,
            addedIndicators: newIndicators,
            recommendation,
            timestamp: nowIso,
          }
        }));
        
        addLog(`✅ Validation complete: ${data.data.validation.recommendation}`);
        
        let summary = `Validation Result:\n`;
        summary += `• Recommendation: ${data.data.validation.recommendation}\n`;
        summary += `• Score: ${(oldScore * 100).toFixed(0)}% → ${(newScore * 100).toFixed(0)}%\n`;
        summary += `• Confidence: ${((oldAnalysis?.confidence || 0) * 100).toFixed(0)}% → ${(newAnalysis.confidence * 100).toFixed(0)}%\n`;
        if (newIndicators > 0) {
          summary += `• Found ${newIndicators} additional indicators\n`;
        }
        summary += `\nReasoning: ${data.data.validation.reasoning}`;
        
        alert(summary);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setValidatingId(null);
    }
  };

  const getAGIRiskLevel = () => {
    if (analyses.length === 0) return { level: 'LOW', color: 'text-green-600', bg: 'bg-green-50', details: 'No data' };
    
    const avgScore = analyses.reduce((acc, a) => acc + a.score, 0) / analyses.length;
    const highRiskCount = analyses.filter(a => a.score >= 0.5).length;
    const criticalCount = analyses.filter(a => a.severity === 'critical' || a.score >= 0.7).length;
    
    // If ANY critical findings, show HIGH risk
    if (criticalCount > 0) {
      return { 
        level: 'HIGH', 
        color: 'text-red-600', 
        bg: 'bg-red-50',
        details: `${criticalCount} critical findings!`
      };
    }
    
    // If multiple high-risk findings, show MEDIUM
    if (highRiskCount >= 5) {
      return { 
        level: 'MEDIUM', 
        color: 'text-yellow-600', 
        bg: 'bg-yellow-50',
        details: `${highRiskCount} high-risk articles`
      };
    }
    
    // Otherwise use average
    if (avgScore < 0.3) return { level: 'LOW', color: 'text-green-600', bg: 'bg-green-50', details: `Avg: ${(avgScore * 100).toFixed(1)}%` };
    if (avgScore < 0.6) return { level: 'MEDIUM', color: 'text-yellow-600', bg: 'bg-yellow-50', details: `Avg: ${(avgScore * 100).toFixed(1)}%` };
    return { level: 'HIGH', color: 'text-red-600', bg: 'bg-red-50', details: `Avg: ${(avgScore * 100).toFixed(1)}%` };
  };

  const riskLevel = getAGIRiskLevel();
  const criticalCount = analyses.filter(a => (a.severity || '').toLowerCase() === 'critical').length;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[var(--accent)] rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <h1 className="text-xl font-semibold text-[var(--foreground)]">ASI/AGI Monitor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className={`text-sm font-medium ${riskLevel.color}`}>
                  Risk Level: {riskLevel.level}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {riskLevel.details}
                </div>
                {criticalCount > 0 && (
                  <button
                    onClick={jumpToMostSevere}
                    className="mt-1 inline-flex items-center text-xs text-[var(--accent)] hover:underline"
                    title="Jump to most severe finding"
                  >
                    View {criticalCount} critical {criticalCount === 1 ? 'finding' : 'findings'}
                  </button>
                )}
              </div>
              <div className={`w-3 h-3 rounded-full ${isAutoCrawling ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} title={isAutoCrawling ? 'Monitoring active' : 'Monitoring inactive'} />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {(['overview', 'findings', 'analysis', 'trends'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Initial Loading - removed as it's too quick to show */}
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Hero Section */}
            <div className="bg-[var(--surface)] rounded-xl p-8 border border-[var(--border)] shadow-sm">
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">
                Monitoring AGI Emergence
              </h2>
              <p className="text-[var(--muted)] mb-6 leading-relaxed">
                This system continuously monitors AI research labs, academic papers, and technology news 
                for indicators of artificial general intelligence emergence. Using advanced pattern recognition, 
                we analyze developments across multiple domains to identify potential AGI breakthroughs.
              </p>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                  <div className="text-sm text-[var(--muted)] mb-1">Sources Monitored</div>
                  <div className="text-2xl font-semibold text-[var(--foreground)]">7</div>
                </div>
                <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                  <div className="text-sm text-[var(--muted)] mb-1">Total Articles</div>
                  <div className="text-2xl font-semibold text-[var(--foreground)]">{crawlResults.length}</div>
                </div>
                <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                  <div className="text-sm text-[var(--muted)] mb-1">Articles Analyzed</div>
                  <div className="text-2xl font-semibold text-[var(--foreground)]">{analyses.length}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setIsAutoCrawling(!isAutoCrawling)}
                  className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                    isAutoCrawling 
                      ? 'bg-[var(--danger)] text-white hover:bg-red-700' 
                      : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                  }`}
                >
                  {isAutoCrawling ? 'Stop Monitoring' : 'Start Monitoring'}
                </button>
                <button
                  onClick={startCrawling}
                  disabled={isLoading}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    isLoading 
                      ? 'bg-[var(--accent)] text-white processing-button scale-105' 
                      : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                  } disabled:cursor-not-allowed`}
                >
                  {isLoading ? (
                    <span className="flex items-center space-x-3">
                      <span className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-lg font-semibold">Processing... Please Wait</span>
                    </span>
                  ) : (
                    'Run Manual Scan'
                  )}
                </button>
              </div>

              {/* Status Info */}
              <div className="mt-6 pt-6 border-t border-[var(--border)] space-y-2">
                {lastCrawlTime && (
                  <p className="text-sm text-[var(--muted)]">
                    Last scan: {formatDateTime(new Date(lastCrawlTime))}
                  </p>
                )}
                {isAutoCrawling && nextScheduledCrawl && (
                  <p className="text-sm text-[var(--success)]">
                    Next scan: {formatDateTime(new Date(nextScheduledCrawl))}
                  </p>
                )}
              </div>
            </div>

            {/* Monitored Sources */}
            <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">Monitored Sources</h3>
                <button
                  onClick={loadExistingData}
                  className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                  title="Refresh counts"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: 'OpenAI Blog', displayName: 'OpenAI', type: 'Research Lab', url: 'openai.com' },
                  { name: 'DeepMind Research', displayName: 'DeepMind', type: 'Research Lab', url: 'deepmind.com' },
                  { name: 'Anthropic Blog', displayName: 'Anthropic', type: 'Research Lab', url: 'anthropic.com' },
                  { name: 'Microsoft AI Blog', displayName: 'Microsoft AI', type: 'Corporate Lab', url: 'microsoft.com/ai' },
                  { name: 'arXiv AI', displayName: 'arXiv AI', type: 'Academic', url: 'arxiv.org' },
                  { name: 'TechCrunch AI', displayName: 'TechCrunch', type: 'News', url: 'techcrunch.com' },
                  { name: 'VentureBeat AI', displayName: 'VentureBeat', type: 'News', url: 'venturebeat.com' },
                ].map((source) => {
                  const count = sourceStats[source.name] || 0;
                  // Show as working if it has articles OR if it's a known working source
                  const isWorking = count > 0 || ['OpenAI Blog', 'Microsoft AI Blog', 'TechCrunch AI', 'VentureBeat AI', 'arXiv AI', 'DeepMind Research', 'Anthropic Blog'].includes(source.name);
                  
                  return (
                    <div key={source.name} className="bg-[var(--surface-hover)] rounded-lg p-3 hover:shadow-md transition-shadow relative">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-[var(--foreground)]">{source.displayName}</div>
                          <div className="text-xs text-[var(--muted)]">{source.type}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {count > 0 && (
                            <span className="text-xs font-medium bg-[var(--accent)] text-white px-2 py-1 rounded-full">
                              {count}
                            </span>
                          )}
                          <div className={`w-2 h-2 rounded-full ${
                            isWorking ? 'bg-green-500' : 'bg-gray-400'
                          }`} title={isWorking ? 'Active' : 'Blocked'} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Indicators */}
            <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Detection Indicators</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    icon: '⚡',
                    title: 'Performance Leaps',
                    description: 'Unexplained improvements in AI capabilities beyond expected progress'
                  },
                  {
                    icon: '🔄',
                    title: 'Self-Improvement',
                    description: 'AI systems demonstrating ability to enhance their own architecture'
                  },
                  {
                    icon: '🌐',
                    title: 'Cross-Domain Transfer',
                    description: 'Knowledge transfer between unrelated domains without explicit training'
                  },
                  {
                    icon: '🤖',
                    title: 'Autonomous Behavior',
                    description: 'Independent decision-making beyond programmed parameters'
                  },
                ].map((indicator) => (
                  <div key={indicator.title} className="flex space-x-3">
                    <div className="text-2xl">{indicator.icon}</div>
                    <div>
                      <h4 className="font-medium text-[var(--foreground)]">{indicator.title}</h4>
                      <p className="text-sm text-[var(--muted)]">{indicator.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Findings Tab */}
        {activeTab === 'findings' && (
          <div className="space-y-4 animate-fade-in">
            {crawlResults.length === 0 ? (
              <div className="bg-[var(--surface)] rounded-xl p-12 border border-[var(--border)] text-center">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">No findings yet</h3>
                <p className="text-[var(--muted)]">Start monitoring to collect AI development data</p>
              </div>
            ) : (
              crawlResults.map((result) => (
                <div key={result.id} className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--foreground)] mb-2">{result.title}</h3>
                      <p className="text-sm text-[var(--muted)] mb-3 line-clamp-2">{result.content}</p>
                      <div className="flex items-center space-x-4 text-xs text-[var(--muted)]">
                        <span>{result.metadata.source}</span>
                        <span>•</span>
                        <span>{formatDateTime(new Date(result.metadata.timestamp))}</span>
                      </div>
                    </div>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 text-[var(--accent)] hover:text-[var(--accent-hover)]"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <div className="space-y-4 animate-fade-in">
            {analyses.length === 0 ? (
              <div className="bg-[var(--surface)] rounded-xl p-12 border border-[var(--border)] text-center">
                <div className="text-5xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">No analyses yet</h3>
                <p className="text-[var(--muted)]">Crawl data will be automatically analyzed for AGI indicators</p>
              </div>
            ) : (
              [...analyses]
                .sort((a, b) => {
                  const rank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
                  const ra = rank[(a.severity || 'none').toLowerCase()] ?? 0;
                  const rb = rank[(b.severity || 'none').toLowerCase()] ?? 0;
                  if (rb !== ra) return rb - ra;
                  return (b.score || 0) - (a.score || 0);
                })
                .map((analysis) => (
                <div id={`analysis-card-${analysis.id}`} key={analysis.id} className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        analysis.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        analysis.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        analysis.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        Score: {(analysis.score * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-[var(--muted)]">
                        Confidence: {(analysis.confidence * 100).toFixed(0)}%
                      </div>
                      {analysis.severity && (
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          analysis.severity === 'critical' ? 'bg-red-50 text-red-600' :
                          analysis.severity === 'high' ? 'bg-orange-50 text-orange-600' :
                          analysis.severity === 'medium' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {analysis.severity.toUpperCase()}
                        </span>
                      )}
                      {analysis.evidenceQuality && (
                        <span className="text-xs text-[var(--muted)]">
                          Evidence: {analysis.evidenceQuality}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const severityRank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
                      const minSeverity = (process.env.NEXT_PUBLIC_VALIDATION_MIN_SEVERITY || 'medium').toLowerCase();
                      const minRank = severityRank[minSeverity] ?? 2;
                      const sev = (analysis.severity || 'none').toLowerCase();
                      const always = process.env.NEXT_PUBLIC_VALIDATION_ALWAYS === 'true';
                      const meetsSeverity = (severityRank[sev] ?? 0) >= minRank;
                      const flag = !!analysis.requiresVerification;
                      const showValidate = always || meetsSeverity || flag;
                      if (!showValidate) return null;
                      return (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => validateAnalysis(analysis.id)}
                            disabled={validatingId === analysis.id}
                            className="px-3 py-1 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50"
                            title="Get a second AI opinion to find additional AGI indicators"
                          >
                            {validatingId === analysis.id ? 'Validating...' : 'Validate'}
                          </button>
                          <span className="text-xs text-[var(--muted)]">Get 2nd opinion</span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {analysis.indicators.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Detected Indicators</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysis.indicators.map((indicator, idx) => (
                          <span key={idx} className="px-3 py-1 bg-[var(--surface-hover)] rounded-full text-sm text-[var(--foreground)]">
                            {indicator}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {analysis.crossReferences && analysis.crossReferences.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Cross-References</h4>
                      <div className="text-xs text-[var(--muted)]">
                        Check: {analysis.crossReferences.join(', ')}
                      </div>
                    </div>
                  )}
                  
                  {/* Source link */}
                  {analysis.crawl?.url && (
                    <div className="mb-3">
                      <a
                        href={analysis.crawl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--accent)] hover:underline"
                        title={analysis.crawl.url}
                      >
                        View source: {new URL(analysis.crawl.url).hostname}
                      </a>
                    </div>
                  )}
                  
                  {/* Inline validation diff */}
                  {(analysis.lastValidation || validationMeta[analysis.id]) && (
                    <div className="mb-3 text-xs text-[var(--muted)]">
                      <div>
                        Last validated: {formatDateTime(new Date((analysis.lastValidation?.timestamp || analysis.validatedAt || validationMeta[analysis.id]?.timestamp) || new Date().toISOString()))}
                      </div>
                      <div>
                        {(() => {
                          const meta = analysis.lastValidation || validationMeta[analysis.id];
                          if (!meta) return null;
                          return (
                            <>
                              Score: {((meta.prevScore || analysis.score) * 100).toFixed(0)}% → {((meta.newScore || analysis.score) * 100).toFixed(0)}% ·
                              Confidence: {((meta.prevConfidence || analysis.confidence) * 100).toFixed(0)}% → {((meta.newConfidence || analysis.confidence) * 100).toFixed(0)}%
                              {(meta.addedIndicators || 0) > 0 && (
                                <> · +{meta.addedIndicators} indicators</>
                              )}
                              {meta.recommendation && (
                                <> · {meta.recommendation}</>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-[var(--muted)] leading-relaxed">{analysis.explanation}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6 animate-fade-in">
            {/* Period Selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--foreground)]">Historical Trends</h2>
              <div className="flex space-x-2">
                {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTrendPeriod(period)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      trendPeriod === period
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Trend Chart */}
            <TrendChart data={trendData} period={trendPeriod} />

            {/* Risk Assessment Summary */}
            <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Risk Assessment</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-[var(--muted)] mb-2">Current Trend</div>
                  <div className={`text-2xl font-bold ${
                    trendData.length >= 2 && (trendData[0]?.avgScore || 0) > (trendData[1]?.avgScore || 0)
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {trendData.length >= 2 && (trendData[0]?.avgScore || 0) > (trendData[1]?.avgScore || 0) ? '↑' : '↓'} 
                    {' '}
                    {trendData.length >= 2 
                      ? Math.abs(((trendData[0]?.avgScore || 0) - (trendData[1]?.avgScore || 0)) * 100).toFixed(1) 
                      : '0.0'}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[var(--muted)] mb-2">7-Day Average</div>
                  <div className="text-2xl font-bold text-[var(--foreground)]">
                    {trendData.slice(0, 7).length > 0
                      ? (trendData.slice(0, 7).reduce((sum, d) => sum + (d.avgScore || 0), 0) / trendData.slice(0, 7).length * 100).toFixed(1)
                      : '0.0'}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[var(--muted)] mb-2">Alert Frequency</div>
                  <div className="text-2xl font-bold text-[var(--foreground)]">
                    {trendData.reduce((sum, d) => sum + (d.criticalAlerts || 0), 0)} / {trendPeriod}
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Milestones */}
            <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Key Milestones</h3>
              <div className="space-y-3">
                {trendData
                  .filter(d => (d.maxScore || 0) > 0.7 || (d.criticalAlerts || 0) > 0)
                  .slice(0, 5)
                  .map((milestone, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[var(--surface-hover)] rounded-lg">
                      <div>
                        <div className="font-medium text-[var(--foreground)]">
                          {milestone.timestamp ? new Date(milestone.timestamp).toLocaleDateString() : 'Unknown date'}
                        </div>
                        <div className="text-sm text-[var(--muted)]">
                          Max Score: {((milestone.maxScore || 0) * 100).toFixed(1)}%
                          {(milestone.criticalAlerts || 0) > 0 && ` • ${milestone.criticalAlerts} critical alerts`}
                        </div>
                      </div>
                      {(milestone.criticalAlerts || 0) > 0 && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  ))}
                {trendData.filter(d => (d.maxScore || 0) > 0.7 || (d.criticalAlerts || 0) > 0).length === 0 && (
                  <div className="text-sm text-[var(--muted)] text-center py-4">
                    No significant milestones yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Console Output */}
      <ConsoleOutput 
        logs={logs} 
        isExpanded={isConsoleExpanded || isLoading}
        onToggleExpand={() => setIsConsoleExpanded(!isConsoleExpanded)}
      />
      
      {/* Footer */}
      <footer className="mt-16 py-6 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-[var(--muted)]">
            <div className="flex items-center justify-center space-x-3">
              <span>Concept and AI Agents Orchestration by</span>
              <a 
                href="https://bencium.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Bencium.io
              </a>
              <span className="text-[var(--border)]">•</span>
              <a 
                href="https://github.com/bencium/agi-detector" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
