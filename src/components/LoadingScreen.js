import React from "react";
import { LOGO_SRC } from "../constants";

export default function LoadingScreen({ text = "Cargando datos portuarios…" }) {
  return (
    <div className="loader-screen">
      <img src={LOGO_SRC} alt="Puerto de Dock Sud" className="loader-logo" />
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", margin: 0 }}>
        Una solución de NexBoards Analytics
      </p>
      <div className="loader-ring" />
      <p className="loader-text">{text}</p>
    </div>
  );
}
