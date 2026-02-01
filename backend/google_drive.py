"""
Google Drive Service Account integration for file uploads
"""
import os
import logging
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
import io

logger = logging.getLogger(__name__)

# Google Drive folder ID
GOOGLE_DRIVE_FOLDER_ID = "1oIY873UCc1PvB1dJwIoQ5hRm_K_uKfKm"

# Path to service account credentials
CREDENTIALS_PATH = Path(__file__).parent / "google_credentials.json"

# MIME type mappings
MIME_TYPES = {
    # Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    # Videos
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.m4v': 'video/x-m4v',
    '.3gp': 'video/3gpp',
    # Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    # Archives
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
}

def get_drive_service():
    """Get authenticated Google Drive service"""
    try:
        credentials = service_account.Credentials.from_service_account_file(
            str(CREDENTIALS_PATH),
            scopes=['https://www.googleapis.com/auth/drive']
        )
        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        logger.error(f"Failed to create Drive service: {e}")
        raise

def get_mime_type(filename: str) -> str:
    """Get MIME type from filename extension"""
    ext = Path(filename).suffix.lower()
    return MIME_TYPES.get(ext, 'application/octet-stream')

def is_image(filename: str) -> bool:
    """Check if file is an image"""
    ext = Path(filename).suffix.lower()
    return ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']

def is_video(filename: str) -> bool:
    """Check if file is a video"""
    ext = Path(filename).suffix.lower()
    return ext in ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv', '.flv', '.m4v', '.3gp']

async def upload_to_drive(file_content: bytes, filename: str, folder_id: str = None) -> dict:
    """
    Upload file to Google Drive and return shareable link
    
    Args:
        file_content: File content as bytes
        filename: Original filename
        folder_id: Optional folder ID (uses default if not provided)
    
    Returns:
        dict with file_id, web_view_link, web_content_link, direct_link
    """
    try:
        service = get_drive_service()
        target_folder = folder_id or GOOGLE_DRIVE_FOLDER_ID
        
        mime_type = get_mime_type(filename)
        
        file_metadata = {
            'name': filename,
            'parents': [target_folder]
        }
        
        # Create media upload from bytes - using non-resumable for smaller files
        media = MediaIoBaseUpload(
            io.BytesIO(file_content),
            mimetype=mime_type,
            resumable=False  # Changed to False to avoid storage quota issue
        )
        
        # Upload file
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink, webContentLink, mimeType'
        ).execute()
        
        file_id = file.get('id')
        
        # Make file publicly accessible
        permission = {
            'type': 'anyone',
            'role': 'reader'
        }
        service.permissions().create(
            fileId=file_id,
            body=permission
        ).execute()
        
        # Get direct link for embedding
        # For images/videos, use this format for direct access
        direct_link = f"https://drive.google.com/uc?export=view&id={file_id}"
        
        # For videos, also provide streaming link
        if is_video(filename):
            direct_link = f"https://drive.google.com/file/d/{file_id}/preview"
        
        logger.info(f"File uploaded to Drive: {filename} -> {file_id}")
        
        return {
            'file_id': file_id,
            'filename': filename,
            'mime_type': mime_type,
            'web_view_link': file.get('webViewLink'),
            'web_content_link': file.get('webContentLink'),
            'direct_link': direct_link,
            'is_image': is_image(filename),
            'is_video': is_video(filename)
        }
        
    except Exception as e:
        logger.error(f"Failed to upload to Drive: {e}")
        raise

async def delete_from_drive(file_id: str) -> bool:
    """Delete file from Google Drive"""
    try:
        service = get_drive_service()
        service.files().delete(fileId=file_id).execute()
        logger.info(f"File deleted from Drive: {file_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete from Drive: {e}")
        return False
