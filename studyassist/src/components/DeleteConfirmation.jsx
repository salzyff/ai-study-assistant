import { useId, useState } from "react";

function DeleteConfirmation({
  buttonLabel = "Delete",
  confirmation,
  onConfirm,
  disabled = false,
  className,
}) {
  const messageId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    try {
      setIsDeleting(true);
      await onConfirm();
      setIsOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        className={className}
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <span role="alertdialog" aria-labelledby={messageId}>
      <span id={messageId}>{confirmation}</span>{" "}
      <button type="button" onClick={confirmDelete} disabled={isDeleting}>
        {isDeleting ? "Deleting..." : "Yes, delete"}
      </button>{" "}
      <button type="button" onClick={() => setIsOpen(false)} disabled={isDeleting}>
        Cancel
      </button>
    </span>
  );
}

export default DeleteConfirmation;
