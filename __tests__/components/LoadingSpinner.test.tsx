const React = require('react');
const { render } = require('@testing-library/react');
const LoadingSpinner = require('@/app/components/shared/LoadingSpinner').default;

describe('LoadingSpinner Component', () => {
  it('renders without crashing', () => {
    render(<LoadingSpinner />)
  })
})
