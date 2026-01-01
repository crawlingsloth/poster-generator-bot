const sharp = require('sharp');
const path = require('path');

/**
 * Create a thumbnail from a source image
 * @param {string} sourcePath - Path to source image
 * @param {string} id - Unique ID for the image
 * @param {string} ext - File extension (including dot)
 * @returns {Promise<string>} - Path to created thumbnail
 */
async function createThumbnail(sourcePath, id, ext) {
  const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `${id}${ext}`);

  await sharp(sourcePath)
    .resize(300, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .toFile(thumbnailPath);

  return thumbnailPath;
}

module.exports = { createThumbnail };
