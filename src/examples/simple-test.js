const { discoverLibraryFolders } = require('../steam/library-discovery');

async function simpleTest() {
  console.log('Platform:', process.platform);
  console.log('Testing Steam library discovery...\n');
  
  const result = await discoverLibraryFolders();
  
  console.log('Success:', result.success);
  console.log('Libraries found:', result.libraries.length);
  
  if (result.libraries.length > 0) {
    console.log('\nLibraries:');
    result.libraries.forEach((lib, i) => {
      console.log(`  ${i + 1}. ${lib}`);
    });
  }
  
  if (result.errors.length > 0) {
    console.log('\nErrors/Warnings:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
}

simpleTest().catch(console.error);
