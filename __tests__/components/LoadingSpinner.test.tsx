import React from 'react';
import { render } from '@testing-library/react';
import LoadingSpinner from '@/app/components/shared/LoadingSpinner';

describe('LoadingSpinner Component', () => {
  it('renders without crashing', () => {
    render(<LoadingSpinner />)
  })
})
