import React from "react";

const Header: React.FC = () => (
  <header className="bg-gray-800 text-white p-4">
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">ASI/AGI Monitor</h1>
      <nav aria-label="Primary">
        <ul className="flex space-x-4 text-sm">
          <li><a href="#overview" className="hover:underline">Overview</a></li>
          <li><a href="#findings" className="hover:underline">Findings</a></li>
          <li><a href="#analysis" className="hover:underline">Analysis</a></li>
          <li><a href="#trends" className="hover:underline">Trends</a></li>
        </ul>
      </nav>
    </div>
  </header>
);

export default Header;
