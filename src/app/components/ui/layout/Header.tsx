import React from "react";

const Header: React.FC = () => (
  <header className="bg-gray-800 text-white p-4">
    <h1 className="text-xl">Dashboard</h1>
    <nav>
      <ul className="flex space-x-4">
        <li><a href="#" className="hover:underline">Home</a></li>
        <li><a href="#" className="hover:underline">About</a></li>
      </ul>
    </nav>
  </header>
);

export default Header;
