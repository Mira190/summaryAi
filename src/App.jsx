import Hero from "./components/Hero";
import Demo from "./components/Demo";

import "./App.css";

const App = () => (
  <main>
    <div className="main" aria-hidden="true" />

    <div className="app">
      <Hero />
      <Demo />
    </div>
  </main>
);

export default App;
