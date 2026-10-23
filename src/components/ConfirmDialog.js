import React, { useEffect, useRef } from "react";

/**
 * ConfirmDialog — modal de confirmación reutilizable (estándar NexBoards).
 *
 * Props:
 *   open        {boolean}  — muestra u oculta el modal
 *   message     {string}   — texto principal (p.ej. "¿Eliminar a …? Esta acción no se puede deshacer.")
 *   onConfirm   {fn}       — se llama al hacer clic en el botón de acción destructiva
 *   onCancel    {fn}       — se llama al cancelar (Escape, Enter, clic fuera, botón Cancelar)
 *   confirmLabel {string}  — etiqueta del botón destructivo (default: "Eliminar")
 *   cancelLabel  {string}  — etiqueta del botón seguro    (default: "Cancelar")
 *   loading     {boolean}  — deshabilita el botón destructivo mientras se procesa
 */
export default function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Eliminar",
  cancelLabel  = "Cancelar",
  loading      = false,
}) {
  const cancelRef = useRef(null);

  // Foco en "Cancelar" cuando abre; captura Escape y Enter → cancelar
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    function onKey(e) {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="cdialog-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="cdialog-card">
        <p className="cdialog-msg">{message}</p>
        <div className="cdialog-btns">
          <button
            ref={cancelRef}
            className="cdialog-btn cdialog-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className="cdialog-btn cdialog-confirm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Eliminando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
