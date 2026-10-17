import { useEffect, useState } from "react";
import VideoSlot from "../components/VideoSlot.jsx";

export default function Guide() {
  const [guide, setGuide] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/guide")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Не удалось открыть шаблон инструкции");
        }
        return res.json();
      })
      .then(setGuide)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <p className="note">{error}</p>;
  }
  if (!guide) {
    return <p className="note">Читаю шаблон…</p>;
  }

  return (
    <article className="guide">
      <header className="guide-header plaque">
        <p className="kicker">Инструкция</p>
        <h1>{guide.title || "Инструкция"}</h1>
        <p className="lede">{guide.header}</p>
      </header>
      {(guide.blocks || []).map((block) => (
        <section className="guide-block" key={block.id}>
          <div className="plaque">
            <p className="kicker">{block.title || `Шаг ${block.id}`}</p>
            <p>{block.text}</p>
          </div>
          <VideoSlot slot={block.id} title={block.title} />
        </section>
      ))}
    </article>
  );
}
