const state = {
  manifests: [],
  defaultAppId: '',
  inferAppId: false,
  dumpMode: 'base',
  outputPath: '',
  outputStructure: 'flat',
  filenamePattern: '{APPID}_{DATE}_{TIME}.lua'
};

function validateManifestEntry(entry) {
  const errors = [];
  
  if (!entry.appid || !/^\d+$/.test(entry.appid)) {
    errors.push('Invalid APPID (must be numeric)');
  }
  
  if (!entry.depotid || !/^\d+$/.test(entry.depotid)) {
    errors.push('Invalid DepotID (must be numeric)');
  }
  
  if (!entry.manifestid || !/^[0-9]+$/.test(entry.manifestid)) {
    errors.push('Invalid ManifestID (must be numeric)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function groupManifestsByAppId(manifests, dumpMode) {
  const grouped = {};
  
  manifests.forEach(manifest => {
    const validation = validateManifestEntry(manifest);
    if (!validation.valid) {
      manifest.validationErrors = validation.errors;
      return;
    }
    
    const appid = manifest.appid;
    if (!grouped[appid]) {
      grouped[appid] = [];
    }
    grouped[appid].push(manifest);
  });
  
  if (dumpMode === 'base-dlc-depotcache') {
    const baseAppIds = Object.keys(grouped);
    baseAppIds.forEach(baseAppId => {
      const dlcAppIds = manifests
        .filter(m => m.isDlc && m.baseAppId === baseAppId)
        .map(m => m.appid)
        .filter((v, i, a) => a.indexOf(v) === i);
      
      dlcAppIds.forEach(dlcAppId => {
        if (!grouped[dlcAppId]) {
          grouped[dlcAppId] = [];
        }
      });
    });
  }
  
  return grouped;
}

function generateLuaContent(appid, manifests) {
  let lua = `-- Depot Manifests for APPID: ${appid}\n`;
  lua += `-- Generated: ${new Date().toISOString()}\n\n`;
  lua += `return {\n`;
  lua += `  appid = ${appid},\n`;
  lua += `  depots = {\n`;
  
  manifests.forEach((manifest, index) => {
    lua += `    {\n`;
    lua += `      depotid = ${manifest.depotid},\n`;
    lua += `      manifestid = ${manifest.manifestid}\n`;
    lua += `    }`;
    if (index < manifests.length - 1) {
      lua += ',';
    }
    lua += '\n';
  });
  
  lua += `  }\n`;
  lua += `}\n`;
  
  return lua;
}

function replaceTokens(pattern, appid) {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
  
  return pattern
    .replace(/{APPID}/g, appid)
    .replace(/{DATE}/g, date)
    .replace(/{TIME}/g, time);
}

function getOutputPath(appid, structure, basePath) {
  const sep = window.electronAPI?.pathSep || '/';
  let dir = basePath;
  
  if (structure === 'appid') {
    dir = `${basePath}${sep}${appid}`;
  } else if (structure === 'manifests') {
    dir = `${basePath}${sep}MANIFESTS${sep}${appid}`;
  }
  
  return dir;
}

function updatePreview() {
  const grouped = groupManifestsByAppId(state.manifests, state.dumpMode);
  const appids = Object.keys(grouped);
  
  if (appids.length === 0) {
    document.getElementById('preview-output').innerHTML = '<code>-- No manifest data added yet</code>';
    return;
  }
  
  const firstAppId = appids[0];
  const firstManifests = grouped[firstAppId];
  
  let preview = `-- Preview for APPID: ${firstAppId}\n`;
  preview += `-- Filename: ${replaceTokens(state.filenamePattern, firstAppId)}\n`;
  preview += `-- Output Path: ${getOutputPath(firstAppId, state.outputStructure, state.outputPath || '/path/to/output')}\n\n`;
  preview += generateLuaContent(firstAppId, firstManifests);
  
  if (appids.length > 1) {
    preview += `\n-- ... and ${appids.length - 1} more file(s) for other APPIDs`;
  }
  
  document.getElementById('preview-output').innerHTML = `<code>${escapeHtml(preview)}</code>`;
}

function updateValidation() {
  const validationDiv = document.getElementById('validation-status');
  const invalidEntries = state.manifests.filter(m => {
    const validation = validateManifestEntry(m);
    return !validation.valid;
  });
  
  if (state.manifests.length === 0) {
    validationDiv.innerHTML = `
      <div class="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>No entries to validate</span>
      </div>
    `;
  } else if (invalidEntries.length === 0) {
    validationDiv.innerHTML = `
      <div class="alert alert-success">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>All ${state.manifests.length} entries are valid</span>
      </div>
    `;
  } else {
    let html = `
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>${invalidEntries.length} entries have validation errors</span>
      </div>
    `;
    
    invalidEntries.forEach(entry => {
      const validation = validateManifestEntry(entry);
      html += `
        <div class="alert alert-warning">
          <span>APPID ${entry.appid}: ${validation.errors.join(', ')}</span>
        </div>
      `;
    });
    
    validationDiv.innerHTML = html;
  }
}

function renderManifestList() {
  const listDiv = document.getElementById('manifest-list');
  
  if (state.manifests.length === 0) {
    listDiv.innerHTML = '<p class="text-sm text-base-content/60">No manifests added yet</p>';
    return;
  }
  
  listDiv.innerHTML = state.manifests.map((manifest, index) => {
    const validation = validateManifestEntry(manifest);
    const statusClass = validation.valid ? 'badge-success' : 'badge-error';
    
    return `
      <div class="flex items-center gap-2 p-2 bg-base-200 rounded">
        <span class="badge ${statusClass}"></span>
        <span class="text-sm flex-1">
          APPID: ${manifest.appid}, Depot: ${manifest.depotid}, Manifest: ${manifest.manifestid}
        </span>
        <button class="btn btn-xs btn-error" onclick="removeManifest(${index})">Remove</button>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addManifest() {
  const appid = document.getElementById('manifest-appid').value.trim();
  const depotid = document.getElementById('manifest-depotid').value.trim();
  const manifestid = document.getElementById('manifest-manifestid').value.trim();
  
  if (!appid || !depotid || !manifestid) {
    return;
  }
  
  state.manifests.push({
    appid,
    depotid,
    manifestid
  });
  
  document.getElementById('manifest-appid').value = '';
  document.getElementById('manifest-depotid').value = '';
  document.getElementById('manifest-manifestid').value = '';
  
  renderManifestList();
  updatePreview();
  updateValidation();
  saveSettings();
}

window.removeManifest = function(index) {
  state.manifests.splice(index, 1);
  renderManifestList();
  updatePreview();
  updateValidation();
  saveSettings();
};

async function browseFolderDialog() {
  if (!window.electronAPI) return;
  
  const path = await window.electronAPI.openFolderDialog();
  if (path) {
    state.outputPath = path;
    document.getElementById('output-path').value = path;
    updatePreview();
    saveSettings();
  }
}

async function saveFiles() {
  if (!state.outputPath) {
    await browseFolderDialog();
    if (!state.outputPath) {
      return;
    }
  }
  
  const grouped = groupManifestsByAppId(state.manifests, state.dumpMode);
  const appids = Object.keys(grouped);
  
  if (appids.length === 0) {
    alert('No valid manifest data to save');
    return;
  }
  
  const filesData = [];
  const sep = window.electronAPI?.pathSep || '/';
  
  appids.forEach(appid => {
    const manifests = grouped[appid];
    if (manifests.length === 0) return;
    
    const content = generateLuaContent(appid, manifests);
    const filename = replaceTokens(state.filenamePattern, appid);
    const dir = getOutputPath(appid, state.outputStructure, state.outputPath);
    const fullPath = `${dir}${sep}${filename}`;
    
    filesData.push({
      path: fullPath,
      content
    });
  });
  
  if (!window.electronAPI) {
    alert('File system API not available');
    return;
  }
  
  const result = await window.electronAPI.writeFiles(filesData);
  
  if (result.success) {
    alert(`Successfully saved ${filesData.length} file(s)`);
  } else {
    alert(`Error saving files: ${result.error}`);
  }
}

async function saveSettings() {
  if (!window.electronAPI) return;
  
  const settings = {
    defaultAppId: state.defaultAppId,
    inferAppId: state.inferAppId,
    dumpMode: state.dumpMode,
    outputPath: state.outputPath,
    outputStructure: state.outputStructure,
    filenamePattern: state.filenamePattern,
    manifests: state.manifests
  };
  
  await window.electronAPI.saveSettings(settings);
}

async function loadSettings() {
  if (!window.electronAPI) return;
  
  const settings = await window.electronAPI.loadSettings();
  
  if (settings) {
    state.defaultAppId = settings.defaultAppId || '';
    state.inferAppId = settings.inferAppId || false;
    state.dumpMode = settings.dumpMode || 'base';
    state.outputPath = settings.outputPath || '';
    state.outputStructure = settings.outputStructure || 'flat';
    state.filenamePattern = settings.filenamePattern || '{APPID}_{DATE}_{TIME}.lua';
    state.manifests = settings.manifests || [];
    
    document.getElementById('default-appid').value = state.defaultAppId;
    document.getElementById('infer-appid').checked = state.inferAppId;
    document.getElementById('dump-mode').value = state.dumpMode;
    document.getElementById('output-path').value = state.outputPath;
    document.getElementById('output-structure').value = state.outputStructure;
    document.getElementById('filename-pattern').value = state.filenamePattern;
    
    renderManifestList();
    updatePreview();
    updateValidation();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('default-appid').addEventListener('input', (e) => {
    state.defaultAppId = e.target.value;
    saveSettings();
  });
  
  document.getElementById('infer-appid').addEventListener('change', (e) => {
    state.inferAppId = e.target.checked;
    saveSettings();
  });
  
  document.getElementById('dump-mode').addEventListener('change', (e) => {
    state.dumpMode = e.target.value;
    updatePreview();
    saveSettings();
  });
  
  document.getElementById('output-structure').addEventListener('change', (e) => {
    state.outputStructure = e.target.value;
    updatePreview();
    saveSettings();
  });
  
  document.getElementById('filename-pattern').addEventListener('input', (e) => {
    state.filenamePattern = e.target.value || '{APPID}_{DATE}_{TIME}.lua';
    updatePreview();
    saveSettings();
  });
  
  document.getElementById('add-manifest').addEventListener('click', addManifest);
  
  document.getElementById('manifest-appid').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addManifest();
  });
  
  document.getElementById('manifest-depotid').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addManifest();
  });
  
  document.getElementById('manifest-manifestid').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addManifest();
  });
  
  document.getElementById('browse-folder').addEventListener('click', browseFolderDialog);
  
  document.getElementById('save-button').addEventListener('click', saveFiles);
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = e.target.getAttribute('data-tab');
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-active'));
      e.target.classList.add('tab-active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      
      if (tabName === 'preview') {
        document.getElementById('preview-content').classList.remove('hidden');
      } else if (tabName === 'validation') {
        document.getElementById('validation-content').classList.remove('hidden');
      }
    });
  });
  
  loadSettings();
});
