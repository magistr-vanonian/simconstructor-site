import { useState } from "react";
import { BATTLES } from "../data/battles.js";

export default function Battles() {
  const [activeId, setActiveId] = useState(BATTLES[0].id);
  const battle = BATTLES.find((item) => item.id === activeId) || BATTLES[0];

  return (
    <div className="page-battles">
      <header className="page-header">
        <p className="kicker">Каталог исторических реконструкций 1300–1850 гг.</p>
        <h1>Битвы</h1>
        <p className="lede">
          Шесть опорных сражений, вокруг которых собираются сцены конструктора. Для каждой битвы —
          стороны, рельеф, кульминация и хронология хода. Карты и готовые симуляции лежат в разделе
          «Ресурсы», когда сцена опубликована.
        </p>
      </header>

      <div className="battle-chips">
        {BATTLES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip${item.id === battle.id ? " is-active" : ""}`}
            onClick={() => setActiveId(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>

      <article className="plaque battle-dossier">
        <p className="kicker">
          {battle.date} · {battle.era}
        </p>
        <h2>{battle.title}</h2>
        <p className="meta">{battle.location}</p>
        <p>{battle.description}</p>

        <div className="battle-sides">
          <div className="battle-side">
            <p className="kicker">Сторона A</p>
            <h3>{battle.sideA.name}</h3>
            <p>{battle.sideA.commander}</p>
            <p className="meta">{battle.sideA.strength}</p>
          </div>
          <div className="battle-side">
            <p className="kicker">Сторона B</p>
            <h3>{battle.sideB.name}</h3>
            <p>{battle.sideB.commander}</p>
            <p className="meta">{battle.sideB.strength}</p>
          </div>
        </div>

        <div className="battle-pillars">
          <section>
            <h3>{battle.pillars.terrainTitle}</h3>
            <p>{battle.pillars.terrainText}</p>
          </section>
          <section>
            <h3>{battle.pillars.climaxTitle}</h3>
            <p>{battle.pillars.climaxText}</p>
          </section>
          <section>
            <h3>{battle.pillars.assetsTitle}</h3>
            <p>{battle.pillars.assetsText}</p>
          </section>
        </div>
      </article>

      <section className="plaque">
        <p className="kicker">Хронология хода</p>
        <h2>Фазы сражения</h2>
        <ol className="battle-phases">
          {battle.phases.map((phase) => (
            <li key={`${battle.id}-${phase.time}-${phase.name}`}>
              <span className="phase-time">{phase.time}</span>
              <div>
                <strong>{phase.name}</strong>
                <p>{phase.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
