import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a file buffer directly to Cloudinary via upload_stream
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Cloudinary upload options (folder, resource_type, etc.)
 * @returns {Promise<{ url: string, public_id: string, duration?: number, resource_type: string }>}
 */
export const uploadFromBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY) {
      // In dev/test when credentials are not yet set up, return simulated response or error
      return reject(
        new Error('Cloudinary credentials are not configured in environment variables')
      );
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'flownet',
        resource_type: 'auto',
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          duration: result.duration,
          resource_type: result.resource_type,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Delete a resource from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @param {string} resourceType - 'image' | 'video' | 'raw'
 */
export const deleteResource = async (publicId, resourceType = 'image') => {
  if (!publicId || !env.CLOUDINARY_CLOUD_NAME) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.warn(`[Cloudinary] Failed to delete asset ${publicId}:`, error.message);
  }
};

export default cloudinary;
