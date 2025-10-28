const fs = require('fs').promises;

function parseVDF(content) {
  const lines = content.split('\n');
  const root = {};
  const stack = [root];
  let currentKey = null;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (!line || line.startsWith('//')) continue;
    
    if (line.match(/^"([^"]+)"\s*$/)) {
      const keyMatch = line.match(/^"([^"]+)"/);
      if (keyMatch) {
        currentKey = keyMatch[1];
      }
    } else if (line === '{') {
      if (currentKey) {
        const parent = stack[stack.length - 1];
        parent[currentKey] = {};
        stack.push(parent[currentKey]);
        currentKey = null;
      }
    } else if (line === '}') {
      if (stack.length > 1) {
        stack.pop();
      }
    } else if (line.match(/^"([^"]+)"\s*{/)) {
      const keyMatch = line.match(/^"([^"]+)"/);
      if (keyMatch) {
        const key = keyMatch[1];
        const parent = stack[stack.length - 1];
        parent[key] = {};
        stack.push(parent[key]);
      }
    } else {
      const kvMatch = line.match(/^"([^"]+)"\s+"([^"]*)"/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        const current = stack[stack.length - 1];
        current[key] = value;
      }
    }
  }
  
  return root;
}

async function parseVDFFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return {
      success: true,
      data: parseVDF(content)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function extractDepotIds(appmanifest) {
  const depotIds = new Set();
  
  if (!appmanifest) return [];
  
  if (appmanifest.DepotState) {
    Object.keys(appmanifest.DepotState).forEach(depotId => {
      if (/^\d+$/.test(depotId)) {
        depotIds.add(depotId);
      }
    });
  }
  
  if (appmanifest.MountedDepots) {
    Object.keys(appmanifest.MountedDepots).forEach(depotId => {
      if (/^\d+$/.test(depotId)) {
        depotIds.add(depotId);
      }
    });
  }
  
  if (appmanifest.InstalledDepots) {
    Object.keys(appmanifest.InstalledDepots).forEach(depotId => {
      if (/^\d+$/.test(depotId)) {
        depotIds.add(depotId);
      }
    });
  }
  
  return Array.from(depotIds);
}

function extractDLCIds(appmanifest) {
  const dlcIds = [];
  
  if (!appmanifest) return [];
  
  if (appmanifest.InstalledDLC) {
    const dlcSection = appmanifest.InstalledDLC;
    Object.values(dlcSection).forEach(value => {
      if (typeof value === 'string' && /^\d+$/.test(value)) {
        dlcIds.push(value);
      }
    });
  }
  
  return dlcIds;
}

module.exports = {
  parseVDF,
  parseVDFFile,
  extractDepotIds,
  extractDLCIds
};
