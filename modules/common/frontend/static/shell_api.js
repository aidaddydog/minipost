/* modules/common/frontend/static/shell_api.js */
(function(w){
  const ShellAPI = {
    openModal: (cfg)=> w.parent.postMessage({ type:'open-shell-modal', payload: cfg }, '*'),
    updateModal: (cfg)=> w.parent.postMessage({ type:'update-shell-modal', payload: cfg }, '*'),
    closeModal: (payload)=> w.parent.postMessage({ type:'close-shell-modal', payload }, '*'),
    emitResult: (scope, action, data)=> w.parent.postMessage({ type:'shell-modal-result', scope, action, data }, '*'),
  };
  w.ShellAPI = ShellAPI;
})(window);
