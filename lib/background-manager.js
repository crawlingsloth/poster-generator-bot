const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'state.json');

const DEFAULT_STATE = {
  activeBackgroundId: null,
  backgrounds: [],
  defaultBackgroundUrl: 'https://minio.crawlingsloth.space/telegram-media/dmma-express/speedboat.png'
};

class BackgroundManager {
  constructor() {
    this.initializeState();
  }

  /**
   * Initialize state file if it doesn't exist
   */
  initializeState() {
    if (!fs.existsSync(STATE_FILE)) {
      this.saveState(DEFAULT_STATE);
    }
  }

  /**
   * Load state from disk
   * @returns {Object} - Current state
   */
  loadState() {
    try {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading state, using default:', error);
      return DEFAULT_STATE;
    }
  }

  /**
   * Save state to disk atomically
   * @param {Object} state - State to save
   */
  saveState(state) {
    try {
      const tempFile = `${STATE_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
      fs.renameSync(tempFile, STATE_FILE);
    } catch (error) {
      console.error('Error saving state:', error);
      throw new Error('Failed to save state');
    }
  }

  /**
   * Get URL for active background
   * @returns {string} - URL of active background or default
   */
  getActiveBackgroundUrl() {
    const state = this.loadState();

    if (!state.activeBackgroundId) {
      return state.defaultBackgroundUrl;
    }

    const activeBackground = state.backgrounds.find(
      bg => bg.id === state.activeBackgroundId
    );

    if (!activeBackground) {
      return state.defaultBackgroundUrl;
    }

    const ext = path.extname(activeBackground.filename);
    return `file://${path.join(__dirname, '..', 'uploads', 'backgrounds', `${state.activeBackgroundId}${ext}`)}`;
  }

  /**
   * List all backgrounds with active flag
   * @returns {Object} - Object with backgrounds array and activeBackgroundId
   */
  listBackgrounds() {
    const state = this.loadState();
    const backgrounds = state.backgrounds.map(bg => ({
      ...bg,
      isActive: bg.id === state.activeBackgroundId,
      thumbnailUrl: `/uploads/thumbnails/${bg.id}${path.extname(bg.filename)}`,
      fullUrl: `/uploads/backgrounds/${bg.id}${path.extname(bg.filename)}`
    }));

    return {
      backgrounds,
      activeBackgroundId: state.activeBackgroundId
    };
  }

  /**
   * Add a new background
   * @param {Object} data - Background data (id, filename, originalName, mimeType, fileSize)
   * @returns {Object} - Added background object
   */
  addBackground(data) {
    const state = this.loadState();

    const background = {
      id: data.id,
      filename: data.filename,
      originalName: data.originalName,
      uploadedAt: new Date().toISOString(),
      fileSize: data.fileSize,
      mimeType: data.mimeType
    };

    state.backgrounds.push(background);

    // If this is the first background, make it active
    if (state.backgrounds.length === 1) {
      state.activeBackgroundId = background.id;
    }

    this.saveState(state);

    return {
      ...background,
      isActive: background.id === state.activeBackgroundId,
      thumbnailUrl: `/uploads/thumbnails/${background.id}${path.extname(background.filename)}`,
      fullUrl: `/uploads/backgrounds/${background.id}${path.extname(background.filename)}`
    };
  }

  /**
   * Set active background
   * @param {string} id - Background ID to set as active
   */
  setActiveBackground(id) {
    const state = this.loadState();

    const background = state.backgrounds.find(bg => bg.id === id);
    if (!background) {
      throw new Error('Background not found');
    }

    state.activeBackgroundId = id;
    this.saveState(state);
  }

  /**
   * Delete a background
   * @param {string} id - Background ID to delete
   */
  deleteBackground(id) {
    const state = this.loadState();

    const bgIndex = state.backgrounds.findIndex(bg => bg.id === id);
    if (bgIndex === -1) {
      throw new Error('Background not found');
    }

    const background = state.backgrounds[bgIndex];
    const ext = path.extname(background.filename);

    // Delete files
    const bgPath = path.join(__dirname, '..', 'uploads', 'backgrounds', `${id}${ext}`);
    const thumbPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `${id}${ext}`);

    try {
      if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    } catch (error) {
      console.error('Error deleting files:', error);
    }

    // Remove from state
    state.backgrounds.splice(bgIndex, 1);

    // If this was the active background, reset to null
    if (state.activeBackgroundId === id) {
      state.activeBackgroundId = null;
    }

    this.saveState(state);
  }
}

module.exports = BackgroundManager;
