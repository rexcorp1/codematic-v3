import React from 'react';
import './App.css';

function App() {
  return (
    <div className="container">
      <div className="shape lilac"></div>
      <div className="shape green"></div>
      <div className="shape yellow-circle"></div>
      <svg className="shape squiggle" width="121" height="90" viewBox="0 0 121 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M118.5 2C118.5 2 92.5 2 73 17.5C53.5 33 26 88.5 2.5 88.5" stroke="#4ade80" strokeWidth="4" strokeLinecap="round"/>
      </svg>

      <main className="content">
        <h1>Let's build your app</h1>
        <p>This is a live Vite environment running in your browser!</p>
        <div className="prompt-box">
          ... or type what you want to build
        </div>
      </main>
    </div>
  );
}

export default App;