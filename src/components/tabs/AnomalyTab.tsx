'use client';

import React from 'react';
import AnomalyDetection from '@/components/AnomalyDetection';

export const AnomalyTab: React.FC = () => {
  return (
    <div className="animate-fade-in">
      <AnomalyDetection />
    </div>
  );
};

export default AnomalyTab;
