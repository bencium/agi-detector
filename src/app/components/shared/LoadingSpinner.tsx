const React = require('react');

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}

module.exports = LoadingSpinner;
module.exports.default = LoadingSpinner;
