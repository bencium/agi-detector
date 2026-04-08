// Human-readable score labels for AGI risk assessment

export interface ScoreLabel {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const getScoreLabel = (score: number): ScoreLabel => {
  if (score < 0.1) {
    return {
      label: 'No AGI Relevance',
      color: 'gray',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600'
    };
  }
  if (score < 0.3) {
    return {
      label: 'Minor Progress',
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600'
    };
  }
  if (score < 0.5) {
    return {
      label: 'Significant Development',
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700'
    };
  }
  if (score < 0.7) {
    return {
      label: 'Major Breakthrough',
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700'
    };
  }
  return {
    label: 'Critical AGI Signal',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700'
  };
};

export const getSeverityLabel = (severity: string | undefined): ScoreLabel => {
  const sev = (severity || 'none').toLowerCase();
  switch (sev) {
    case 'critical':
      return {
        label: 'CRITICAL',
        color: 'red',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700'
      };
    case 'high':
      return {
        label: 'HIGH',
        color: 'orange',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-700'
      };
    case 'medium':
      return {
        label: 'MEDIUM',
        color: 'yellow',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700'
      };
    case 'low':
      return {
        label: 'LOW',
        color: 'green',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700'
      };
    default:
      return {
        label: 'NONE',
        color: 'gray',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600'
      };
  }
};

export const formatClaim = (claim: {
  benchmark?: string;
  metric?: string;
  value?: number;
  delta?: number;
  unit?: string;
  claim: string;
}): string => {
  const parts: string[] = [];
  if (claim.benchmark) parts.push(claim.benchmark);
  if (claim.metric) parts.push(claim.metric);
  if (typeof claim.value === 'number') parts.push(`${claim.value}${claim.unit || ''}`);
  if (typeof claim.delta === 'number') parts.push(`Δ ${claim.delta}${claim.unit || ''}`);
  return parts.length > 0 ? parts.join(' · ') : claim.claim;
};

export const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date);
};
