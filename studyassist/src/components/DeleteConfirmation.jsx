import { useId, useRef, useState } from "react";

function DeleteConfirmation({
  buttonLabel = "Delete",
  confirmation,
  onConfirm,
  disabled = false,
  className,
}) {
  const messageId = useId();
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    if (busy.current || disabled) return;
    busy.current = true;
    setError("");
    try {
      setIsDeleting(true);
      const result = await onConfirm();
      if (result === false) throw new Error("Could not delete. Please try again.");
      setIsOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Could not delete. Please try again.");
    } finally {
      busy.current = false;
      setIsDeleting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        className={["delete-action", className].filter(Boolean).join(" ")}
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <span className="delete-confirmation" role="group" aria-labelledby={messageId}>
      <span className="delete-confirmation-message" id={messageId}>{confirmation}</span>{" "}
      <button className="delete-confirmation-accept" type="button" onClick={confirmDelete} disabled={isDeleting || disabled}>
        {isDeleting ? "Deleting..." : "Yes, delete"}
      </button>{" "}
      <button className="delete-confirmation-cancel" type="button" onClick={() => { setIsOpen(false); setError(""); }} disabled={isDeleting}>
        Cancel
      </button>
      {error && <span className="delete-confirmation-error" role="alert">{error}</span>}
    </span>
  );
}

export default DeleteConfirmation;
