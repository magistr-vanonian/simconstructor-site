import { useState } from "react";

const TEAM = [
  {
    id: "ivan",
    role: "Руководитель проекта",
    name: "Клевцов Иван Евгеньевич",
    initials: "ИК",
    summary: "Концепция, архитектура движка и координация разработки",
    dutiesTitle: "Зона ответственности и компетенции",
    duties: [
      "Определение стратегического видения и методологии конструктора симуляций",
      "Кураторство интеграции исторических сценариев и образовательных стандартов",
      "Взаимодействие с учебными заведениями, педагогами и профильными организациями",
    ],
    phone: "+7 920 452 30 97",
    phoneHref: "tel:+79204523097",
    email: "klevczov_ivan@bk.ru",
    status: "Статус: открыт к сотрудничеству",
  },
  {
    id: "grigory",
    role: "Разработчик · исследователь",
    name: "Белов Григорий Андреевич",
    initials: "ГБ",
    summary: "Системы конструктора, веб-платформа, презентации и исторический аспект",
    dutiesTitle: "Резюме и подтверждённый опыт",
    duties: [
      "Создание конструктора: логика симуляции, автоконвертация 3D-моделей и сборка пакетов",
      "Разработка сайта: архитектура historyengine.ru, разделы и видеоруководство",
      "Создание презентаций для школ и вузов",
      "Изучение исторического аспекта: фактчекинг, планы битв, топография и униформа",
    ],
    email: "grigorijbelov1705@yandex.ru",
    status: "Роль: разработчик / историк",
  },
];

function CopyRow({ label, value, href }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="contact-row">
      <div>
        <span className="contact-label">{label}</span>
        <a href={href}>{value}</a>
      </div>
      <button type="button" className="btn ghost slim-inline" onClick={copy}>
        {copied ? "Скопировано" : "Копировать"}
      </button>
    </div>
  );
}

export default function About() {
  return (
    <div className="page-about">
      <header className="page-header">
        <p className="kicker">Создатели проекта</p>
        <h1>О нас · Команда платформы Kristal</h1>
        <p className="lede">
          Мы создаём открытый инструментарий цифровой военной истории: научная строгость,
          пространственная наглядность и современные компьютерные технологии для школ, университетов
          и музеев.
        </p>
      </header>

      <div className="about-grid">
        {TEAM.map((person) => (
          <article className="plaque about-card" key={person.id}>
            <div className="about-card-head">
              <div>
                <p className="kicker">{person.role}</p>
                <h2>{person.name}</h2>
                <p className="meta">{person.summary}</p>
              </div>
              <div className="about-initials" aria-hidden="true">
                {person.initials}
              </div>
            </div>

            <div className="about-duties">
              <p className="kicker">{person.dutiesTitle}</p>
              <ul>
                {person.duties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="about-contacts">
              <p className="kicker">Прямые контакты для связи</p>
              {person.phone ? (
                <CopyRow label="Контактный телефон" value={person.phone} href={person.phoneHref} />
              ) : null}
              <CopyRow
                label="Электронная почта"
                value={person.email}
                href={`mailto:${person.email}`}
              />
            </div>

            <div className="about-card-foot">
              <span>{person.status}</span>
              <a href={`mailto:${person.email}`}>{person.mailLabel} →</a>
            </div>
          </article>
        ))}
      </div>

      <section className="plaque about-collab">
        <p className="kicker">Школы и университеты</p>
        <h2>Сотрудничество с учебными заведениями</h2>
        <p>
          Мы открыты к совместным внедрениям симулятора на уроках истории в школах,
          гимназиях, лицеях и на профильных кафедрах университетов. Если вы преподаватель, методист
          или исторический энтузиаст — напишите нам, и мы предоставим методические сценарии и
          практические наработки.
        </p>
      </section>
    </div>
  );
}
