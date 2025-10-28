const fs = require('fs').promises;
const path = require('path');

const DEFAULT_SETTINGS = {
  theme: 'dark',
  appId: '',
  includeDlc: true,
  outputFolder: ''
};

class SettingsStore {
  constructor(appInstance) {
    this.app = appInstance;
    this.settingsPath = null;
    this.settings = { ...DEFAULT_SETTINGS };
  }

  getSettingsPath() {
    if (!this.settingsPath) {
      const userDataPath = this.app.getPath('userData');
      this.settingsPath = path.join(userDataPath, 'settings.json');
    }
    return this.settingsPath;
  }

  async load() {
    try {
      const filePath = this.getSettingsPath();
      const data = await fs.readFile(filePath, 'utf8');
      const loaded = JSON.parse(data);
      this.settings = { ...DEFAULT_SETTINGS, ...loaded };
      return { success: true, settings: this.settings };
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.settings = { ...DEFAULT_SETTINGS };
        return { success: true, settings: this.settings };
      }
      console.error('Error loading settings:', error.message);
      this.settings = { ...DEFAULT_SETTINGS };
      return { success: false, error: error.message, settings: this.settings };
    }
  }

  async save(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      const filePath = this.getSettingsPath();
      const userDataPath = this.app.getPath('userData');
      
      await fs.mkdir(userDataPath, { recursive: true });
      
      await fs.writeFile(filePath, JSON.stringify(this.settings, null, 2), 'utf8');
      
      return { success: true, settings: this.settings };
    } catch (error) {
      console.error('Error saving settings:', error.message);
      return { success: false, error: error.message, settings: this.settings };
    }
  }

  get() {
    return { ...this.settings };
  }

  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    return this.settings;
  }
}

module.exports = { SettingsStore, DEFAULT_SETTINGS };
