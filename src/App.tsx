import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import NetworkStatus from './components/NetworkStatus';
import Home from './views/Home';
import About from './views/About';

import './App.css';

const App = () => {
  return (
    <MantineProvider defaultColorScheme="dark">
      <NetworkStatus></NetworkStatus>
      <BrowserRouter>
        <div className="App">
          <header className="App-header">
            <Link to="/">
              <h1 className="App-name">waVVy</h1>
            </Link>

            <p>
              the first lossless high performance, peer to peer, fully
              browser-based DAW
            </p>
            <Link to="/about">learn more</Link>
          </header>
          <Routes>
            <Route path="/about" element={<About />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </div>
      </BrowserRouter>
    </MantineProvider>
  );
};

export default App;
