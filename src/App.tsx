import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import Home from "./views/Home"
import About from "./views/About"

import "./App.css"

const App = () => {
  return (
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
  )
}

export default App
