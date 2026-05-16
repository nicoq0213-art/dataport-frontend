import React, { useState } from "react";

const IMAGENES = [
  {
    src: process.env.PUBLIC_URL + "/AdP_Modificada.webp",
    titulo: "Áreas del Puerto",
    subtitulo: "Distribución sectorial del puerto",
  },
  {
    src: process.env.PUBLIC_URL + "/Cuadro2.webp",
    titulo: "Sitios de Amarre",
    subtitulo: "Capacidad y dimensiones por terminal",
  },
];

export default function Infraestructura() {
  const [ampliada, setAmpliada] = useState(null);

  return (
    <div>
      <div className="sec">Infraestructura portuaria</div>

      {IMAGENES.map((img, i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <div className="chart-box" style={{ padding: 0, overflow: "hidden" }}>
            {/* Cabecera */}
            <div style={{
              padding: "12px 16px 10px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div className="chart-title" style={{ marginBottom: 1 }}>{img.titulo}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{img.subtitulo}</div>
              </div>
              <button
                onClick={() => setAmpliada(img)}
                title="Ver en pantalla completa"
                style={{
                  background: "none", border: "1px solid #e0e0e0", borderRadius: 6,
                  padding: "4px 10px", fontSize: 11, color: "#1A5FA8",
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                ⛶ Ampliar
              </button>
            </div>

            {/* Imagen */}
            <div style={{ padding: "12px 16px 16px" }}>
              <img
                src={img.src}
                alt={img.titulo}
                onClick={() => setAmpliada(img)}
                style={{
                  width: "100%",
                  maxHeight: 480,
                  objectFit: "contain",
                  borderRadius: 8,
                  cursor: "zoom-in",
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Lightbox */}
      {ampliada && (
        <div
          onClick={() => setAmpliada(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, cursor: "zoom-out",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "relative", maxWidth: "95vw", maxHeight: "92vh" }}
          >
            <img
              src={ampliada.src}
              alt={ampliada.titulo}
              style={{
                maxWidth: "95vw", maxHeight: "88vh",
                objectFit: "contain", borderRadius: 10, display: "block",
              }}
            />
            <button
              onClick={() => setAmpliada(null)}
              style={{
                position: "absolute", top: -12, right: -12,
                background: "#fff", border: "none", borderRadius: "50%",
                width: 32, height: 32, fontSize: 16, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
            <div style={{
              marginTop: 8, textAlign: "center",
              fontSize: 13, color: "#ccc", fontWeight: 500,
            }}>
              {ampliada.titulo}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
