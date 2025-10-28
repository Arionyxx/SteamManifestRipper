const state = {
  appId: '',
  appName: '',
  outputFolder: '',
  includeDlc: true,
  depots: [],
  theme: 'dark'
};

function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  
  const alertClasses = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info'
  };
  
  const toast = document.createElement('div');
  toast.className = `alert ${alertClasses[type] || alertClasses.info} shadow-lg mb-2`;
  toast.innerHTML = `
    <div>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateLuaOutput() {
  const depotsWithKeys = state.depots.filter(d => d.decryptionKey);
  
  if (depotsWithKeys.length === 0) {
    return '-- No depots with decryption keys available\n-- Load an app manifest with valid depot keys to generate output';
  }
  
  let output = `-- Generated Lua script for App ID: ${state.appId}\n`;
  if (state.appName) {
    output += `-- App Name: ${state.appName}\n`;
  }
  output += `-- Generated: ${new Date().toISOString()}\n`;
  output += `-- Include DLC: ${state.includeDlc ? 'Yes' : 'No'}\n\n`;
  
  const mainDepots = depotsWithKeys.filter(d => d.type === 'main');
  const dlcDepots = depotsWithKeys.filter(d => d.type === 'dlc');
  
  output += `addappid(${state.appId})\n`;
  
  if (mainDepots.length > 0) {
    const mainDepot = mainDepots[0];
    output += `setManifestid(${state.appId}, "${mainDepot.manifestId}")\n`;
  }
  
  output += '\n';
  
  const depotsToInclude = state.includeDlc ? depotsWithKeys : mainDepots;
  
  for (const depot of depotsToInclude) {
    output += `addappid(${depot.depotId}, 0, "${depot.decryptionKey}")\n`;
    output += `setManifestid(${depot.depotId}, "${depot.manifestId}")\n`;
  }
  
  return output;
}

function updatePreview() {
  const preview = generateLuaOutput();
  const previewElement = document.getElementById('preview-content');
  if (previewElement) {
    previewElement.textContent = preview;
  }
  
  const depotsWithKeys = state.depots.filter(d => d.decryptionKey).length;
  const missingKeys = state.depots.filter(d => !d.decryptionKey).length;
  const totalDepots = state.depots.length;
  
  const statValid = document.getElementById('stat-valid');
  const statMissing = document.getElementById('stat-missing');
  const statTotal = document.getElementById('stat-total');
  
  if (statValid) statValid.textContent = depotsWithKeys;
  if (statMissing) statMissing.textContent = missingKeys;
  if (statTotal) statTotal.textContent = totalDepots;
  
  const btnGenerateLua = document.getElementById('btn-generate-lua');
  const btnCopyManifests = document.getElementById('btn-copy-manifests');
  
  if (btnGenerateLua) {
    btnGenerateLua.disabled = depotsWithKeys === 0;
  }
  
  if (btnCopyManifests) {
    btnCopyManifests.disabled = totalDepots === 0;
  }
}

function renderTable() {
  const tbody = document.getElementById('table-depots');
  if (!tbody) return;
  
  if (state.depots.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-base-content/50 py-8">
          No depots loaded. Enter an App ID and click "Load App Manifest" to begin.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = state.depots.map((depot, index) => {
    const hasKey = depot.decryptionKey && depot.decryptionKey.length > 0;
    const keyDisplay = hasKey 
      ? `<span class="font-mono text-xs">${escapeHtml(depot.decryptionKey)}</span>` 
      : `<span class="text-warning font-semibold">Missing</span>`;
    const rowClass = hasKey ? '' : 'bg-warning/10';
    const typeClass = depot.type === 'main' ? 'badge-primary' : 'badge-secondary';
    
    return `
      <tr class="${rowClass}">
        <td>${index + 1}</td>
        <td><span class="font-mono text-sm">${escapeHtml(depot.depotId)}</span></td>
        <td><span class="font-mono text-sm">${escapeHtml(depot.manifestId)}</span></td>
        <td>${keyDisplay}</td>
        <td><span class="badge badge-sm ${typeClass}">${escapeHtml(depot.type.toUpperCase())}</span></td>
      </tr>
    `;
  }).join('');
}

function updateAppNameDisplay() {
  const appNameDisplay = document.getElementById('app-name-display');
  if (appNameDisplay) {
    appNameDisplay.textContent = state.appName ? `App: ${state.appName}` : '';
  }
}

async function handleLoadApp() {
  if (!window.electronAPI) {
    showToast('Electron API not available', 'error');
    return;
  }
  
  const appIdInput = document.getElementById('input-appid');
  const appId = appIdInput ? appIdInput.value.trim() : '';
  
  if (!appId || !/^\d+$/.test(appId)) {
    showToast('Please enter a valid numeric App ID', 'error');
    return;
  }
  
  state.appId = appId;
  
  const options = {
    appId: state.appId,
    includeDlc: state.includeDlc
  };
  
  showToast('Loading app data...', 'info');
  
  const result = await window.electronAPI.loadAppData(options);
  
  if (result.success) {
    state.appName = result.appName || '';
    state.depots = result.depots || [];
    
    renderTable();
    updateAppNameDisplay();
    updatePreview();
    
    const depotsWithKeys = state.depots.filter(d => d.decryptionKey).length;
    const missingKeys = result.missingKeys ? result.missingKeys.length : 0;
    
    showToast(`Successfully loaded ${state.depots.length} depot(s). ${depotsWithKeys} with keys, ${missingKeys} missing keys.`, 'success');
    
    if (result.warnings && result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }
  } else {
    const errorMsg = result.errors && result.errors.length > 0 
      ? result.errors.join('; ') 
      : 'Unknown error occurred';
    showToast(`Failed to load app data: ${errorMsg}`, 'error');
  }
}

async function handleGenerateLua() {
  if (!window.electronAPI) {
    showToast('Electron API not available', 'error');
    return;
  }
  
  const depotsWithKeys = state.depots.filter(d => d.decryptionKey);
  if (depotsWithKeys.length === 0) {
    showToast('No depots with decryption keys available', 'warning');
    return;
  }
  
  const luaContent = generateLuaOutput();
  const filename = `${state.appId}.lua`;
  
  const result = await window.electronAPI.saveOutput({
    content: luaContent,
    filename: filename,
    outputFolder: state.outputFolder
  });
  
  if (result.success) {
    showToast(`Lua file saved successfully: ${result.path}`, 'success');
  } else if (result.error) {
    showToast(`Error saving file: ${result.error}`, 'error');
  } else {
    showToast('File save cancelled', 'info');
  }
}

async function handleCopyManifests() {
  if (!window.electronAPI) {
    showToast('Electron API not available', 'error');
    return;
  }
  
  if (state.depots.length === 0) {
    showToast('No depots available to copy', 'warning');
    return;
  }
  
  if (!state.outputFolder) {
    showToast('Please select an output directory first', 'warning');
    return;
  }
  
  const options = {
    depots: state.depots,
    destination: state.outputFolder
  };
  
  showToast('Copying manifest files...', 'info');
  
  const result = await window.electronAPI.copyManifests(options);
  
  if (result.success) {
    const copiedCount = result.copied ? result.copied.length : 0;
    const missingCount = result.missing ? result.missing.length : 0;
    
    if (copiedCount > 0) {
      showToast(`Successfully copied ${copiedCount} manifest file(s)`, 'success');
    }
    
    if (missingCount > 0) {
      showToast(`${missingCount} manifest file(s) not found in depotcache`, 'warning');
    }
    
    if (result.errors && result.errors.length > 0) {
      console.error('Copy errors:', result.errors);
      showToast(`Errors occurred during copy: ${result.errors[0]}`, 'error');
    }
  } else {
    const errorMsg = result.errors && result.errors.length > 0 
      ? result.errors.join('; ') 
      : 'Unknown error occurred';
    showToast(`Failed to copy manifests: ${errorMsg}`, 'error');
  }
}

async function handleSelectOutput() {
  if (!window.electronAPI) {
    showToast('Electron API not available', 'error');
    return;
  }
  
  const result = await window.electronAPI.selectFolder();
  if (result.success) {
    state.outputFolder = result.path;
    const input = document.getElementById('input-output-folder');
    if (input) {
      input.value = result.path;
    }
    showToast(`Output folder selected: ${result.path}`, 'success');
  }
}

function handleIncludeDlcChange(event) {
  state.includeDlc = event.target.checked;
  updatePreview();
}

function handleThemeToggle(event) {
  const htmlElement = document.documentElement;
  const isChecked = event.target.checked;
  
  if (isChecked) {
    htmlElement.setAttribute('data-theme', 'light');
    state.theme = 'light';
  } else {
    htmlElement.setAttribute('data-theme', 'dark');
    state.theme = 'dark';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnLoadApp = document.getElementById('btn-load-app');
  const btnGenerateLua = document.getElementById('btn-generate-lua');
  const btnCopyManifests = document.getElementById('btn-copy-manifests');
  const btnSelectOutput = document.getElementById('btn-select-output');
  const checkboxIncludeDlc = document.getElementById('checkbox-include-dlc');
  const themeToggle = document.getElementById('theme-toggle');
  
  if (btnLoadApp) btnLoadApp.addEventListener('click', handleLoadApp);
  if (btnGenerateLua) btnGenerateLua.addEventListener('click', handleGenerateLua);
  if (btnCopyManifests) btnCopyManifests.addEventListener('click', handleCopyManifests);
  if (btnSelectOutput) btnSelectOutput.addEventListener('click', handleSelectOutput);
  if (checkboxIncludeDlc) checkboxIncludeDlc.addEventListener('change', handleIncludeDlcChange);
  if (themeToggle) themeToggle.addEventListener('change', handleThemeToggle);
  
  const inputAppId = document.getElementById('input-appid');
  if (inputAppId) {
    inputAppId.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        handleLoadApp();
      }
    });
  }
  
  renderTable();
  updatePreview();
});
