const state = {
  config: {
    defaultAppId: '',
    outputFolder: '',
    dumpMode: 'full',
    filenamePattern: '{appid}_{depotid}.lua',
    inferAppId: true,
    structure: 'flat'
  },
  files: []
};

function validateRow(file) {
  const errors = [];
  
  if (!file.manifestId || !/^\d+$/.test(file.manifestId)) {
    errors.push('Invalid Manifest ID');
  }
  
  if (!file.depotId || !/^\d+$/.test(file.depotId)) {
    errors.push('Invalid Depot ID');
  }
  
  if (!file.appId || !/^\d+$/.test(file.appId)) {
    errors.push('Invalid or missing APPID');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function updateRowStatus() {
  state.files.forEach((file, index) => {
    const validation = validateRow(file);
    file.valid = validation.valid;
    file.status = validation.valid ? 'valid' : 'invalid';
    file.errors = validation.errors;
  });
}

function inferAppIdFromFilename(filename) {
  const patterns = [
    /app[_-]?(\d+)/i,
    /(\d+)[_-]depot/i,
    /^(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) return match[1];
  }
  
  return '';
}

function applyInference() {
  if (!state.config.inferAppId) return;
  
  state.files.forEach(file => {
    if (!file.appId || file.appId === '') {
      const inferred = inferAppIdFromFilename(file.name);
      if (inferred) {
        file.appId = inferred;
      } else if (state.config.defaultAppId) {
        file.appId = state.config.defaultAppId;
      }
    }
  });
}

function generateLuaOutput() {
  const validFiles = state.files.filter(f => f.valid);
  
  if (validFiles.length === 0) {
    return '-- No valid files to export\n-- Please ensure all required fields are filled correctly';
  }
  
  let output = '-- Generated Lua Output\n';
  output += `-- Dump Mode: ${state.config.dumpMode}\n`;
  output += `-- Structure: ${state.config.structure}\n`;
  output += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  if (state.config.structure === 'flat') {
    output += 'local depots = {\n';
    validFiles.forEach(file => {
      output += `  ["${file.depotId}"] = {\n`;
      output += `    appid = ${file.appId},\n`;
      output += `    manifestid = "${file.manifestId}",\n`;
      output += `    depotid = ${file.depotId},\n`;
      output += `    file = "${file.name}",\n`;
      output += `    type = "${file.type}"\n`;
      output += '  },\n';
    });
    output += '}\n\n';
    output += 'return depots\n';
  } else if (state.config.structure === 'nested') {
    const byAppId = {};
    validFiles.forEach(file => {
      if (!byAppId[file.appId]) {
        byAppId[file.appId] = [];
      }
      byAppId[file.appId].push(file);
    });
    
    output += 'local apps = {\n';
    Object.entries(byAppId).forEach(([appId, files]) => {
      output += `  ["${appId}"] = {\n`;
      output += '    depots = {\n';
      files.forEach(file => {
        output += `      ["${file.depotId}"] = {\n`;
        output += `        manifestid = "${file.manifestId}",\n`;
        output += `        file = "${file.name}",\n`;
        output += `        type = "${file.type}"\n`;
        output += '      },\n';
      });
      output += '    }\n';
      output += '  },\n';
    });
    output += '}\n\n';
    output += 'return apps\n';
  } else if (state.config.structure === 'grouped') {
    const byType = {};
    validFiles.forEach(file => {
      if (!byType[file.type]) {
        byType[file.type] = [];
      }
      byType[file.type].push(file);
    });
    
    output += 'local manifests = {\n';
    Object.entries(byType).forEach(([type, files]) => {
      output += `  ${type} = {\n`;
      files.forEach(file => {
        output += `    {\n`;
        output += `      appid = ${file.appId},\n`;
        output += `      manifestid = "${file.manifestId}",\n`;
        output += `      depotid = ${file.depotId},\n`;
        output += `      file = "${file.name}"\n`;
        output += '    },\n';
      });
      output += '  },\n';
    });
    output += '}\n\n';
    output += 'return manifests\n';
  }
  
  return output;
}

function updatePreview() {
  const preview = generateLuaOutput();
  const previewElement = document.getElementById('preview-content');
  if (previewElement) {
    previewElement.textContent = preview;
  }
  
  const validCount = state.files.filter(f => f.valid).length;
  const totalCount = state.files.length;
  
  const statValid = document.getElementById('stat-valid');
  const statTotal = document.getElementById('stat-total');
  
  if (statValid) statValid.textContent = validCount;
  if (statTotal) statTotal.textContent = totalCount;
  
  const saveButton = document.getElementById('btn-save');
  if (saveButton) {
    saveButton.disabled = validCount === 0;
  }
}

function renderTable() {
  const tbody = document.getElementById('table-files');
  if (!tbody) return;
  
  if (state.files.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-base-content/50 py-8">
          No files loaded. Use "Scan Folder" or "Select Files" to begin.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = state.files.map((file, index) => {
    const validation = validateRow(file);
    const statusClass = validation.valid ? 'badge-success' : 'badge-error';
    const statusText = validation.valid ? 'Valid' : 'Invalid';
    const rowClass = validation.valid ? '' : 'bg-error/10';
    
    return `
      <tr class="${rowClass}">
        <td>${index + 1}</td>
        <td>
          <div class="flex flex-col">
            <span class="font-mono text-xs">${escapeHtml(file.name)}</span>
            ${!validation.valid ? `<span class="text-error text-xs mt-1">${validation.errors.join(', ')}</span>` : ''}
          </div>
        </td>
        <td>
          <input 
            type="text" 
            value="${escapeHtml(file.manifestId)}" 
            data-index="${index}" 
            data-field="manifestId"
            class="input input-xs input-bordered w-full font-mono"
            placeholder="Manifest ID"
          />
        </td>
        <td>
          <input 
            type="text" 
            value="${escapeHtml(file.depotId)}" 
            data-index="${index}" 
            data-field="depotId"
            class="input input-xs input-bordered w-full font-mono"
            placeholder="Depot ID"
          />
        </td>
        <td>
          <input 
            type="text" 
            value="${escapeHtml(file.appId)}" 
            data-index="${index}" 
            data-field="appId"
            class="input input-xs input-bordered w-full font-mono"
            placeholder="APPID"
          />
        </td>
        <td>
          <span class="badge badge-sm badge-ghost font-mono">${escapeHtml(file.type)}</span>
        </td>
        <td>
          <span class="badge badge-sm ${statusClass}">${statusText}</span>
        </td>
      </tr>
    `;
  }).join('');
  
  tbody.querySelectorAll('input[data-field]').forEach(input => {
    input.addEventListener('input', handleCellEdit);
  });
}

function handleCellEdit(event) {
  const index = parseInt(event.target.dataset.index);
  const field = event.target.dataset.field;
  const value = event.target.value;
  
  if (state.files[index]) {
    state.files[index][field] = value;
    updateRowStatus();
    renderTable();
    updatePreview();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function handleScanFolder() {
  if (!window.electronAPI) return;
  
  const result = await window.electronAPI.selectFolder();
  if (result.success) {
    const scanResult = await window.electronAPI.scanFiles(result.path);
    if (scanResult.success) {
      state.files = scanResult.files;
      applyInference();
      updateRowStatus();
      renderTable();
      updatePreview();
    }
  }
}

async function handleScanDepotcache() {
  if (!window.electronAPI) return;
  
  const options = {
    defaultAppId: state.config.defaultAppId,
    inferAppId: state.config.inferAppId
  };
  
  const result = await window.electronAPI.scanDepotcache(options);
  
  if (result.success) {
    state.files = result.files;
    updateRowStatus();
    renderTable();
    updatePreview();
    
    if (result.errors.length > 0) {
      console.warn('Scan completed with errors:', result.errors);
      alert(`Scan completed with warnings:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? `\n... and ${result.errors.length - 5} more` : ''}`);
    } else {
      alert(`Successfully scanned ${result.libraries.length} Steam library location(s) and found ${result.files.length} manifest file(s).`);
    }
  } else {
    alert(`Failed to scan Steam depotcache:\n${result.errors.join('\n')}`);
  }
}

async function handleSelectFiles() {
  if (!window.electronAPI) return;
  
  const options = {
    defaultAppId: state.config.defaultAppId,
    inferAppId: state.config.inferAppId
  };
  
  const result = await window.electronAPI.selectFiles(options);
  if (result.success) {
    state.files = result.files;
    updateRowStatus();
    renderTable();
    updatePreview();
  }
}

async function handleSelectOutput() {
  if (!window.electronAPI) return;
  
  const result = await window.electronAPI.selectFolder();
  if (result.success) {
    state.config.outputFolder = result.path;
    const input = document.getElementById('input-output-folder');
    if (input) {
      input.value = result.path;
    }
    updatePreview();
  }
}

async function handleSave() {
  if (!window.electronAPI) return;
  
  const validFiles = state.files.filter(f => f.valid);
  if (validFiles.length === 0) return;
  
  const luaContent = generateLuaOutput();
  const filename = state.config.filenamePattern
    .replace('{appid}', validFiles[0].appId)
    .replace('{depotid}', validFiles[0].depotId)
    .replace('{manifestid}', validFiles[0].manifestId);
  
  const result = await window.electronAPI.saveOutput({
    content: luaContent,
    filename: filename,
    outputFolder: state.config.outputFolder
  });
  
  if (result.success) {
    alert(`File saved successfully to:\n${result.path}`);
  } else if (result.error) {
    alert(`Error saving file:\n${result.error}`);
  }
}

function handleConfigChange(event) {
  const id = event.target.id;
  
  switch (id) {
    case 'input-default-appid':
      state.config.defaultAppId = event.target.value;
      applyInference();
      updateRowStatus();
      renderTable();
      updatePreview();
      break;
    case 'select-dump-mode':
      state.config.dumpMode = event.target.value;
      updatePreview();
      break;
    case 'input-filename-pattern':
      state.config.filenamePattern = event.target.value;
      break;
    case 'checkbox-infer':
      state.config.inferAppId = event.target.checked;
      applyInference();
      updateRowStatus();
      renderTable();
      updatePreview();
      break;
  }
}

function handleStructureChange(event) {
  if (event.target.name === 'structure') {
    state.config.structure = event.target.value;
    updatePreview();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnScan = document.getElementById('btn-scan');
  const btnScanDepot = document.getElementById('btn-scan-depot');
  const btnSelectFiles = document.getElementById('btn-select-files');
  const btnSelectOutput = document.getElementById('btn-select-output');
  const btnSave = document.getElementById('btn-save');
  
  if (btnScan) btnScan.addEventListener('click', handleScanFolder);
  if (btnScanDepot) btnScanDepot.addEventListener('click', handleScanDepotcache);
  if (btnSelectFiles) btnSelectFiles.addEventListener('click', handleSelectFiles);
  if (btnSelectOutput) btnSelectOutput.addEventListener('click', handleSelectOutput);
  if (btnSave) btnSave.addEventListener('click', handleSave);
  
  const inputDefaultAppId = document.getElementById('input-default-appid');
  const selectDumpMode = document.getElementById('select-dump-mode');
  const inputFilenamePattern = document.getElementById('input-filename-pattern');
  const checkboxInfer = document.getElementById('checkbox-infer');
  
  if (inputDefaultAppId) inputDefaultAppId.addEventListener('input', handleConfigChange);
  if (selectDumpMode) selectDumpMode.addEventListener('change', handleConfigChange);
  if (inputFilenamePattern) inputFilenamePattern.addEventListener('input', handleConfigChange);
  if (checkboxInfer) checkboxInfer.addEventListener('change', handleConfigChange);
  
  const structureRadios = document.querySelectorAll('input[name="structure"]');
  structureRadios.forEach(radio => {
    radio.addEventListener('change', handleStructureChange);
  });
  
  renderTable();
  updatePreview();
});
