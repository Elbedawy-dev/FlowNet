import multer from 'multer';
import { ApiError } from '../utils/apiError.js';

const storage = multer.memoryStorage();

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/jpg',
];

const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
];

// 5MB image limit
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
// 50MB video limit
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type "${file.mimetype}". Allowed image formats: JPEG, PNG, WEBP, GIF`,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }
};

const storyFileFilter = (req, file, cb) => {
  if (
    ALLOWED_IMAGE_MIMES.includes(file.mimetype) ||
    ALLOWED_VIDEO_MIMES.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type "${file.mimetype}". Allowed formats: JPEG, PNG, WEBP, GIF, MP4, WEBM`,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }
};

export const uploadProfileAndCover = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: imageFileFilter,
}).fields([
  { name: 'profile_picture', maxCount: 1 },
  { name: 'cover_photo', maxCount: 1 },
]);

export const uploadPostImages = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: imageFileFilter,
}).array('images', 4);

export const uploadStoryMedia = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: storyFileFilter,
}).single('media');

export const uploadMessageMedia = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: imageFileFilter,
}).single('image');

export const uploadGroupMessageMedia = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: imageFileFilter,
}).single('media');
