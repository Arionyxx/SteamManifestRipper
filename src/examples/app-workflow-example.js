const { loadAppData } = require('../steam/app-loader');
const { copyManifests } = require('../steam/manifest-copier');

async function exampleWorkflow() {
  console.log('=== Steam Backend Workflow Example ===\n');
  
  const appId = '228980';
  
  console.log(`1. Loading app data for app ID ${appId}...`);
  const appData = await loadAppData({
    appId,
    includeDlc: true
  });
  
  if (!appData.success) {
    console.error('Failed to load app data:');
    console.error(appData.errors);
    return;
  }
  
  console.log(`\nApp Name: ${appData.appName}`);
  console.log(`Total Depots: ${appData.depots.length}`);
  console.log(`Missing Keys: ${appData.missingKeys.length}`);
  
  console.log('\nDepot Details:');
  for (const depot of appData.depots) {
    console.log(`  - Depot ${depot.depotId} (${depot.type})`);
    console.log(`    Manifest ID: ${depot.manifestId}`);
    console.log(`    Has Key: ${depot.decryptionKey ? 'Yes' : 'No'}`);
  }
  
  if (appData.warnings.length > 0) {
    console.log('\nWarnings:');
    appData.warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  console.log('\n2. Copying manifest files...');
  const copyResult = await copyManifests({
    depots: appData.depots.slice(0, 2),
    destination: '/tmp/manifests'
  });
  
  if (copyResult.success) {
    console.log(`\nCopied ${copyResult.copied.length} files`);
    console.log(`Missing ${copyResult.missing.length} files`);
    
    if (copyResult.copied.length > 0) {
      console.log('\nCopied Files:');
      copyResult.copied.forEach(f => console.log(`  - ${f.filename}`));
    }
    
    if (copyResult.missing.length > 0) {
      console.log('\nMissing Files:');
      copyResult.missing.forEach(f => console.log(`  - ${f.filename}`));
    }
  } else {
    console.error('Failed to copy manifests:');
    console.error(copyResult.errors);
  }
}

if (require.main === module) {
  exampleWorkflow().catch(error => {
    console.error('Example failed:', error);
    process.exit(1);
  });
}

module.exports = { exampleWorkflow };
