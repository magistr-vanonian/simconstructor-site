import { useState } from "react";
import { Link } from "react-router-dom";

const MANIFESTO = [
  {
    id: "goal",
    number: "01",
    shortTitle: "Зачем создаётся конструктор",
    tagline: "Пространственное понимание вместо сухого текста",
    quote:
      "«История битвы — это не строчка в учебнике, а масштабная пространственная партия, где победу решали высота холма, ширина брода и секунды манёвра».",
    paragraphs: [
      "Конструктор создаётся для того, чтобы перевести изучение военной истории из плоского чтения параграфов в объёмное трёхмерное исследование. В классическом учебнике невозможно по-настоящему ощутить, почему позиция на высоте Курганной батареи была ключевой, или как густой лес сковывал манёвр резервов.",
      "В среде Kristal учащийся видит реальный масштаб театра военных действий: крутизну склонов, дистанции эффективного огня, плотность батальонных колонн и влияние времени суток на решения полководцев.",
    ],
  },
  {
    id: "students",
    number: "02",
    shortTitle: "Привлечение школьников и студентов",
    tagline: "Интерактивные баталии",
    quote:
      "«Когда ученик своими глазами видит внезапный фланговый удар засадного полка, абстрактная дата превращается в захватывающее открытие».",
    paragraphs: [
      "Современное поколение учеников воспитано в богатой визуальной среде. Сухие конспекты о перестроениях войск не вызывают отклика и быстро забываются после контрольной.",
      "Наглядная симуляция включает любопытство: «Почему полководец двинул кавалерию именно сюда? Что произошло бы, если бы дрогнул центр?». Ученик из пассивного слушателя становится исследователем.",
    ],
  },
  {
    id: "open-access",
    number: "03",
    shortTitle: "Свои 3D-модели и свобода творчества",
    tagline: "Открытый доступ и автоматическая конвертация",
    quote:
      "«Никаких закрытых подписок: загружайте свои 3D-модели, а движок сам подготовит их к масштабной симуляции тысяч воинов».",
    paragraphs: [
      "Конструктор в открытом доступе: скачать приложение и собрать реконструкцию может любой желающий. Мы не ограничиваем преподавателей и энтузиастов фиксированным набором сцен.",
      "Можно взять готовые модели солдат и орудий или импортировать свои. Алгоритм Kristal конвертирует сетку и текстуры под формат движка, чтобы многотысячные армии держали кадр.",
    ],
  },
  {
    id: "curriculum-issue",
    number: "04",
    shortTitle: "Проблема школьной программы",
    tagline: "Почему приложение нужно современному образованию",
    quote:
      "«Сжатые часы и зубрёжка разрозненных дат без понимания контекста убивают интерес к истории. Наша цель — вернуть смысл и структуру».",
    paragraphs: [
      "В школьной программе на историю выделяется мало часов. Масштабные эпохи и ключевые сражения преподносятся парой беглых абзацев.",
      "Проверочные тесты при этом требуют заучивания дат и фамилий без причинно-следственных связей. Kristal восстанавливает логику событий через целостную визуальную структуру.",
    ],
  },
];

export default function Home() {
  const [activeId, setActiveId] = useState(MANIFESTO[0].id);
  const active = MANIFESTO.find((item) => item.id === activeId) || MANIFESTO[0];
  const activeIndex = MANIFESTO.findIndex((item) => item.id === active.id);

  function nextThesis() {
    const next = MANIFESTO[(activeIndex + 1) % MANIFESTO.length];
    setActiveId(next.id);
  }

  return (
    <div className="page-home">
      <section className="page-hero">
        <p className="kicker">Взгляд в прошлое через призму будущего</p>
        <h1>Оживите историю великих битв в трёх измерениях</h1>
        <p className="lede">
          <strong>Kristal</strong> — открытый конструктор исторических сражений. Преодолейте сухую
          зубрёжку учебников: исследуйте тактику полководцев, рельеф местности и манёвры армий в
          наглядном 3D-пространстве.
        </p>
        <div className="hero-actions">
          <Link className="btn-gold" to="/battles">
            Открыть каталог битв
          </Link>
          <Link className="btn ghost" to="/guide">
            Смотреть видеокурс
          </Link>
        </div>
      </section>

      <section className="manifesto">
        <div className="manifesto-head">
          <div>
            <p className="kicker">Манифест платформы</p>
            <h2>О проекте: почему мы создаём Kristal</h2>
          </div>
          <p className="manifesto-count">
            Выберите тезис
            <span>
              {" "}
              ({active.number}/04)
            </span>
          </p>
        </div>

        <div className="manifesto-grid">
          <div className="thesis-list">
            {MANIFESTO.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`thesis-btn${item.id === active.id ? " is-active" : ""}`}
                onClick={() => setActiveId(item.id)}
              >
                <span className="thesis-num">{item.number}</span>
                <span>
                  <strong>{item.shortTitle}</strong>
                  <em>{item.tagline}</em>
                </span>
              </button>
            ))}
          </div>

          <article className="plaque thesis-pane">
            <div className="thesis-pane-head">
              <span className="thesis-badge">{active.number}</span>
              <span className="kicker">{active.tagline}</span>
              <span className="thesis-meta">Раздел {active.number} из 04</span>
            </div>
            <blockquote>{active.quote}</blockquote>
            {active.paragraphs.map((text) => (
              <p key={text.slice(0, 24)}>{text}</p>
            ))}
            <div className="thesis-foot">
              <p className="takeaway">{active.takeaway}</p>
              <button type="button" className="btn ghost" onClick={nextThesis}>
                Следующий тезис
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
