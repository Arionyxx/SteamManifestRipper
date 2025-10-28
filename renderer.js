document.addEventListener('DOMContentLoaded', () => {
  if (window.electronAPI) {
    document.getElementById('node-version').textContent = window.electronAPI.versions.node;
    document.getElementById('chrome-version').textContent = window.electronAPI.versions.chrome;
    document.getElementById('electron-version').textContent = window.electronAPI.versions.electron;
  }

  const button = document.querySelector('.btn-primary');
  if (button) {
    button.addEventListener('click', () => {
      alert('Welcome to your Electron app!');
    });
  }
});
