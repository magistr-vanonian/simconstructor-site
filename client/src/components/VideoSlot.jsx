import { useEffect, useState } from "react";

export default function VideoSlot({ slot, title }) {
  const [state, setState] = useState({ status: "load" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/guide/video/${slot}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) {
          return;
        }
        if (data && data.exists && data.url) {
          setState({ status: "ok", url: data.url, filename: data.filename });
        } else {
          setState({ status: "empty" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "empty" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slot]);

  return (
    <figure className="video-bezel">
      <div className="video-chrome">
        <span className="video-dot" />
        <span className="video-chrome-title">{title || `Запись ${slot}`}</span>
        <span className="video-chrome-path">content/videos/{slot}</span>
      </div>
      <div className="video-stage">
        {state.status === "ok" ? (
          <video controls playsInline src={state.url}>
            Ваш браузер не воспроизводит видео.
          </video>
        ) : (
          <div className="video-placeholder">
            <img src="/source_icon.png" alt="" />
            <p>{state.status === "load" ? "Загрузка…" : "Видео пока не добавлено"}</p>
            <small>Положите mp4 или webm в content/videos/{slot} — страница не упадёт.</small>
          </div>
        )}
      </div>
    </figure>
  );
}
