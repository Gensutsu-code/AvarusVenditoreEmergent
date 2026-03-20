"""
Cloudinary integration for file uploads (images, videos, documents)
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import cloudinary
import cloudinary.uploader
import cloudinary.utils

logger = logging.getLogger(__name__)

# Initialize Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# File type detection
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico', '.heic', '.heif'}
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv', '.flv', '.m4v', '.3gp', '.mpeg', '.mpg'}
RAW_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.json', '.xml', '.zip', '.rar', '.7z', '.tar', '.gz'}

def get_resource_type(filename: str) -> str:
    """Determine Cloudinary resource type from filename"""
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return 'image'
    elif ext in VIDEO_EXTENSIONS:
        return 'video'
    else:
        return 'raw'  # For documents and other files

def is_image(filename: str) -> bool:
    """Check if file is an image"""
    ext = Path(filename).suffix.lower()
    return ext in IMAGE_EXTENSIONS

def is_video(filename: str) -> bool:
    """Check if file is a video"""
    ext = Path(filename).suffix.lower()
    return ext in VIDEO_EXTENSIONS

async def upload_to_cloudinary(file_content: bytes, filename: str, folder: str = "chat") -> dict:
    """
    Upload file to Cloudinary and return public URL.
    Uses chunked upload for large files (>90MB).
    """
    try:
        resource_type = get_resource_type(filename)
        
        import uuid
        import tempfile
        public_id = f"{folder}/{uuid.uuid4()}"
        
        use_chunked = len(file_content) > 90 * 1024 * 1024  # >90MB

        if use_chunked:
            # Write to temp file and use upload_large for chunked upload
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name
            try:
                result = cloudinary.uploader.upload_large(
                    tmp_path,
                    public_id=public_id,
                    resource_type=resource_type,
                    chunk_size=20_000_000,  # 20MB chunks
                    overwrite=True,
                    invalidate=True
                )
            finally:
                import os
                os.unlink(tmp_path)
        else:
            result = cloudinary.uploader.upload(
                file_content,
                public_id=public_id,
                resource_type=resource_type,
                folder=None,
                overwrite=True,
                invalidate=True
            )
        
        url = result.get('secure_url')
        logger.info(f"File uploaded to Cloudinary: {filename} -> {url}")
        
        return {
            'url': url,
            'public_id': result.get('public_id'),
            'resource_type': resource_type,
            'is_image': is_image(filename),
            'is_video': is_video(filename),
            'format': result.get('format'),
            'bytes': result.get('bytes'),
            'width': result.get('width'),
            'height': result.get('height'),
            'duration': result.get('duration')
        }
        
    except Exception as e:
        logger.error(f"Failed to upload to Cloudinary: {e}")
        raise


async def upload_file_to_cloudinary(file_path: str, filename: str, folder: str = "personal") -> dict:
    """
    Upload file to Cloudinary from a file path (memory-efficient for large files).
    Always uses upload_large to handle any file size.
    """
    try:
        resource_type = get_resource_type(filename)
        import uuid
        public_id = f"{folder}/{uuid.uuid4()}"

        result = cloudinary.uploader.upload_large(
            file_path,
            public_id=public_id,
            resource_type=resource_type,
            chunk_size=20_000_000,  # 20MB chunks
            overwrite=True,
            invalidate=True
        )

        url = result.get('secure_url')
        logger.info(f"File uploaded to Cloudinary (from path): {filename} -> {url}")

        return {
            'url': url,
            'public_id': result.get('public_id'),
            'resource_type': resource_type,
            'is_image': is_image(filename),
            'is_video': is_video(filename),
            'format': result.get('format'),
            'bytes': result.get('bytes'),
            'width': result.get('width'),
            'height': result.get('height'),
            'duration': result.get('duration')
        }

    except Exception as e:
        logger.error(f"Failed to upload file to Cloudinary: {e}")
        raise

async def delete_from_cloudinary(public_id: str, resource_type: str = 'image') -> bool:
    """Delete file from Cloudinary"""
    try:
        result = cloudinary.uploader.destroy(
            public_id, 
            resource_type=resource_type,
            invalidate=True
        )
        success = result.get('result') == 'ok'
        if success:
            logger.info(f"File deleted from Cloudinary: {public_id}")
        return success
    except Exception as e:
        logger.error(f"Failed to delete from Cloudinary: {e}")
        return False

def get_optimized_url(url: str, width: int = None, height: int = None, quality: str = 'auto') -> str:
    """
    Get optimized URL with transformations
    
    Args:
        url: Original Cloudinary URL
        width: Target width
        height: Target height
        quality: Quality setting ('auto', 'auto:low', 'auto:good', 'auto:best')
    
    Returns:
        Transformed URL
    """
    if not url or 'cloudinary.com' not in url:
        return url
    
    # Build transformation string
    transformations = [f'q_{quality}', 'f_auto']
    if width:
        transformations.append(f'w_{width}')
    if height:
        transformations.append(f'h_{height}')
    
    transform_str = ','.join(transformations)
    
    # Insert transformation into URL
    # URL format: https://res.cloudinary.com/{cloud}/image/upload/{public_id}
    # Transform to: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{public_id}
    parts = url.split('/upload/')
    if len(parts) == 2:
        return f"{parts[0]}/upload/{transform_str}/{parts[1]}"
    
    return url
