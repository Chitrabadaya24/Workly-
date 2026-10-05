import Modal from './Modal';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <p className="text-sm text-surface-600 dark:text-surface-400 mb-5">{message}</p>
    <div className="flex justify-end gap-2">
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose(); }}>
        {confirmLabel}
      </button>
    </div>
  </Modal>
);

export default ConfirmDialog;
