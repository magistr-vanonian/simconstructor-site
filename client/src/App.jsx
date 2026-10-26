import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Battles from "./pages/Battles.jsx";
import About from "./pages/About.jsx";
import Resources from "./pages/Resources.jsx";
import Guide from "./pages/Guide.jsx";

export default function App() {
  return (
    <div className="shell">
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <header className="topbar">
        <NavLink to="/" className="brand" end>
          <img src="/source_icon.png" alt="" />
          <div>
            <div className="brand-kicker">Kristal Engine</div>
            <div className="brand-title">Конструктор симуляций</div>
          </div>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            Главная
          </NavLink>
          <NavLink to="/battles">Битвы</NavLink>
          <NavLink to="/about">О нас</NavLink>
          <NavLink to="/resources">Ресурсы</NavLink>
          <NavLink to="/guide">Инструкция</NavLink>
        </nav>
      </header>
      <main className="stage">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/battles" element={<Battles />} />
          <Route path="/about" element={<About />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/guide" element={<Guide />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="brand-title">Kristal · Конструктор симуляций</div>
        <nav>
          <NavLink to="/" end>
            Главная
          </NavLink>
          <NavLink to="/battles">Битвы</NavLink>
          <NavLink to="/about">О нас</NavLink>
          <NavLink to="/resources">Ресурсы</NavLink>
          <NavLink to="/guide">Инструкция</NavLink>
        </nav>
      </footer>
    </div>
  );
}
