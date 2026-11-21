import { v2 as cloudinary } from 'cloudinary';
import { ENV } from './env.js';

if (ENV.CLOUDINARY_CLOUD_NAME && ENV.CLOUDINARY_API_KEY && ENV.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
    api_key: ENV.CLOUDINARY_API_KEY,
    api_secret: ENV.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn('Cloudinary environment variables are not fully configured.');
}

export { cloudinary };
