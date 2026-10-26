import { useCallback, useEffect, useState } from "react";
import LibrarySection from "../components/LibrarySection.jsx";

const SHELVES = [
  {
    id: "scenes",
    title: "Сцены",
    hint: "Сначала сцена .gem, затем элементы — можно выбрать всё, лишние отбросятся по имени",
    accept: ".gem,.cmf,.png,.jpg,.jpeg,.webp,.bmp,.tga,.gif,.ttf,.otf,.json",
    sceneWizard: true,
    note: "При выгрузке разместите сначала сцену, потом все необходимые элементы.",
    downloadNote: "При загрузке разместите все скачанные файлы в соответствующих папках в директории Assets.",
  },
  {
    id: "simulations",
    title: "Скомпилированные симуляции",
    hint: "Готовые папки симуляций: исполняемый набор после «Собрать симуляцию».",
    accept: ".zip,.7z",
    folder: true,
  },
  {
    id: "landscapes",
    title: "Ландшафты",
    hint: "Пластины вместе с атласами карт (.cmf и текстуры).",
    accept: ".cmf,.png,.jpg,.jpeg,.webp",
    folder: true,
  },
  {
    id: "figures",
    title: "Фигурки",
    hint: "Меши фигурок и сопутствующие текстуры.",
    accept: ".cmf,.png,.jpg,.jpeg,.webp",
  },
  {
    id: "fonts",
    title: "Шрифты",
    hint: "TTF и OTF для подписей на слайдах и в редакторе.",
    accept: ".ttf,.otf",
  },
  {
    id: "textures",
    title: "Текстуры",
    hint: "Отдельные карты и просто картинки без сцены.",
    accept: ".png,.jpg,.jpeg,.webp,.bmp,.tga,.gif",
  },
];

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (!n) {
    return "";
  }
  if (n < 1024 * 1024 * 1024) {
    return `${(n / 1024 / 1024).toFixed(1)} МБ`;
  }
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}

export default function Resources() {
  const [ctor, setCtor] = useState(null);
  const [library, setLibrary] = useState({});

  const reloadLibrary = useCallback(() => {
    fetch("/api/library")
      .then((res) => res.json())
      .then((data) => setLibrary((data && data.items) || {}))
      .catch(() => setLibrary({}));
  }, []);

  useEffect(() => {
    fetch("/api/constructor")
      .then((res) => res.json())
      .then(setCtor)
      .catch(() => setCtor({ available: false }));
    reloadLibrary();
  }, [reloadLibrary]);

  return (
    <div className="resources">
      <section className="hero-download plaque">
        <p className="kicker">Конструктор</p>
        <h1>Скачать конструктор симуляций</h1>
        <p className="lede">
          Здесь можно скачать сам конструктор симуляций — чистую редакцию без карт, фигурок, шрифтов
          и прочих импортированных ассетов. Это рабочий инструмент: пустой проект, движок и редактор.
          Распакуйте архив целиком в одну папку и запускайте SimConstructor.exe оттуда, не из окна zip.
          Готовые сцены, ландшафты и прочие материалы лежат ниже, в библиотеке решений.
        </p>
        <div className="download-row">
          {ctor && ctor.available ? (
            <a className="gold-plaque" href="/api/constructor/download">
              <span className="gold-plaque-shine" />
              <span className="gold-plaque-label">Скачать конструктор</span>
            </a>
          ) : (
            <div className="gold-plaque is-disabled" role="status">
              <span className="gold-plaque-shine" />
              <span className="gold-plaque-label">Релиз ещё не опубликован</span>
              <span className="gold-plaque-meta">Запустите publish-simconstructor-release.cmd</span>
            </div>
          )}
        </div>
      </section>

      <div className="library-intro">
        <h2>Библиотека готовых решений</h2>
      </div>

      {SHELVES.map((shelf) => (
        <LibrarySection
          key={shelf.id}
          {...shelf}
          items={library[shelf.id] || []}
          onUploaded={reloadLibrary}
        />
      ))}
    </div>
  );
}
