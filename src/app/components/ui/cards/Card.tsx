import React from "react";

const Card: React.FC<{ title: string; content: string }> = ({ title, content }) => (
  <div className="bg-white shadow-md rounded-lg p-4">
    <h2 className="text-lg font-bold">{title}</h2>
    <p>{content}</p>
  </div>
);

export default Card;
